import express from 'express';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import { z } from 'zod';
import { PORT, REDIS_URL, INTERNAL_API_KEY } from './settings.js';
import { dataRequest } from './http.js';
import { requireSession, requireRole } from './session-middleware.js';

const app = express();
const redis = new Redis(REDIS_URL);
const publisher = new Redis(REDIS_URL);

const TEACHER_ACTIVE_ROOM_KEY_PREFIX = 'teacher-active-room:';
const TEACHER_ACTIVE_ROOM_TTL_SECONDS = 90;

app.use(express.json());
app.use(cookieParser());

const createTicketSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  locationId: z.coerce.number().int().positive(),
  issueType: z.enum(['HOMEWORK', 'LAB', 'PROJECT', 'EXAM_REVIEW', 'GENERAL']),
  notes: z.string().max(1000).optional().transform(function(value) { return String(value || '').trim(); }),
  preferredContact: z.enum(['IN_PERSON', 'QUEUE_DISPLAY']).default('IN_PERSON')
});

const completeTicketSchema = z.object({
  resolutionNotes: z.string().max(1000).optional()
});

const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(500).optional()
});

const teacherActiveRoomSchema = z.object({
  buildingId: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive()
});

function requireInternalApiKey(req, res, next) {
  if (req.headers['x-internal-api-key'] !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Missing or invalid internal API key' });
  }
  next();
}

function getTeacherActiveRoomKey(teacherId) {
  return `${TEACHER_ACTIVE_ROOM_KEY_PREFIX}${teacherId}`;
}

function normalizeOptionalPositiveInt(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseRoomFilter(source) {
  return {
    buildingId: normalizeOptionalPositiveInt(source?.buildingId),
    roomId: normalizeOptionalPositiveInt(source?.roomId)
  };
}

function buildRoomIndex(lookups) {
  const map = new Map();

  (lookups?.locations || []).forEach(function(location) {
    if (!location || !location.roomId) {
      return;
    }

    const key = String(location.roomId);
    if (!map.has(key)) {
      map.set(key, {
        buildingId: Number(location.buildingId),
        buildingName: location.buildingName,
        roomId: Number(location.roomId),
        roomName: location.roomName,
        displayLabel: `${location.buildingName} / Room ${location.roomName}`
      });
    }
  });

  return map;
}

function buildLocationIndex(lookups) {
  const map = new Map();

  (lookups?.locations || []).forEach(function(location) {
    if (!location || !location.id) {
      return;
    }

    map.set(String(location.id), {
      locationId: Number(location.id),
      buildingId: Number(location.buildingId),
      buildingName: location.buildingName,
      roomId: Number(location.roomId),
      roomName: location.roomName,
      tableNumber: location.tableNumber,
      displayLabel: location.displayLabel
    });
  });

  return map;
}

async function getSupportLookups() {
  return dataRequest('/internal/support/lookups');
}

async function getQueueTicketsFresh() {
  return dataRequest('/internal/tickets?status=IN_QUEUE');
}

function filterQueueTicketsByRoom(queueTickets, locationIndex, filter) {
  if (!filter || !filter.roomId) {
    return queueTickets;
  }

  return queueTickets.filter(function(ticket) {
    const location = locationIndex.get(String(ticket.locationId));
    return location && Number(location.roomId) === Number(filter.roomId);
  });
}

function buildMetrics(queueCount, onlineTeacherCount) {
  let estimatedWaitMinutes;
  if (onlineTeacherCount <= 0) {
    estimatedWaitMinutes = 0;
  } else {
    const ratio = Math.ceil(Math.max(queueCount, 1) / onlineTeacherCount);
    estimatedWaitMinutes = Math.max(2, ratio * 2);
  }

  return {
    onlineTeacherCount,
    queueCount,
    estimatedWaitMinutes
  };
}

async function scanTeacherActiveRoomEntries() {
  let cursor = '0';
  const keys = [];

  do {
    const result = await redis.scan(cursor, 'MATCH', `${TEACHER_ACTIVE_ROOM_KEY_PREFIX}*`, 'COUNT', '100');
    cursor = result[0];
    const batch = result[1] || [];
    batch.forEach(function(key) {
      keys.push(key);
    });
  } while (cursor !== '0');

  if (!keys.length) {
    return [];
  }

  const values = await redis.mget(keys);
  return values.map(function(value) {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }).filter(Boolean);
}

async function getTeacherActiveRoomRecord(teacherId) {
  const raw = await redis.get(getTeacherActiveRoomKey(teacherId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function enrichTeacherActiveRoomRecord(record, lookups) {
  if (!record) {
    return null;
  }

  const roomIndex = buildRoomIndex(lookups);
  const room = roomIndex.get(String(record.roomId));
  if (!room) {
    return {
      teacherId: record.teacherId,
      buildingId: record.buildingId,
      roomId: record.roomId,
      activatedAt: record.activatedAt,
      lastSeenAt: record.lastSeenAt,
      buildingName: null,
      roomName: null,
      displayLabel: null
    };
  }

  return {
    teacherId: record.teacherId,
    buildingId: room.buildingId,
    roomId: room.roomId,
    activatedAt: record.activatedAt,
    lastSeenAt: record.lastSeenAt,
    buildingName: room.buildingName,
    roomName: room.roomName,
    displayLabel: room.displayLabel
  };
}

async function storeTeacherActiveRoom(teacherId, roomInfo) {
  const timestamp = new Date().toISOString();
  const existing = await getTeacherActiveRoomRecord(teacherId);
  const payload = {
    teacherId: Number(teacherId),
    buildingId: Number(roomInfo.buildingId),
    roomId: Number(roomInfo.roomId),
    activatedAt: existing?.activatedAt || timestamp,
    lastSeenAt: timestamp
  };

  await redis.set(getTeacherActiveRoomKey(teacherId), JSON.stringify(payload), 'EX', TEACHER_ACTIVE_ROOM_TTL_SECONDS);
  return payload;
}

async function refreshTeacherActiveRoom(teacherId) {
  const existing = await getTeacherActiveRoomRecord(teacherId);
  if (!existing) {
    return null;
  }

  existing.lastSeenAt = new Date().toISOString();
  await redis.set(getTeacherActiveRoomKey(teacherId), JSON.stringify(existing), 'EX', TEACHER_ACTIVE_ROOM_TTL_SECONDS);
  return existing;
}

async function clearTeacherActiveRoom(teacherId) {
  await redis.del(getTeacherActiveRoomKey(teacherId));
}

function getValidatedRoomInfo(lookups, filter) {
  if (!filter.roomId) {
    return null;
  }

  const roomIndex = buildRoomIndex(lookups);
  const room = roomIndex.get(String(filter.roomId));
  if (!room) {
    const error = new Error('Selected room was not found');
    error.status = 400;
    throw error;
  }

  if (filter.buildingId && Number(filter.buildingId) !== Number(room.buildingId)) {
    const error = new Error('Selected room does not belong to the chosen building');
    error.status = 400;
    throw error;
  }

  return room;
}

async function computeQueueContext(filter) {
  const lookups = await getSupportLookups();
  const locationIndex = buildLocationIndex(lookups);
  const activeRoomEntries = await scanTeacherActiveRoomEntries();
  const queueTickets = await getQueueTicketsFresh();

  let filteredQueue = queueTickets;
  let filteredTeachers = activeRoomEntries;

  if (filter && filter.roomId) {
    filteredQueue = filterQueueTicketsByRoom(queueTickets, locationIndex, filter);
    filteredTeachers = activeRoomEntries.filter(function(entry) {
      return Number(entry.roomId) === Number(filter.roomId);
    });
  }

  return {
    lookups,
    queueTickets: filteredQueue,
    metrics: buildMetrics(filteredQueue.length, filteredTeachers.length)
  };
}

async function publishTicketEvent(type, payload) {
  await publisher.publish('ticket-events', JSON.stringify({
    type,
    payload,
    at: new Date().toISOString()
  }));
}

app.get('/health', function(req, res) {
  res.json({ status: 'ok', service: 'tickets-service' });
});

app.post('/tickets', requireSession(redis), requireRole('STUDENT', 'ADMIN'), async function(req, res, next) {
  try {
    const body = createTicketSchema.parse(req.body);

    const ticket = await dataRequest('/internal/tickets', {
      method: 'POST',
      body: JSON.stringify({
        studentId: req.user.id,
        ...body
      })
    });

    await redis.del('cache:queue:active');
    await publishTicketEvent('TICKET_CREATED', ticket);

    res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
});

app.get('/tickets/queue', requireSession(redis), async function(req, res, next) {
  try {
    const filter = parseRoomFilter(req.query);

    if (!filter.roomId) {
      const cached = await redis.get('cache:queue:active');
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    const lookups = await getSupportLookups();
    if (filter.roomId) {
      getValidatedRoomInfo(lookups, filter);
    }

    const locationIndex = buildLocationIndex(lookups);
    const queue = filterQueueTicketsByRoom(await getQueueTicketsFresh(), locationIndex, filter);

    if (!filter.roomId) {
      await redis.set('cache:queue:active', JSON.stringify(queue), 'EX', 15);
    }

    res.json(queue);
  } catch (error) {
    next(error);
  }
});

app.get('/tickets/lookups', requireSession(redis), requireRole('STUDENT', 'TEACHER', 'ADMIN'), async function(req, res, next) {
  try {
    const lookups = await dataRequest('/internal/support/lookups');
    res.json(lookups);
  } catch (error) {
    next(error);
  }
});

app.get('/tickets/wait-metrics', requireSession(redis), async function(req, res, next) {
  try {
    const filter = parseRoomFilter(req.query);
    const lookups = await getSupportLookups();
    if (filter.roomId) {
      getValidatedRoomInfo(lookups, filter);
    }

    const context = await computeQueueContext(filter);
    res.json(context.metrics);
  } catch (error) {
    next(error);
  }
});

app.get('/tickets/mine', requireSession(redis), async function(req, res, next) {
  try {
    let result;
    if (req.user.role === 'TEACHER') {
      result = await dataRequest(`/internal/tickets/by-teacher/${req.user.id}`);
    } else {
      result = await dataRequest(`/internal/tickets/by-student/${req.user.id}`);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/tickets/teacher/active-room', requireSession(redis), requireRole('TEACHER', 'ADMIN'), async function(req, res, next) {
  try {
    const lookups = await getSupportLookups();
    const activeRoom = await enrichTeacherActiveRoomRecord(await getTeacherActiveRoomRecord(req.user.id), lookups);
    res.json(activeRoom);
  } catch (error) {
    next(error);
  }
});

app.post('/tickets/teacher/active-room', requireSession(redis), requireRole('TEACHER', 'ADMIN'), async function(req, res, next) {
  try {
    const body = teacherActiveRoomSchema.parse(req.body || {});
    const lookups = await getSupportLookups();
    const room = getValidatedRoomInfo(lookups, body);
    const stored = await storeTeacherActiveRoom(req.user.id, room);
    const payload = await enrichTeacherActiveRoomRecord(stored, lookups);

    await publishTicketEvent('TEACHER_PRESENCE_UPDATED', {
      teacherId: req.user.id,
      activeRoom: payload
    });

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.post('/tickets/teacher/active-room/heartbeat', requireSession(redis), requireRole('TEACHER', 'ADMIN'), async function(req, res, next) {
  try {
    const refreshed = await refreshTeacherActiveRoom(req.user.id);
    if (!refreshed) {
      return res.status(404).json({ error: 'No active room is set for this teacher' });
    }

    const lookups = await getSupportLookups();
    const payload = await enrichTeacherActiveRoomRecord(refreshed, lookups);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.delete('/tickets/teacher/active-room', requireSession(redis), requireRole('TEACHER', 'ADMIN'), async function(req, res, next) {
  try {
    await clearTeacherActiveRoom(req.user.id);
    await publishTicketEvent('TEACHER_PRESENCE_UPDATED', {
      teacherId: req.user.id,
      activeRoom: null
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/tickets/:id/accept', requireSession(redis), requireRole('TEACHER', 'ADMIN'), async function(req, res, next) {
  try {
    const activeRoom = await getTeacherActiveRoomRecord(req.user.id);
    if (!activeRoom) {
      return res.status(400).json({ error: 'Select an active building and room before accepting tickets' });
    }

    const lookups = await getSupportLookups();
    const queue = await getQueueTicketsFresh();
    const ticket = queue.find(function(item) {
      return Number(item.id) === Number(req.params.id);
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket is no longer available in the queue' });
    }

    const locationIndex = buildLocationIndex(lookups);
    const ticketLocation = locationIndex.get(String(ticket.locationId));
    if (!ticketLocation || Number(ticketLocation.roomId) !== Number(activeRoom.roomId)) {
      return res.status(403).json({ error: 'You can only accept tickets from your active room' });
    }

    await refreshTeacherActiveRoom(req.user.id);

    const updated = await dataRequest(`/internal/tickets/${req.params.id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ teacherId: req.user.id })
    });

    await redis.del('cache:queue:active');
    await publishTicketEvent('TICKET_ASSIGNED', updated);

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.post('/tickets/:id/complete', requireSession(redis), requireRole('TEACHER', 'ADMIN'), async function(req, res, next) {
  try {
    const body = completeTicketSchema.parse(req.body || {});

    const updated = await dataRequest(`/internal/tickets/${req.params.id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({
        teacherId: req.user.id,
        resolutionNotes: body.resolutionNotes || null
      })
    });

    await redis.del('cache:queue:active');
    await publishTicketEvent('TICKET_COMPLETED', updated);

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.post('/tickets/:id/feedback', requireSession(redis), requireRole('STUDENT', 'ADMIN'), async function(req, res, next) {
  try {
    const body = feedbackSchema.parse(req.body || {});

    const updated = await dataRequest(`/internal/tickets/${req.params.id}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify({
        studentId: req.user.id,
        rating: body.rating,
        comment: body.comment || null
      })
    });

    await publishTicketEvent('TICKET_FEEDBACK_SUBMITTED', updated);

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.get('/tickets/internal/queue-snapshot', requireInternalApiKey, async function(req, res, next) {
  try {
    const filter = parseRoomFilter(req.query);
    const lookups = await getSupportLookups();
    if (filter.roomId) {
      getValidatedRoomInfo(lookups, filter);
    }

    const locationIndex = buildLocationIndex(lookups);
    const queue = filterQueueTicketsByRoom(await getQueueTicketsFresh(), locationIndex, filter);
    res.json(queue);
  } catch (error) {
    next(error);
  }
});

app.get('/tickets/internal/wait-metrics', requireInternalApiKey, async function(req, res, next) {
  try {
    const filter = parseRoomFilter(req.query);
    const lookups = await getSupportLookups();
    if (filter.roomId) {
      getValidatedRoomInfo(lookups, filter);
    }

    const context = await computeQueueContext(filter);
    res.json(context.metrics);
  } catch (error) {
    next(error);
  }
});

app.get('/tickets/internal/report', requireInternalApiKey, async function(req, res, next) {
  try {
    const report = await dataRequest('/internal/tickets/report');
    res.json(report);
  } catch (error) {
    next(error);
  }
});

app.post('/tickets/internal/purge', requireInternalApiKey, async function(req, res, next) {
  try {
    const body = z.object({
      ticketIds: z.array(z.coerce.number().int().positive()).min(1)
    }).parse(req.body || {});

    const result = await dataRequest('/internal/tickets/purge', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    await redis.del('cache:queue:active');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use(function(error, req, res, next) {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
});

app.listen(PORT, function() {
  console.log(`tickets-service listening on ${PORT}`);
});
