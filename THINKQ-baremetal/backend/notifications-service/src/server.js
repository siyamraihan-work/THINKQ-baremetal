import express from 'express';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import fetch from 'node-fetch';
import { PORT, REDIS_URL, TICKETS_SERVICE_URL, INTERNAL_API_KEY } from './settings.js';

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

    await redis.expire(`session:${sid}`, SESSION_TTL_SECONDS);

    const session = JSON.parse(raw);
    req.session = session;
    req.user = session.user;
    next();
  } catch (error) {
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
  res.type('html').send(`
<!DOCTYPE html>
<html>
  <head>
    <title>Live Queue Board</title>
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        min-height: 100%;
      }

      body {
        font-family: Arial, sans-serif;
        color: #e8f0ff;
        background:
          radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.20), transparent 28%),
          radial-gradient(circle at 100% 0%, rgba(34, 197, 94, 0.12), transparent 24%),
          radial-gradient(circle at 50% 100%, rgba(59, 130, 246, 0.10), transparent 36%),
          linear-gradient(180deg, #09111f 0%, #0b1220 45%, #0f172a 100%);
        padding: 26px;
      }

      .page {
        max-width: 1500px;
        margin: 0 auto;
      }

      .hero {
        display: flex;
        justify-content: space-between;
        align-items: stretch;
        gap: 18px;
        margin-bottom: 22px;
      }

      .hero-main {
        flex: 1;
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.94));
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 28px;
        padding: 24px 28px;
        box-shadow: 0 24px 50px rgba(0, 0, 0, 0.25);
      }

      .hero-title {
        margin: 0;
        font-size: 46px;
        line-height: 1;
        font-weight: 900;
        color: #ffffff;
        letter-spacing: -0.03em;
      }

      .hero-subtitle {
        margin: 12px 0 0 0;
        color: #9fb2cf;
        font-size: 17px;
      }

      .hero-side {
        width: 360px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .panel {
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.90), rgba(30, 41, 59, 0.92));
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 24px;
        padding: 18px 20px;
        box-shadow: 0 22px 48px rgba(0, 0, 0, 0.22);
      }

      .live-panel {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }

      .live-pill {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 15px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.22);
        color: #d9ffe7;
        font-size: 14px;
        font-weight: bold;
      }

      .live-dot {
        width: 20px;
        height: 12px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 14px rgba(34, 197, 94, 0.88);
        animation: livePulse 2.4s ease-in-out infinite;
      }

      @keyframes livePulse {
        0% {
          opacity: 0.35;
          transform: scale(1);
        }
        50% {
          opacity: 1;
          transform: scale(1.12);
        }
        100% {
          opacity: 0.35;
          transform: scale(1);
        }
      }

      .clock-label {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #8fb9ff;
        font-weight: bold;
        margin-bottom: 8px;
      }

      .clock-value {
        font-size: 34px;
        line-height: 1;
        font-weight: 900;
        color: #ffffff;
      }

      .date-value {
        margin-top: 8px;
        color: #b8c7dd;
        font-size: 15px;
      }

      .change-button {
        border: none;
        background: linear-gradient(180deg, #2563eb, #1d4ed8);
        color: white;
        font-size: 14px;
        font-weight: bold;
        padding: 11px 16px;
        border-radius: 12px;
        cursor: pointer;
        box-shadow: 0 10px 22px rgba(37, 99, 235, 0.24);
      }

      .change-button:hover {
        background: linear-gradient(180deg, #3b82f6, #2563eb);
      }

      .hidden {
        display: none !important;
      }

      .status-line {
        margin-bottom: 18px;
        color: #cad7eb;
        font-size: 15px;
      }

      .filter-panel {
        background: rgba(15, 23, 42, 0.76);
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 24px;
        padding: 18px;
        margin-bottom: 22px;
        box-shadow: 0 20px 44px rgba(0, 0, 0, 0.22);
        backdrop-filter: blur(10px);
      }

      .filter-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 260px;
        gap: 14px;
        align-items: end;
      }

      .field {
        background: rgba(30, 41, 59, 0.74);
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 18px;
        padding: 14px;
      }

      .field label {
        display: block;
        color: #8fb9ff;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 8px;
        font-weight: bold;
      }

      .field select {
        width: 100%;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #475569;
        border-radius: 12px;
        padding: 12px;
        font-size: 15px;
        outline: none;
      }

      .apply-button {
        width: 100%;
        border: none;
        background: linear-gradient(180deg, #22c55e, #16a34a);
        color: white;
        font-size: 16px;
        font-weight: bold;
        padding: 15px;
        border-radius: 15px;
        cursor: pointer;
        box-shadow: 0 14px 28px rgba(34, 197, 94, 0.24);
      }

      .apply-button:hover {
        background: linear-gradient(180deg, #4ade80, #22c55e);
      }

      .room-summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        background: linear-gradient(135deg, rgba(23, 37, 84, 0.94), rgba(30, 41, 59, 0.94));
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 24px;
        padding: 20px 22px;
        margin-bottom: 22px;
        box-shadow: 0 20px 44px rgba(0, 0, 0, 0.22);
      }

      .room-summary-label {
        color: #93c5fd;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 8px;
        font-weight: bold;
      }

      .room-summary-value {
        font-size: 28px;
        font-weight: 900;
        color: #ffffff;
        letter-spacing: -0.02em;
      }

      .room-summary-tag {
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.16);
        color: #bfdbfe;
        font-size: 13px;
        font-weight: bold;
        white-space: nowrap;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
        margin-bottom: 26px;
      }

      .metric-card {
        position: relative;
        overflow: hidden;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 20px 44px rgba(0, 0, 0, 0.22);
      }

      .metric-card::after {
        content: '';
        position: absolute;
        right: -28px;
        bottom: -28px;
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: rgba(96, 165, 250, 0.08);
      }

      .metric-label {
        color: #9fc7ff;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.09em;
        font-weight: bold;
      }

      .metric-value {
        margin-top: 12px;
        font-size: 48px;
        font-weight: 900;
        color: #ffffff;
        line-height: 1;
        letter-spacing: -0.03em;
      }

      .metric-value-small {
        font-size: 36px;
      }

      .queue-topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
      }

      .queue-section-title {
        margin: 0;
        font-size: 24px;
        color: #ffffff;
        letter-spacing: -0.01em;
      }

      .queue-count-pill {
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(30, 41, 59, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.16);
        color: #cfe0ff;
        font-size: 14px;
        font-weight: bold;
      }

      .queue-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 18px;
      }

      .ticket {
        position: relative;
        overflow: hidden;
        background: linear-gradient(180deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 24px;
        padding: 22px;
        min-height: 148px;
        display: flex;
        gap: 18px;
        align-items: center;
        box-shadow: 0 20px 44px rgba(0, 0, 0, 0.20);
        transform: translateY(0);
        transition: transform 0.25s ease, box-shadow 0.25s ease;
      }

      .ticket:hover {
        transform: translateY(-3px);
        box-shadow: 0 26px 52px rgba(0, 0, 0, 0.26);
      }

      .position-badge {
        width: 68px;
        min-width: 68px;
        height: 68px;
        border-radius: 20px;
        background: linear-gradient(180deg, #1d4ed8, #1e40af);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        font-weight: 900;
        box-shadow: 0 16px 28px rgba(37, 99, 235, 0.28);
      }

      .ticket-body {
        flex: 1;
        min-width: 0;
      }

      .ticket-label {
        font-size: 12px;
        color: #8fb9ff;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: bold;
        margin-bottom: 10px;
      }

      .student-name {
        width: 100%;
        font-size: 32px;
        font-weight: 900;
        line-height: 1.1;
        color: #ffffff;
        word-break: break-word;
        letter-spacing: -0.02em;
      }

      .empty-state {
        background: rgba(30, 41, 59, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 24px;
        padding: 34px;
        color: #dbe7ff;
        font-size: 19px;
        text-align: center;
        box-shadow: 0 20px 42px rgba(0, 0, 0, 0.18);
      }

      .footer-note {
        margin-top: 16px;
        color: #8ea3c2;
        font-size: 13px;
        text-align: right;
      }

      @media (max-width: 1200px) {
        .hero {
          flex-direction: column;
        }

        .hero-side {
          width: 100%;
          flex-direction: row;
        }

        .hero-side .panel {
          flex: 1;
        }
      }

      @media (max-width: 980px) {
        .filter-grid,
        .metrics,
        .hero-side {
          grid-template-columns: 1fr;
          display: grid;
        }

        .room-summary {
          flex-direction: column;
          align-items: flex-start;
        }

        .hero-title {
          font-size: 38px;
        }
      }

      @media (max-width: 700px) {
        body {
          padding: 18px;
        }

        .hero-main,
        .panel,
        .metric-card,
        .ticket,
        .room-summary,
        .filter-panel {
          border-radius: 20px;
        }

        .hero-title {
          font-size: 30px;
        }

        .clock-value {
          font-size: 28px;
        }

        .metric-value {
          font-size: 38px;
        }

        .student-name {
          font-size: 26px;
        }

        .queue-list {
          grid-template-columns: 1fr;
        }

        .ticket {
          min-height: 128px;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="hero">
        <div class="hero-main">
          <h1 class="hero-title">THINKQ</h1>
        </div>

        <div class="hero-side">
          <div class="panel live-panel">
            <div class="live-pill">
              <span class="live-dot"></span>
              <span>Live & Online</span>
            </div>
            <button id="showControlsButton" class="change-button hidden" type="button">Change Room</button>
          </div>

          <div class="panel">
            <div class="clock-label">Current Time</div>
            <div id="clockValue" class="clock-value">--:--:--</div>
            <div id="dateValue" class="date-value">Loading date...</div>
          </div>
        </div>
      </div>

      <div id="roomStatus" class="status-line">Loading room list...</div>

      <div id="filterPanel" class="filter-panel">
        <div class="filter-grid">
          <div class="field">
            <label for="buildingSelect">Building</label>
            <select id="buildingSelect"></select>
          </div>

          <div class="field">
            <label for="roomSelect">Room</label>
            <select id="roomSelect"></select>
          </div>

          <div>
            <button id="applyRoomButton" class="apply-button" type="button">Open Live Queue</button>
          </div>
        </div>
      </div>

      <div id="roomSummary" class="room-summary hidden">
        <div>
          <div class="room-summary-label">Current live room</div>
          <div id="roomSummaryValue" class="room-summary-value">--</div>
        </div>
        <div class="room-summary-tag">Real-Time Queue View</div>
      </div>

      <div class="metrics">
        <div class="metric-card">
          <div class="metric-label">Tutors online</div>
          <div id="onlineTeachers" class="metric-value">--</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Students waiting</div>
          <div id="waitingCount" class="metric-value">--</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Estimated wait time</div>
          <div id="waitTime" class="metric-value metric-value-small">Unavailable</div>
        </div>
      </div>

      <div class="queue-topbar">
        <h2 class="queue-section-title">Current Queue</h2>
        <div id="queueCountPill" class="queue-count-pill">0 students in queue</div>
      </div>

      <div id="queue" class="queue-list"></div>
    </div>

    <script>
      const queueDiv = document.getElementById('queue');
      const roomStatus = document.getElementById('roomStatus');
      const buildingSelect = document.getElementById('buildingSelect');
      const roomSelect = document.getElementById('roomSelect');
      const onlineTeachers = document.getElementById('onlineTeachers');
      const waitingCount = document.getElementById('waitingCount');
      const waitTime = document.getElementById('waitTime');
      const filterPanel = document.getElementById('filterPanel');
      const roomSummary = document.getElementById('roomSummary');
      const roomSummaryValue = document.getElementById('roomSummaryValue');
      const showControlsButton = document.getElementById('showControlsButton');
      const applyRoomButton = document.getElementById('applyRoomButton');
      const clockValue = document.getElementById('clockValue');
      const dateValue = document.getElementById('dateValue');
      const queueCountPill = document.getElementById('queueCountPill');

      const initialParams = new URLSearchParams(window.location.search);
      let lookups = { locations: [] };
      let stream = null;

      let activeFilter = {
        buildingId: initialParams.get('buildingId') || '',
        roomId: initialParams.get('roomId') || ''
      };

      function buildUniqueBuildings(locations) {
        const seen = new Map();

        locations.forEach(function(location) {
          if (!location || !location.buildingId) {
            return;
          }

          if (!seen.has(String(location.buildingId))) {
            seen.set(String(location.buildingId), {
              id: String(location.buildingId),
              name: location.buildingName
            });
          }
        });

        return Array.from(seen.values()).sort(function(a, b) {
          return a.name.localeCompare(b.name);
        });
      }

      function buildUniqueRooms(locations, buildingId) {
        const seen = new Map();

        locations.forEach(function(location) {
          if (String(location.buildingId) !== String(buildingId) || !location.roomId) {
            return;
          }

          if (!seen.has(String(location.roomId))) {
            seen.set(String(location.roomId), {
              id: String(location.roomId),
              name: String(location.roomName)
            });
          }
        });

        return Array.from(seen.values()).sort(function(a, b) {
          return a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: 'base'
          });
        });
      }

      function renderOptions(select, options, value) {
        select.innerHTML = '';

        options.forEach(function(option) {
          const element = document.createElement('option');
          element.value = option.id;
          element.textContent = option.name;

          if (String(option.id) === String(value)) {
            element.selected = true;
          }

          select.appendChild(element);
        });

        if (!select.value && options.length) {
          select.value = options[0].id;
        }
      }

      function getCurrentFilter() {
        return {
          buildingId: buildingSelect.value,
          roomId: roomSelect.value
        };
      }

      function getSelectedRoomText() {
        const buildingOption = buildingSelect.options[buildingSelect.selectedIndex];
        const roomOption = roomSelect.options[roomSelect.selectedIndex];

        if (!buildingOption || !roomOption) {
          return '';
        }

        return buildingOption.textContent + ' / Room ' + roomOption.textContent;
      }

      function hideFilterPanel() {
        filterPanel.classList.add('hidden');
        showControlsButton.classList.remove('hidden');
      }

      function showFilterPanel() {
        filterPanel.classList.remove('hidden');
        showControlsButton.classList.add('hidden');
      }

      function updateRoomStatus() {
        const text = getSelectedRoomText();

        if (!text) {
          roomStatus.textContent = 'No active rooms are available yet.';
          return;
        }
      }

      function updateRoomSummary() {
        const text = getSelectedRoomText();

        if (!text) {
          roomSummary.classList.add('hidden');
          return;
        }

        roomSummaryValue.textContent = text;
        roomSummary.classList.remove('hidden');
      }

      function updateClock() {
        const now = new Date();

        clockValue.textContent = now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        dateValue.textContent = now.toLocaleDateString([], {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }

      function updateQueueCount(count) {
        if (count === 1) {
          queueCountPill.textContent = '1 student in queue';
        } else {
          queueCountPill.textContent = count + ' students in queue';
        }
      }

      function render(queue) {
        queueDiv.innerHTML = '';
        updateQueueCount(queue.length);

        if (!queue.length) {
          queueDiv.innerHTML = '<div class="empty-state">No students are currently waiting in this room.</div>';
          return;
        }

        queue.forEach(function(ticket, index) {
          const card = document.createElement('div');
          card.className = 'ticket';
          card.innerHTML =
            '<div class="position-badge">' + (index + 1) + '</div>' +
            '<div class="ticket-body">' +
              '<div class="ticket-label">Queue Position</div>' +
              '<div class="student-name">' + ticket.studentName + '</div>' +
            '</div>';

          queueDiv.appendChild(card);
        });
      }

      function renderMetrics(metrics) {
        onlineTeachers.textContent = metrics.onlineTeacherCount;
        waitingCount.textContent = metrics.queueCount;

        if (metrics.onlineTeacherCount > 0) {
          waitTime.textContent = metrics.estimatedWaitMinutes + ' min';
        } else {
          waitTime.textContent = 'Unavailable';
        }
      }

      function resetMetrics() {
        onlineTeachers.textContent = '--';
        waitingCount.textContent = '--';
        waitTime.textContent = 'Unavailable';
        updateQueueCount(0);
      }

      function connectStream() {
        if (stream) {
          stream.close();
        }

        const params = new URLSearchParams(activeFilter);
        window.history.replaceState({}, '', '/queue/live?' + params.toString());

        stream = new EventSource('/events/queue?' + params.toString());

        stream.addEventListener('queueSnapshot', function(event) {
          render(JSON.parse(event.data));
        });

        stream.addEventListener('queueUpdated', function(event) {
          render(JSON.parse(event.data));
        });

        stream.addEventListener('queueMetrics', function(event) {
          renderMetrics(JSON.parse(event.data));
        });

        stream.addEventListener('error', function(event) {
          if (event && event.data) {
            try {
              const payload = JSON.parse(event.data);
              roomStatus.textContent = payload.message || 'Queue stream error';
            } catch (error) {
              roomStatus.textContent = 'Queue stream error';
            }
          }
        });
      }

      function syncRoomsForBuilding(preferredRoomId) {
        const rooms = buildUniqueRooms(lookups.locations, buildingSelect.value);
        renderOptions(roomSelect, rooms, preferredRoomId || '');

        if (!rooms.length) {
          roomStatus.textContent = 'No rooms are available in this building.';
          roomSummary.classList.add('hidden');
          queueDiv.innerHTML = '<div class="empty-state">No active rooms were found for this building.</div>';
          resetMetrics();
          return;
        }

        updateRoomStatus();
        updateRoomSummary();
      }

      function applySelection() {
        const filter = getCurrentFilter();

        if (!filter.buildingId || !filter.roomId) {
          roomStatus.textContent = 'Please select both building and room.';
          return;
        }

        activeFilter = filter;
        hideFilterPanel();
        updateRoomStatus();
        updateRoomSummary();
        connectStream();
      }

      async function loadLookups() {
        const response = await fetch('/tickets/lookups', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Unable to load room lookups.');
        }

        lookups = await response.json();

        const buildings = buildUniqueBuildings(lookups.locations || []);
        renderOptions(buildingSelect, buildings, activeFilter.buildingId);

        if (!buildings.length) {
          roomStatus.textContent = 'No buildings are available yet.';
          queueDiv.innerHTML = '<div class="empty-state">No building data is available yet.</div>';
          resetMetrics();
          return;
        }

        syncRoomsForBuilding(activeFilter.roomId);

        if (activeFilter.buildingId && activeFilter.roomId) {
          hideFilterPanel();
          updateRoomStatus();
          updateRoomSummary();
          connectStream();
        } else {
          showFilterPanel();
          updateRoomStatus();
        }
      }

      buildingSelect.addEventListener('change', function() {
        syncRoomsForBuilding('');
      });

      roomSelect.addEventListener('change', function() {
        updateRoomStatus();
        updateRoomSummary();
      });

      applyRoomButton.addEventListener('click', function() {
        applySelection();
      });

      showControlsButton.addEventListener('click', function() {
        showFilterPanel();
      });

      updateClock();
      setInterval(updateClock, 1000);

      loadLookups().catch(function(error) {
        roomStatus.textContent = error.message || 'Unable to load live queue.';
        queueDiv.innerHTML = '<div class="empty-state">Unable to load live queue right now.</div>';
        resetMetrics();
      });

      window.addEventListener('beforeunload', function() {
        if (stream) {
          stream.close();
        }
      });
    </script>
  </body>
</html>
  `);
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

app.listen(PORT, function() {
  console.log(`notifications-service listening on ${PORT}`);
});
