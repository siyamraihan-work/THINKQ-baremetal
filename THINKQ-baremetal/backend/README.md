# ThinkQ Backend Services

This package contains the backend services used by ThinkQ in the bare-metal Amazon Linux 2023 deployment.

## Services

- `auth-user-service` - SAML login, session cookie lifecycle, current user lookup, logout, dev login
- `admin-service` - role, course, building, room, and location management
- `tickets-service` - student tickets, teacher claim/complete flow, queue metrics, room activation
- `notifications-service` - SSE streams, live queue page, student feedback events
- `analytics-service` - admin analytics dashboard and export ZIP generation
- `data-service` - Spring Boot persistence service backed by PostgreSQL

## Runtime topology

- Nginx is the only public entry point.
- Backend services listen on localhost only.
- Services communicate with each other over localhost HTTP plus Valkey for session/pub-sub behavior.
- The data service is the persistence boundary for application state.
- Auth defaults are aligned with the University of Arizona Shibboleth IdP metadata; production deployments should still set explicit SAML and internal API key values in `/opt/thinkq/env`.
- Browser sessions use an opaque `sid` cookie backed by Redis. Services refresh the current user from the data service on protected requests, so role changes take effect without waiting for the Redis session TTL.

## SAML and Sessions

- SP metadata is served by the auth service at `/auth/metadata`.
- The SAML assertion consumer service is `/auth/saml/callback` with HTTP-POST binding.
- The auth callback requires `email`, stable user ID, and display name attributes after normalization.
- SAML parsing and validation use the maintained `@node-saml/passport-saml` package.
- New users default to the `STUDENT` role until an admin promotes them.
- Dev login is only for local development with `DEV_AUTH_ENABLED=true`; production startup rejects that flag.

## Not Included

- Docker Compose deployment files
- Kubernetes manifests
- local runtime secrets
- prebuilt local dependency directories

## Production Gaps

- database migration tooling
- CSRF strategy for browser write operations
- rate limiting
- centralized tracing, metrics, and logs
- stronger secret management via AWS Systems Manager Parameter Store or Secrets Manager
