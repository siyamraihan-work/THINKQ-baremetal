# ThinkQ Frontend

This frontend is aligned to the real bare-metal layout in this package.

## Runtime paths used by the browser

- `/auth/*`
- `/users/*`
- `/admin/*`
- `/tickets/*`
- `/analytics/*`
- `/events/*`
- `/queue/*`
- `/student/live/*`

## Bare-metal production flow

The browser stays on one HTTPS origin served by host Nginx. Nginx serves the frontend build and reverse-proxies API and SSE traffic directly to the backend services on localhost.

## Local Vite development flow

The Vite dev server proxies requests to the real local service ports:

- `3001` auth-user-service
- `3002` admin-service
- `3003` tickets-service
- `3004` notifications-service
- `3005` analytics-service
