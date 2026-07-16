# THINKQ bare-metal requirements and cleanup

This package is cleaned for **Amazon Linux 2023 bare-metal deployment**.

## Runtime requirements

- Amazon Linux 2023
- Nginx
- Node.js 20
- Python 3.11
- Java 21 (Amazon Corretto)
- Maven
- Valkey or Redis-compatible local service for sessions/pub-sub
- PostgreSQL or Aurora PostgreSQL reachable over TCP 5432
- AWS ALB HTTPS listener with the public TLS certificate for your chosen hostname
- University IdP signing certificate if SAML is enabled

## Required host paths

- `/opt/thinkq` for the application tree
- `/opt/thinkq/env` for runtime environment files
- `/opt/thinkq/certs/global-bundle.pem` for the AWS RDS CA bundle
- `/opt/thinkq/certs/idp-signing.pem` for the IdP signing certificate
- `/opt/thinkq/exports` for analytics ZIP exports
- `/opt/thinkq/venvs/analytics` for the analytics Python virtualenv
- `/etc/nginx/conf.d/thinkq.conf` for the Nginx site config

## Removed from this package

- all local dependency directories
- all local build artifacts
- all tracked runtime env files
- `.git/`
- `.DS_Store`
- virtual environments

## Still required before service start

1. Copy the templates from `deploy/bare-metal/env/*.example` into `/opt/thinkq/env/`.
2. Fill in real secrets and hostnames.
3. Install the AWS RDS CA bundle if Aurora TLS is enabled.
4. Preserve the IdP signing certificate at `/opt/thinkq/certs/idp-signing.pem` if it is already installed and validated. For a first-time SAML install, use `deploy/bare-metal/certs/arizona-idp-signing.pem`.
5. Configure the AWS ALB HTTPS listener with the public TLS certificate and forward HTTP traffic to instance port 80.
6. Set one shared long random `INTERNAL_API_KEY` across all backend service env files and the data service env file.
