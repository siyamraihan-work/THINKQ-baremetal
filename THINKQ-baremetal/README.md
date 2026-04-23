# THINKQ bare-metal package for Amazon Linux 2023

This package is aligned for **direct bare-metal deployment on an Amazon Linux 2023 host**.

Start here:

- `deploy/bare-metal/README.md`
- `REQUIREMENTS_AND_CLEANUP.md`
- `BARE_METAL_DEPLOYMENT_NOTES.md`
- `AURORA_TLS_DEPLOYMENT_NOTES.md`

## Included

- `frontend/` React + Vite source
- `backend/` service source for Node, Java, and Python services
- `deploy/bare-metal/nginx/` hardened Nginx site config
- `deploy/bare-metal/systemd/` systemd unit files for each service
- `deploy/bare-metal/env/` environment templates
- `deploy/bare-metal/scripts/` Amazon Linux 2023 helper scripts

## Intentionally excluded

- `.git/`
- local `node_modules/`
- local Python virtual environments
- local Java `target/` build output
- live `.env` files with machine-specific values
- Docker/Kubernetes deployment files
- desktop metadata such as `.DS_Store`

## Canonical runtime layout

```text
/opt/thinkq/
  frontend/
  backend/
  deploy/
  env/
  certs/
  exports/
  venvs/
```

All deployment files in this package now assume that exact layout.
