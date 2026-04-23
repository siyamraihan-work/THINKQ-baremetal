# THINKQ bare-metal deployment on Amazon Linux 2023

This layout runs THINKQ directly on an **Amazon Linux 2023** EC2 instance or VM with:

- Nginx for TLS termination and reverse proxy
- systemd for process supervision
- Node.js 20 for auth/admin/tickets/notifications
- Java 21 (Amazon Corretto) for the data service
- Python 3 virtualenv for the analytics service
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

## 1) Copy the project to the host

```bash
sudo mkdir -p /opt/thinkq
sudo rsync -a THINKQ-baremetal-amzn2023/ /opt/thinkq/
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
- `python3`
- `python3-pip`
- `git`, `curl`, `tar`, `unzip`

It also creates:

- `/opt/thinkq/env`
- `/opt/thinkq/certs`
- `/opt/thinkq/exports`
- `/opt/thinkq/venvs`
- `thinkq` system user

## 3) Fill in runtime env files

Copy and edit the templates in `/opt/thinkq/env/`:

- `auth-user-service.env`
- `admin-service.env`
- `tickets-service.env`
- `notifications-service.env`
- `analytics-service.env`
- `data-service.env`

## 4) Install certificates

AWS RDS CA bundle:

```bash
sudo bash /opt/thinkq/deploy/bare-metal/scripts/install-rds-ca.sh
```

IdP signing certificate:

- place it at `/opt/thinkq/certs/idp-signing.pem`

Public TLS certificate:

- place the cert at `/etc/ssl/thinkq/fullchain.pem`
- place the key at `/etc/ssl/thinkq/privkey.pem`

## 5) Build the application and install service configs

Run:

```bash
sudo bash /opt/thinkq/deploy/bare-metal/scripts/build-and-install.sh
```

That script will:

- install frontend dependencies and build `frontend/dist`
- install Node service dependencies
- create the analytics virtualenv and install Python requirements
- build the Java data service JAR
- install systemd unit files
- install the Nginx config at `/etc/nginx/conf.d/thinkq.conf`
- reload systemd and validate Nginx config

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
curl -I https://your-hostname.example/healthz
curl -I https://your-hostname.example/auth/ping
```

## Service ports

- auth-user-service: `3001`
- admin-service: `3002`
- tickets-service: `3003`
- notifications-service: `3004`
- analytics-service: `3005`
- data-service: `8080`
- nginx public HTTPS: `443`

## Notes

- Frontend assets are served directly by Nginx from `/opt/thinkq/frontend/dist`.
- Nginx routes directly to each service; there is no separate backend gateway directory in this package.
- The default local cache/session service is redis6 on `127.0.0.1:6379`.
