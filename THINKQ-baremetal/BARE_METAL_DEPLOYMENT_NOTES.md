# THINKQ bare-metal deployment notes

This package has been realigned for **Amazon Linux 2023**.

## Main fixes applied

- Removed packaged junk such as local `node_modules`, virtualenvs, Java `target/`, `.git`, and local runtime env files.
- Standardized every deployment path to the real project layout:
  - `frontend/`
  - `backend/`
- Reworked systemd units to use `/opt/thinkq/frontend` and `/opt/thinkq/backend`.
- Reworked Nginx config to serve `/opt/thinkq/frontend/dist`.
- Updated docs and scripts for Amazon Linux 2023 package management and host layout.
- Replaced old Ubuntu-style and `sites-available` instructions with Amazon Linux / RHEL-style deployment.
- Fixed broken example values such as the duplicated `SAML_CERT_PATH`.
- Fixed the Java service config so `SERVER_PORT` can override the default port.
- Fixed the frontend dev proxy to point at the real local service ports.
- Simplified frontend npm scripts so they do not depend on a packaged `node_modules` path.

## Architecture kept intact

- React frontend
- Node.js auth/admin/tickets/notifications services
- Java 21 Spring Boot data service
- Python FastAPI analytics service
- Nginx as public reverse proxy
- local Redis-compatible cache/session broker
- PostgreSQL / Aurora PostgreSQL data store
