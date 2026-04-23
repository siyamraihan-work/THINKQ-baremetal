# ThinkQ Backend Services

This package contains the backend services used by ThinkQ in the bare-metal Amazon Linux 2023 deployment.

## Services

- `auth-user-service` — SAML login, session cookie lifecycle, current user lookup, logout, dev login
- `admin-service` — role, course, building, room, and location management
- `tickets-service` — student tickets, teacher claim/complete flow, queue metrics, room activation
- `notifications-service` — SSE streams, live queue page, student feedback events
- `analytics-service` — admin analytics dashboard and export ZIP generation
- `data-service` — Spring Boot persistence service backed by PostgreSQL

## Runtime topology

- Nginx is the only public entry point.
- Backend services listen on localhost only.
- Services communicate with each other over localhost HTTP plus Valkey for session/pub-sub behavior.
- The data service is the persistence boundary for application state.

## Not included in this package

- Docker Compose deployment files
- Kubernetes manifests
- local runtime secrets
- prebuilt local dependency directories

## Production gaps you may still want later

- database migration tooling
- CSRF strategy for browser write operations
- rate limiting
- centralized tracing / metrics / logs
- stronger secret management via AWS Systems Manager Parameter Store or Secrets Manager
