# Helpdesk Queue Platform

A polyglot microservices starter platform for a tutoring/helpdesk queue.

## Stack

- **Nginx** reverse proxy
- **Node.js + Express** for external APIs, schema validation, cookies, business workflows
- **Java 21 + Spring Boot + Hibernate/JPA** for persistent data access
- **PostgreSQL** as the system of record
- **Redis** for sessions, cache, pub/sub, and lightweight real-time fanout
- **Python + FastAPI** for admin-only analytics export
- **Docker Compose** for local development
- **Kubernetes manifests** for container orchestration

## Services

- `auth-user-service`
  Handles SAML login, session cookies, current user lookup, logout, and user profile access.

- `admin-service`
  Admin-only APIs for role assignment, course management, and location management.

- `tickets-service`
  Student ticket creation, teacher acceptance/completion, student feedback submission, queue listing, and event publishing.

- `notifications-service`
  Redis pub/sub listener, SSE endpoints for teachers/students/TV dashboard, live queue page, and feedback popup event delivery.

- `analytics-service`
  Python FastAPI service. Admin-only. Reads active session from Redis and returns ticket analytics as JSON or CSV.

- `data-service`
  Java persistence service with JPA/Hibernate + PostgreSQL.

## SAML mapping updated for your IdP metadata

The auth service now reads the attributes you showed from the ACS page:

- **Email**: `NameID` or `urn:oid:0.9.2342.19200300.100.1.3`
- **OID / institutional unique ID**: `urn:oid:1.3.6.1.4.1.5643.10.0.1`
- **Username fallback**: `urn:oid:0.9.2342.19200300.100.1.1`
- **Display name**: `urn:oid:2.5.4.3` or `urn:oid:2.16.840.1.113730.3.1.241`
- **First name / last name fallback**: `urn:oid:2.5.4.42` and `urn:oid:2.5.4.4`

## Main functional flows

### Authentication
1. Browser hits `/auth/login`.
2. If no valid `sid` cookie exists, the service redirects to the IdP via SAML.
3. IdP posts SAML assertion to `/auth/saml/callback`.
4. Service extracts `email`, `name`, and `oid` using the mapping above.
5. User is upserted in `data-service`.
6. Session is created in Redis and persisted in PostgreSQL.
7. Cookie `sid` is returned as `HttpOnly`.
8. After successful SAML login, the browser is redirected back to the frontend route defined by `FRONTEND_BASE_URL + POST_LOGIN_PATH` instead of raw JSON from `/users/me`.

### Ticket lifecycle
1. Student submits ticket.
2. `tickets-service` validates input with Zod.
3. Ticket is persisted through `data-service`.
4. Event is published to Redis.
5. `notifications-service` pushes:
   - broadcast to logged-in teachers
   - queue update to TV clients
   - student-specific update when teacher accepts ticket
   - feedback popup request after ticket completion
6. Student submits rating and comment after completion.

### Queue TV page
- Open `/queue/live`
- Uses Server-Sent Events
- Updates without page refresh when tickets are created, accepted, or completed

### Student live page
- Open `/student/live/{studentId}`
- Shows real-time notifications
- Opens a feedback popup after completion

### Admin analytics
- Open `/analytics/tickets`
- Requires an admin session cookie
- Returns ordered ticket rows with:
  - student name
  - topic (`CSC 337` style label)
  - status
  - rating
  - claim name
  - comments
  - date/sign-in time
  - claimed at
  - completed at
  - wait time
  - completion time
- CSV export available at `/analytics/tickets.csv`

## Security and enterprise considerations included

- Reverse proxy via Nginx
- Docker secrets pattern for sensitive values
- Kubernetes Secret manifests for deployment
- Role-based authorization in API services
- Central data service behind internal network boundary
- Redis-backed sessions and pub/sub
- Input validation with Zod and FastAPI validation
- Internal service API keys for internal routes
- Health endpoints
- Session-based admin-only analytics access

## Not included / placeholders you must wire up

- Real IdP metadata/certificates for SAML
- TLS certificates
- Production-grade observability stack (Prometheus/Grafana/ELK)
- Distributed tracing
- Durable event bus (Kafka/RabbitMQ) if you outgrow Redis pub/sub
- CSRF protection strategy for browser state-changing requests
- Rate limiting and WAF policy
- DB migration tooling like Flyway or Liquibase

## Local startup

```bash
cp .env.example .env
docker compose up --build
```

Then browse:

- `http://localhost/auth/login`
- `http://localhost/queue/live`
- `http://localhost/student/live/1`
- `http://localhost/analytics/tickets`

## Folder layout

```text
helpdesk-polyglot-platform/
  auth-user-service/
  admin-service/
  tickets-service/
  notifications-service/
  analytics-service/
  data-service/
  nginx/
  k8s/
  docker-compose.yml
```


## Analytics export and cleanup
- `POST /analytics/tickets/export` creates one Excel workbook per location, packages them into a single ZIP response for the admin device, and then purges the exported tickets from the database.
