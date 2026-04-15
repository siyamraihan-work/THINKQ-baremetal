# THINKQ bare-metal requirements and cleanup

This package has been cleaned for **bare-metal Linux deployment**. Docker, Kubernetes, tracked secrets, local build output, and editor junk have been removed.

## Runtime requirements

- Ubuntu/Debian-style Linux machine or equivalent
- Nginx with HTTPS support
- Node.js 20+
- npm 10+
- Python 3.11+ with `venv`
- Java 21
- Maven 3.9+
- Redis server
- Aurora PostgreSQL reachable over TCP 5432
- DNS record for your chosen host name
- TLS certificate and key for that host name

## Required server-side paths

- `/opt/thinkq` for the application
- `/opt/thinkq/env` for runtime environment files
- `/opt/thinkq/certs/global-bundle.pem` for the AWS RDS CA bundle
- `/opt/thinkq/certs/idp-signing.pem` for the university SAML signing certificate
- `/opt/thinkq/exports` for analytics ZIP exports
- `/etc/nginx/sites-available/thinkq.conf` for the Nginx site file
- `/etc/ssl/thinkq/fullchain.pem` and `/etc/ssl/thinkq/privkey.pem` for HTTPS

## What was removed

- all `Dockerfile` files
- all `docker-compose.yml` files
- all `k8s/` directories
- tracked `secrets/` directory
- frontend `node_modules/`
- frontend built `dist/`
- local `.env` files used only for development or Compose
- `.DS_Store` and `.vscode`

## Still required before start

Copy the templates from `deploy/bare-metal/env/*.example` into `/opt/thinkq/env/` and fill in real values.

Do not commit real secrets back into the project tree.
