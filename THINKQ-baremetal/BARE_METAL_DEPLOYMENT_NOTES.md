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
- Added University of Arizona SAML defaults, SP metadata output, and the current UA IdP signing certificate.
- Hardened production auth defaults so missing internal API keys, insecure cookies, or enabled dev auth fail at startup.
- Updated session authorization so role changes are reflected on active sessions.
- Updated Nginx to serve plain HTTP on port `80` behind the AWS ALB, which terminates public HTTPS/TLS on its `443` listener.
- Fixed the Java service config so `SERVER_PORT` can override the default port.
- Fixed the Java service config so `SERVER_ADDRESS` can bind the data service to localhost.
- Fixed the frontend dev proxy to point at the real local service ports.
- Simplified frontend npm scripts so they do not depend on a packaged `node_modules` path.

## Architecture kept intact

- React frontend
- Node.js auth/admin/tickets/notifications services
- Java 21 Spring Boot data service
- Python FastAPI analytics service
- Nginx as instance reverse proxy behind the AWS ALB
- local Redis-compatible cache/session broker
- PostgreSQL / Aurora PostgreSQL data store
