# THINKQ bare-metal deployment on Amazon Linux 2023

This layout runs THINKQ directly on an **Amazon Linux 2023** EC2 instance or VM behind an AWS ALB with:

- Nginx for HTTP reverse proxy on the instance
- AWS ALB for public HTTPS/TLS termination
- systemd for process supervision
- Node.js 20 for auth/admin/tickets/notifications
- Java 21 (Amazon Corretto) for the data service
- Python 3.11 virtualenv for the analytics service
- Redis6 for sessions and pub/sub
- PostgreSQL or Aurora PostgreSQL as the database

## Canonical host layout

```text
/opt/thinkq/
  frontend/
  backend/
  deploy/
  certs/
    global-bundle.pem
    idp-signing.pem
  exports/
  env/
  venvs/
```

The scripts also support a custom checkout path. Set `THINKQ_APP_ROOT=/path/to/THINKQ-baremetal` when the app is not installed directly at `/opt/thinkq`.

The installer writes service units to `/etc/systemd/system/` and the Nginx site config to `/etc/nginx/conf.d/thinkq.conf`. Amazon Linux 2023 uses `conf.d`; `/etc/nginx/conf.c/` is not a standard Nginx include directory. Nginx listens on HTTP port 80 because the ALB terminates HTTPS and forwards HTTP to the instance.

## 1) Copy the project to the host

```bash
sudo mkdir -p /opt/thinkq
sudo rsync -a THINKQ-baremetal/ /opt/thinkq/
```

## 2) Install host packages and base directories

Run:

```bash
sudo bash /opt/thinkq/deploy/bare-metal/scripts/bootstrap-amazon-linux-2023.sh
```

That script installs:

- `nginx`
- `redis6`
- `nodejs20` and `nodejs20-npm`
- `java-21-amazon-corretto-devel`
- `maven`
- `python3` and `python3-pip` for host tooling
- `python3.11` and `python3.11-pip` for the analytics virtualenv
- `git`, `curl`, `tar`, `unzip`

It also creates:

- `/opt/thinkq/env`
- `/opt/thinkq/certs`
- `/opt/thinkq/exports`
- `/opt/thinkq/venvs`
- `thinkq` system user

## 3) Fill in runtime env files

Copy each template from `/opt/thinkq/deploy/bare-metal/env/*.example` to `/opt/thinkq/env/` without the `.example` suffix, then edit the values:

- `auth-user-service.env`
- `admin-service.env`
- `tickets-service.env`
- `notifications-service.env`
- `analytics-service.env`
- `data-service.env`

All services must share the same long random `INTERNAL_API_KEY` value. In production, the Node services now fail fast if this value is missing, and the data service rejects empty internal API key configuration unless `ALLOW_EMPTY_INTERNAL_API_KEY=true` is set explicitly for local-only development.

## 4) Install certificates

AWS RDS CA bundle:

```bash
sudo bash /opt/thinkq/deploy/bare-metal/scripts/install-rds-ca.sh
```

IdP signing certificate:

- preserve an existing `/opt/thinkq/certs/idp-signing.pem` when it has already been validated and is readable by `thinkq`
- for a first-time install only, copy `deploy/bare-metal/certs/arizona-idp-signing.pem` to `/opt/thinkq/certs/idp-signing.pem`
- if UA rotates the IdP signing key, replace that file with the current public signing certificate from UA/InCommon metadata

Public TLS certificate:

- install the public certificate on the AWS ALB HTTPS listener
- do not place the public TLS private key on the EC2 instance for this deployment model

## 5) Build the application and install service configs

Run:

```bash
sudo bash /opt/thinkq/deploy/bare-metal/scripts/build-and-install.sh
```

That script will:

- install frontend dependencies and build `frontend/dist`
- install Node service dependencies
- create or repair the analytics virtualenv with `python3.11` and install Python requirements through that virtualenv
- build the Java data service JAR as `thinkq` from the data-service Maven project directory
- install systemd unit files
- install the ALB-compatible Nginx HTTP config at `/etc/nginx/conf.d/thinkq.conf`
- reload systemd and validate the installed and effective Nginx config

Before running it on a production host, run the local deployment preflight from the app root:

```bash
bash deploy/bare-metal/scripts/validate-deployment.sh
```

To validate runtime env files before copying them onto the host:

```bash
THINKQ_ENV_DIR=/path/to/env bash deploy/bare-metal/scripts/validate-deployment.sh
```

## 6) Start the runtime

```bash
sudo systemctl enable --now redis6
sudo systemctl enable --now thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics
sudo systemctl enable --now nginx
```

## 7) Validate

```bash
sudo systemctl status thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics --no-pager
sudo nginx -t
curl -I https://thinkq.colo-prod-aws.arizona.edu/healthz
curl -I https://thinkq.colo-prod-aws.arizona.edu/auth/metadata
curl -I --cookie "sid=YOUR_SESSION_COOKIE" https://thinkq.colo-prod-aws.arizona.edu/auth/ping
```

## Arizona SAML settings

The auth service defaults are aligned to the University of Arizona IdP metadata:

- IdP entity ID: `urn:mace:incommon:arizona.edu`
- Redirect SSO URL: `https://shibboleth.arizona.edu/idp/profile/SAML2/Redirect/SSO`
- POST SSO URL: `https://shibboleth.arizona.edu/idp/profile/SAML2/POST/SSO`
- Assertion signing cert: `/opt/thinkq/certs/idp-signing.pem`

Register the ThinkQ service provider with UA using:

- SP entity ID: `https://thinkq.colo-prod-aws.arizona.edu/auth/metadata`
- Assertion Consumer Service URL: `https://thinkq.colo-prod-aws.arizona.edu/auth/saml/callback`
- ACS binding: `urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST`

The generated SP metadata is available at `/auth/metadata` after the auth service is running.

## Service ports

- auth-user-service: `3001`
- admin-service: `3002`
- tickets-service: `3003`
- notifications-service: `3004`
- analytics-service: `3005`
- data-service: `8080`
- nginx instance HTTP behind ALB: `80`
- ALB public HTTPS: `443`

## Notes

- Frontend assets are served directly by Nginx from `/opt/thinkq/frontend/dist`.
- Nginx routes directly to each service; there is no separate backend gateway directory in this package.
- Nginx preserves the ALB-provided `X-Forwarded-Proto` and `X-Forwarded-Port` headers for backend services.
- The default local cache/session service is redis6 on `127.0.0.1:6379`.
