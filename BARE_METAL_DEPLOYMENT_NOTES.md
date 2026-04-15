# THINKQ bare-metal deployment notes

This package is prepared for host-based deployment without Docker or Kubernetes.

## Included changes

- Added `deploy/bare-metal/` with:
  - nginx TLS reverse-proxy config
  - systemd units for all backend services
  - environment file templates
  - helper scripts for systemd install and Aurora CA bundle download
- Updated Java data-service config so it reads `DB_USER` and `DB_PASSWORD` directly.
- Updated analytics service to run cleanly on a host:
  - default tickets URL is `http://127.0.0.1:3003`
  - export directory defaults to `/opt/thinkq/exports`
  - removed server-side backup ZIP creation and removed the backups endpoint

## What still stays the same

- Your application architecture and API paths
- Redis-backed session model
- Aurora PostgreSQL over TLS for the data service
- TLS 1.2/1.3 support at the nginx edge
