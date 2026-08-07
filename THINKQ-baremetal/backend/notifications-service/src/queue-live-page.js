export function renderQueueLivePage() {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ThinkQ Live Queue</title>
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
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #ffffff;
        line-height: 1.5;
        background:
          radial-gradient(circle at 16% 12%, rgba(77, 138, 255, 0.30), transparent 30%),
          radial-gradient(circle at 86% 84%, rgba(33, 96, 255, 0.24), transparent 28%),
          linear-gradient(135deg, #06102b 0%, #10246a 52%, #0a1b4a 100%);
        background-attachment: fixed;
        padding: 16px 16px 28px;
      }

      .board {
        max-width: 1360px;
        margin: 0 auto;
        display: grid;
        gap: 14px;
      }

      .glass {
        background: rgba(10, 22, 59, 0.62);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 22px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }

      .board-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 16px 20px;
      }

      .brand-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .brand {
        font-size: clamp(1.5rem, 3.4vw, 2.3rem);
        font-weight: 900;
        letter-spacing: 0.01em;
      }

      .board-subtitle {
        margin: 2px 0 0;
        color: rgba(255, 255, 255, 0.66);
        font-size: clamp(0.8rem, 1.6vw, 0.95rem);
      }

      .live-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid rgba(94, 234, 149, 0.35);
        background: rgba(16, 84, 48, 0.35);
        color: #b9f5cf;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.12em;
      }

      .live-dot {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: #2ee27a;
        box-shadow: 0 0 0 0 rgba(46, 226, 122, 0.5);
        animation: live-pulse 2.2s ease-in-out infinite;
      }

      @keyframes live-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(46, 226, 122, 0.45); }
        50% { box-shadow: 0 0 0 7px rgba(46, 226, 122, 0.08); }
      }

      .clock-block {
        text-align: right;
        flex: none;
      }

      .clock-time {
        font-size: clamp(1.35rem, 3.4vw, 2.1rem);
        font-weight: 900;
        font-variant-numeric: tabular-nums;
        line-height: 1.05;
      }

      .clock-date {
        margin-top: 2px;
        color: rgba(255, 255, 255, 0.62);
        font-size: clamp(0.72rem, 1.5vw, 0.9rem);
      }

      .eyebrow {
        display: inline-block;
        color: #9db8ff;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .picker-card {
        padding: 20px;
      }

      .picker-card h1 {
        margin: 6px 0 16px;
        font-size: clamp(1.25rem, 3.4vw, 1.7rem);
        letter-spacing: -0.01em;
      }

      .picker-grid {
        display: grid;
        gap: 12px;
      }

      .field span {
        display: block;
        margin-bottom: 7px;
        color: rgba(255, 255, 255, 0.72);
        font-size: 0.82rem;
        font-weight: 700;
      }

      .field select {
        width: 100%;
        appearance: none;
        -webkit-appearance: none;
        background:
          url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a9c0ff' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 16px center,
          rgba(6, 14, 38, 0.72);
        color: #f2f6ff;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 15px;
        padding: 14px 42px 14px 16px;
        font: inherit;
        font-size: 1rem;
        outline: none;
      }

      .field select:focus {
        border-color: #5f8dff;
        box-shadow: 0 0 0 4px rgba(63, 111, 255, 0.22);
      }

      .apply-button {
        border: none;
        border-radius: 15px;
        min-height: 52px;
        padding: 0 20px;
        background: linear-gradient(135deg, #1f5eff 0%, #0e43d1 100%);
        color: #ffffff;
        font: inherit;
        font-size: 1rem;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 16px 34px rgba(31, 94, 255, 0.35);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }

      .apply-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 20px 42px rgba(31, 94, 255, 0.45);
      }

      .status-line {
        margin-top: 12px;
        color: rgba(255, 255, 255, 0.62);
        font-size: 0.88rem;
      }

      .status-line:empty {
        display: none;
      }

      .room-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 16px 20px;
        background:
          linear-gradient(120deg, rgba(31, 94, 255, 0.30), rgba(10, 22, 59, 0.30)),
          rgba(10, 22, 59, 0.62);
      }

      .room-name {
        margin-top: 3px;
        font-size: clamp(1.1rem, 3.2vw, 1.6rem);
        font-weight: 900;
        letter-spacing: -0.01em;
        word-break: break-word;
      }

      .change-button {
        flex: none;
        border: 1px solid rgba(255, 255, 255, 0.24);
        background: rgba(255, 255, 255, 0.10);
        color: #ffffff;
        font: inherit;
        font-size: 0.88rem;
        font-weight: 700;
        padding: 10px 15px;
        border-radius: 12px;
        cursor: pointer;
      }

      .change-button:hover {
        background: rgba(255, 255, 255, 0.18);
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .metric-card {
        padding: 14px 12px;
        text-align: center;
      }

      .metric-label {
        color: #9db8ff;
        font-size: 0.66rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .metric-value {
        margin-top: 6px;
        font-size: clamp(1.7rem, 6vw, 3.1rem);
        font-weight: 900;
        line-height: 1;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }

      .metric-value.is-muted {
        color: rgba(255, 255, 255, 0.55);
        font-size: clamp(1.05rem, 3.6vw, 1.7rem);
        line-height: 1.5;
      }

      .queue-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 4px;
        padding: 0 4px;
      }

      .queue-head h2 {
        margin: 0;
        font-size: clamp(1.1rem, 3vw, 1.45rem);
        letter-spacing: -0.01em;
      }

      .count-pill {
        flex: none;
        padding: 7px 13px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.08);
        color: #dbe6ff;
        font-size: 0.8rem;
        font-weight: 800;
      }

      .queue-list {
        display: grid;
        gap: 10px;
      }

      .ticket {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        animation: ticket-in 0.35s ease;
      }

      @keyframes ticket-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .position-badge {
        flex: none;
        width: 50px;
        height: 50px;
        border-radius: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1f5eff, #0e43d1);
        font-size: 1.35rem;
        font-weight: 900;
        box-shadow: 0 12px 24px rgba(31, 94, 255, 0.35);
        font-variant-numeric: tabular-nums;
      }

      .ticket.is-first .position-badge {
        background: linear-gradient(135deg, #2ee27a, #0e9f56);
        box-shadow: 0 12px 24px rgba(34, 197, 94, 0.35);
      }

      .ticket-body {
        flex: 1;
        min-width: 0;
      }

      .student-name {
        font-size: clamp(1.1rem, 4vw, 1.6rem);
        font-weight: 850;
        line-height: 1.15;
        letter-spacing: -0.01em;
        word-break: break-word;
      }

      .ticket-course {
        display: inline-block;
        margin-top: 5px;
        padding: 3px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.09);
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: #c7d6ff;
        font-size: 0.76rem;
        font-weight: 700;
      }

      .up-next {
        flex: none;
        color: #8ef5b9;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .empty-state {
        padding: 34px 20px;
        text-align: center;
        color: rgba(255, 255, 255, 0.78);
        font-size: 1rem;
      }

      .board-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: rgba(255, 255, 255, 0.45);
        font-size: 0.8rem;
        padding: 2px 6px 0;
      }

      .back-link {
        color: #a9c0ff;
        text-decoration: none;
        font-weight: 700;
      }

      .back-link:hover {
        text-decoration: underline;
      }

      .hidden {
        display: none !important;
      }

      /* Tablet and up */
      @media (min-width: 700px) {
        body {
          padding: 26px 26px 40px;
        }

        .board {
          gap: 18px;
        }

        .picker-grid {
          grid-template-columns: 1fr 1fr auto;
          align-items: end;
        }

        .apply-button {
          min-height: 51px;
        }

        .metrics {
          gap: 16px;
        }

        .metric-card {
          padding: 22px 18px;
        }

        .queue-list {
          grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
          gap: 14px;
        }

        .ticket {
          padding: 18px 20px;
        }

        .position-badge {
          width: 62px;
          height: 62px;
          border-radius: 18px;
          font-size: 1.7rem;
        }
      }

      /* Large wallboard screens */
      @media (min-width: 1200px) {
        .board-top {
          padding: 22px 28px;
        }

        .picker-card,
        .room-banner {
          padding: 24px 28px;
        }
      }
    </style>
  </head>
  <body>
    <div class="board">
      <header class="board-top glass">
        <div>
          <div class="brand-row">
            <span class="brand">ThinkQ</span>
            <span class="live-pill"><span class="live-dot"></span>LIVE</span>
          </div>
          <p class="board-subtitle">Tutoring center live queue</p>
        </div>
        <div class="clock-block">
          <div id="clockValue" class="clock-time">--:--</div>
          <div id="dateValue" class="clock-date">&nbsp;</div>
        </div>
      </header>

      <section id="filterPanel" class="picker-card glass">
        <span class="eyebrow">Room picker</span>
        <h1>Choose a room to display</h1>
        <div class="picker-grid">
          <label class="field">
            <span>Building</span>
            <select id="buildingSelect"></select>
          </label>
          <label class="field">
            <span>Room</span>
            <select id="roomSelect"></select>
          </label>
          <button id="applyRoomButton" class="apply-button" type="button">Open live queue</button>
        </div>
        <div id="roomStatus" class="status-line">Loading rooms…</div>
      </section>

      <section id="roomSummary" class="room-banner glass hidden">
        <div>
          <span class="eyebrow">Now showing</span>
          <div id="roomSummaryValue" class="room-name">—</div>
        </div>
        <button id="showControlsButton" class="change-button" type="button">Change room</button>
      </section>

      <section class="metrics" aria-label="Queue metrics">
        <div class="metric-card glass">
          <div class="metric-label">Tutors online</div>
          <div id="onlineTeachers" class="metric-value">—</div>
        </div>
        <div class="metric-card glass">
          <div class="metric-label">Waiting</div>
          <div id="waitingCount" class="metric-value">—</div>
        </div>
        <div class="metric-card glass">
          <div class="metric-label">Est. wait</div>
          <div id="waitTime" class="metric-value is-muted">—</div>
        </div>
      </section>

      <div class="queue-head">
        <h2>Current queue</h2>
        <span id="queueCountPill" class="count-pill">0 waiting</span>
      </div>
      <div id="queue" class="queue-list"></div>

      <footer class="board-foot">
        <a class="back-link" href="/">&#8592; Back to ThinkQ</a>
        <span>Updates in real time</span>
      </footer>
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
      }

      function showFilterPanel() {
        filterPanel.classList.remove('hidden');
      }

      function updateRoomStatus() {
        const text = getSelectedRoomText();

        if (!text) {
          roomStatus.textContent = 'No active rooms are available yet.';
          return;
        }

        roomStatus.textContent = 'Ready to show ' + text + '.';
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
          minute: '2-digit'
        });

        dateValue.textContent = now.toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        });
      }

      function updateQueueCount(count) {
        queueCountPill.textContent = count === 1 ? '1 waiting' : count + ' waiting';
      }

      function render(queue) {
        queueDiv.innerHTML = '';
        updateQueueCount(queue.length);

        if (!queue.length) {
          const empty = document.createElement('div');
          empty.className = 'empty-state glass';
          empty.textContent = 'No students are currently waiting in this room.';
          queueDiv.appendChild(empty);
          return;
        }

        queue.forEach(function(ticket, index) {
          const card = document.createElement('div');
          card.className = index === 0 ? 'ticket glass is-first' : 'ticket glass';

          const badge = document.createElement('div');
          badge.className = 'position-badge';
          badge.textContent = String(index + 1);

          const body = document.createElement('div');
          body.className = 'ticket-body';

          const name = document.createElement('div');
          name.className = 'student-name';
          name.textContent = ticket.studentName || 'Student';
          body.appendChild(name);

          if (ticket.courseLabel) {
            const course = document.createElement('span');
            course.className = 'ticket-course';
            course.textContent = ticket.courseLabel;
            body.appendChild(course);
          }

          card.appendChild(badge);
          card.appendChild(body);

          if (index === 0) {
            const next = document.createElement('span');
            next.className = 'up-next';
            next.textContent = 'Up next';
            card.appendChild(next);
          }

          queueDiv.appendChild(card);
        });
      }

      function renderMetrics(metrics) {
        onlineTeachers.textContent = metrics.onlineTeacherCount;
        waitingCount.textContent = metrics.queueCount;

        if (metrics.onlineTeacherCount > 0) {
          waitTime.textContent = metrics.estimatedWaitMinutes + ' min';
          waitTime.classList.remove('is-muted');
        } else {
          waitTime.textContent = 'Unavailable';
          waitTime.classList.add('is-muted');
        }
      }

      function resetMetrics() {
        onlineTeachers.textContent = '—';
        waitingCount.textContent = '—';
        waitTime.textContent = '—';
        waitTime.classList.add('is-muted');
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
          queueDiv.innerHTML = '';
          const empty = document.createElement('div');
          empty.className = 'empty-state glass';
          empty.textContent = 'No active rooms were found for this building.';
          queueDiv.appendChild(empty);
          resetMetrics();
          return;
        }

        updateRoomStatus();
      }

      function applySelection() {
        const filter = getCurrentFilter();

        if (!filter.buildingId || !filter.roomId) {
          roomStatus.textContent = 'Please select both building and room.';
          return;
        }

        activeFilter = filter;
        hideFilterPanel();
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
          queueDiv.innerHTML = '';
          const empty = document.createElement('div');
          empty.className = 'empty-state glass';
          empty.textContent = 'No building data is available yet.';
          queueDiv.appendChild(empty);
          resetMetrics();
          return;
        }

        syncRoomsForBuilding(activeFilter.roomId);

        if (activeFilter.buildingId && activeFilter.roomId) {
          hideFilterPanel();
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
      });

      applyRoomButton.addEventListener('click', function() {
        applySelection();
      });

      showControlsButton.addEventListener('click', function() {
        showFilterPanel();
        updateRoomStatus();
      });

      updateClock();
      setInterval(updateClock, 30000);

      render([]);

      loadLookups().catch(function(error) {
        roomStatus.textContent = error.message || 'Unable to load live queue.';
        queueDiv.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'empty-state glass';
        empty.textContent = 'Unable to load the live queue right now.';
        queueDiv.appendChild(empty);
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
`;
}
