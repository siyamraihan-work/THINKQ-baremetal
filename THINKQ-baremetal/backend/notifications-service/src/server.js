import express from 'express';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import fetch from 'node-fetch';
import { PORT, REDIS_URL, DATA_SERVICE_URL, TICKETS_SERVICE_URL, INTERNAL_API_KEY, SERVICE_HOST } from './settings.js';
import { renderQueueLivePage } from './queue-live-page.js';

const app = express();
const redis = new Redis(REDIS_URL);
const subscriber = new Redis(REDIS_URL);
const SESSION_TTL_SECONDS = 60 * 60 * 8;

const teacherClients = new Set();
const queueClients = new Set();
const studentClients = new Map();

app.use(cookieParser());

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function initSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(': connected\n\n');
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

function withFilterQuery(path, filter) {
  const params = new URLSearchParams();

  if (filter?.buildingId) {
    params.set('buildingId', String(filter.buildingId));
  }

  if (filter?.roomId) {
    params.set('roomId', String(filter.roomId));
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

async function fetchQueueSnapshot(filter) {
  const response = await fetch(`${TICKETS_SERVICE_URL}${withFilterQuery('/tickets/internal/queue-snapshot', filter)}`, {
    headers: { 'x-internal-api-key': INTERNAL_API_KEY }
  });

  if (!response.ok) {
    throw new Error(`Queue snapshot failed: ${response.status}`);
  }

  return response.json();
}

async function fetchQueueMetrics(filter) {
  const response = await fetch(`${TICKETS_SERVICE_URL}${withFilterQuery('/tickets/internal/wait-metrics', filter)}`, {
    headers: { 'x-internal-api-key': INTERNAL_API_KEY }
  });

  if (!response.ok) {
    throw new Error(`Queue metrics failed: ${response.status}`);
  }

  return response.json();
}

async function dataRequest(path) {
  const response = await fetch(`${DATA_SERVICE_URL}${path}`, {
    headers: { 'x-internal-api-key': INTERNAL_API_KEY }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Data service error ${response.status}: ${text}`);
  }

  return response.json();
}

async function refreshSession(sid, session) {
  if (!session || !session.user || !session.user.id) {
    await redis.del(`session:${sid}`);
    const error = new Error('Invalid session');
    error.status = 401;
    throw error;
  }

  const currentUser = await dataRequest(`/internal/users/${session.user.id}`);
  const refreshed = {
    ...session,
    user: currentUser,
    lastSeenAt: new Date().toISOString()
  };

  await redis.set(`session:${sid}`, JSON.stringify(refreshed), 'EX', SESSION_TTL_SECONDS);
  return refreshed;
}

async function pushQueueStateToClient(client) {
  const snapshot = await fetchQueueSnapshot(client.filter);
  const metrics = await fetchQueueMetrics(client.filter);
  sendSse(client.res, 'queueUpdated', snapshot);
  sendSse(client.res, 'queueMetrics', metrics);
}

async function broadcastQueueState() {
  const clients = Array.from(queueClients);

  await Promise.all(clients.map(async function(client) {
    try {
      await pushQueueStateToClient(client);
    } catch (error) {
      sendSse(client.res, 'error', { message: error.message });
    }
  }));
}

async function requireSession(req, res, next) {
  try {
    const sid = req.cookies.sid;

    if (!sid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const raw = await redis.get(`session:${sid}`);

    if (!raw) {
      return res.status(401).json({ error: 'Session expired or missing' });
    }

    const session = JSON.parse(raw);
    const refreshedSession = await refreshSession(sid, session);
    req.session = refreshedSession;
    req.user = refreshedSession.user;
    next();
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ error: error.message || 'Not authenticated' });
    }
    next(error);
  }
}

function requireRole(...roles) {
  return function(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

app.get('/health', function(req, res) {
  res.json({ status: 'ok', service: 'notifications-service' });
});

app.get('/events/teachers', requireSession, requireRole('TEACHER', 'ADMIN'), function(req, res) {
  initSse(res);
  teacherClients.add(res);

  req.on('close', function() {
    teacherClients.delete(res);
  });
});

app.get('/events/queue', requireSession, async function(req, res) {
  initSse(res);

  const client = {
    res,
    filter: parseRoomFilter(req.query)
  };

  queueClients.add(client);

  try {
    const snapshot = await fetchQueueSnapshot(client.filter);
    const metrics = await fetchQueueMetrics(client.filter);

    sendSse(res, 'queueSnapshot', snapshot);
    sendSse(res, 'queueMetrics', metrics);
  } catch (error) {
    sendSse(res, 'error', { message: error.message });
  }

  req.on('close', function() {
    queueClients.delete(client);
  });
});

app.get('/events/students/:studentId', requireSession, function(req, res) {
  const studentId = String(req.params.studentId);

  if (req.user.role !== 'ADMIN' && String(req.user.id) !== studentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  initSse(res);

  if (!studentClients.has(studentId)) {
    studentClients.set(studentId, new Set());
  }

  const set = studentClients.get(studentId);
  set.add(res);

  req.on('close', function() {
    set.delete(res);

    if (set.size === 0) {
      studentClients.delete(studentId);
    }
  });
});

app.get('/queue/live', requireSession, function(req, res) {
  res.type('html').send(renderQueueLivePage());
});

app.get('/student/live/:studentId', requireSession, function(req, res) {
  const studentId = String(req.params.studentId);

  if (req.user.role !== 'ADMIN' && String(req.user.id) !== studentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.type('html').send(`
<!DOCTYPE html>
<html>
  <head>
    <title>Student Notifications</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 24px;
        background: #f8fafc;
      }

      #messages {
        margin-top: 20px;
      }

      .item {
        background: white;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 12px;
      }

      dialog {
        border: none;
        border-radius: 14px;
        width: 420px;
        max-width: 90vw;
      }

      textarea,
      select,
      button {
        width: 100%;
        margin-top: 10px;
        padding: 10px;
      }
    </style>
  </head>
  <body>
    <h1>Student Ticket Updates</h1>
    <p>This page receives real-time notifications and shows a feedback popup after completion.</p>
    <div id="messages"></div>

    <dialog id="feedbackDialog">
      <form id="feedbackForm" method="dialog">
        <h2>Submit Feedback</h2>
        <p id="feedbackText"></p>

        <label>Rating</label>
        <select id="rating" required>
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Good</option>
          <option value="3">3 - Average</option>
          <option value="2">2 - Poor</option>
          <option value="1">1 - Very Poor</option>
        </select>

        <label>Comment</label>
        <textarea id="comment" maxlength="500" placeholder="Share your feedback"></textarea>

        <button type="submit">Submit feedback</button>
      </form>
    </dialog>

    <script>
      const studentId = ${JSON.stringify(studentId)};
      const messages = document.getElementById('messages');
      const dialog = document.getElementById('feedbackDialog');
      const form = document.getElementById('feedbackForm');
      const feedbackText = document.getElementById('feedbackText');
      let activeTicketId = null;

      function appendMessage(text) {
        const div = document.createElement('div');
        div.className = 'item';
        div.textContent = text;
        messages.prepend(div);
      }

      const stream = new EventSource('/events/students/' + studentId);

      stream.addEventListener('studentNotification', function(event) {
        const payload = JSON.parse(event.data);
        appendMessage(payload.message);
      });

      stream.addEventListener('feedbackRequested', function(event) {
        const payload = JSON.parse(event.data);
        activeTicketId = payload.ticket.id;
        feedbackText.textContent = 'Please rate your completed ticket for ' + payload.ticket.courseLabel + ' with ' + payload.ticket.teacherName + '.';
        dialog.showModal();
      });

      form.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!activeTicketId) {
          return;
        }

        const response = await fetch('/tickets/' + activeTicketId + '/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            rating: Number(document.getElementById('rating').value),
            comment: document.getElementById('comment').value
          })
        });

        if (response.ok) {
          appendMessage('Feedback submitted successfully.');
          dialog.close();
          activeTicketId = null;
        } else {
          const body = await response.json().catch(function() {
            return { error: 'Failed to submit feedback' };
          });

          appendMessage(body.error || 'Failed to submit feedback');
        }
      });
    </script>
  </body>
</html>
  `);
});

subscriber.subscribe('ticket-events');

subscriber.on('message', async function(channel, message) {
  try {
    const event = JSON.parse(message);

    for (const client of teacherClients) {
      sendSse(client, 'teacherNotification', event);
    }

    await broadcastQueueState();

    if (event.type === 'TICKET_ASSIGNED') {
      const studentId = String(event.payload.studentId);
      const clients = studentClients.get(studentId) || [];

      for (const client of clients) {
        sendSse(client, 'studentNotification', {
          message: `${event.payload.teacherName} accepted your ticket.`,
          ticket: event.payload
        });
      }
    }

    if (event.type === 'TICKET_COMPLETED') {
      const studentId = String(event.payload.studentId);
      const clients = studentClients.get(studentId) || [];

      for (const client of clients) {
        sendSse(client, 'studentNotification', {
          message: `${event.payload.teacherName} completed your ticket. Please submit feedback.`,
          ticket: event.payload
        });

        sendSse(client, 'feedbackRequested', {
          message: 'Please submit feedback for your completed ticket.',
          ticket: event.payload
        });
      }
    }
  } catch (error) {
    console.error('Redis message handler failed', error);
  }
});

setInterval(function() {
  broadcastQueueState().catch(function(error) {
    console.error('Queue refresh interval failed', error);
  });
}, 30000);

app.use(function(error, req, res, next) {
  console.error(error);
  res.status(500).json({ error: error.message || 'Internal server error' });
});

app.listen(PORT, SERVICE_HOST, function() {
  console.log(`notifications-service listening on ${SERVICE_HOST}:${PORT}`);
});
