# THINKQ patch summary for Amazon Linux 2023

## What changed

- cleaned package junk (`.git`, local env files, virtualenvs, local `node_modules`, Java `target`, `.DS_Store`)
- standardized deployment paths to `/opt/thinkq/frontend` and `/opt/thinkq/backend`
- rewrote bare-metal deployment docs for Amazon Linux 2023
- rewrote systemd units to use the corrected paths and a dedicated `thinkq` service user
- rewrote Nginx config to serve `/opt/thinkq/frontend/dist` and proxy to localhost services
- added Amazon Linux 2023 helper scripts:
  - `bootstrap-amazon-linux-2023.sh`
  - `build-and-install.sh`
  - `install-rds-ca.sh`
  - `install-systemd.sh`
- fixed frontend Vite dev proxy to use the real service ports
- simplified frontend npm scripts so they work after a clean install
- fixed duplicated `SAML_CERT_PATH` example values
- aligned SAML defaults with University of Arizona Shibboleth metadata
- added `/auth/metadata` service provider metadata for IdP registration
- fixed SAML HTTP-POST callback body parsing
- replaced deprecated `passport-saml` with maintained `@node-saml/passport-saml`
- added production fail-fast checks for internal API keys, secure cookies, and disabled dev auth
- refreshed session users from the data service before role checks so role changes take effect immediately
- bound backend services to localhost by default
- fixed the Java data service so `SERVER_PORT` can override the default port
- fixed the Java data service so `SERVER_ADDRESS` can bind to localhost
- updated stale docs and path references

## Verification performed

- Node service source syntax checked successfully
- analytics Python module compiled successfully
- University of Arizona IdP signing certificate parsed successfully with Node `X509Certificate`
- frontend production build completed successfully after a clean install
- backend Node dependencies installed successfully from lockfiles
- deployment shell scripts passed `bash -n`

## Remaining note

- Java/Maven build was prepared for host build through the included script, but full Maven packaging was not executed inside this patch environment.
