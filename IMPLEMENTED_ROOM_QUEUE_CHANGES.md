Implemented room-scoped queue updates for ThinkQ.

What changed:
- Live queue page now supports building and room dropdown selection.
- Queue SSE updates are scoped to the selected room.
- Teacher dashboard now requires selecting an active building and room before going online.
- Teacher active room is stored server-side in Redis with TTL + heartbeat refresh.
- Room-specific teacher counts and estimated wait time are computed from active teacher presence in that room.
- Teachers can only accept queued tickets from their currently active room.
- Student dashboard queue metrics now follow the selected room.
- Frontend build script was updated so npm run build works reliably in this project snapshot.

Primary files changed intentionally:
- work_backend/tickets-service/src/server.js
- work_backend/notifications-service/src/server.js
- thinkq-frontend-fixed-aligned/src/lib/api.js
- thinkq-frontend-fixed-aligned/src/pages/TeacherDashboardPage.jsx
- thinkq-frontend-fixed-aligned/src/pages/StudentDashboardPage.jsx
- thinkq-frontend-fixed-aligned/package.json
- thinkq-frontend-fixed-aligned/dist/* (rebuilt frontend)
