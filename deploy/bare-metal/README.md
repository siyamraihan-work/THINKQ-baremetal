# THINKQ bare-metal deployment (no Docker, no Kubernetes)

This deployment layout runs THINKQ directly on a Linux host with:

- Nginx for TLS termination and reverse proxy
- systemd for service lifecycle
- Node.js for auth/admin/tickets/notifications
- Java 21 for the data service
- Python 3 for the analytics service
- Redis on the host
- Aurora PostgreSQL as the database

## Clean package assumptions

This package is already stripped for bare-metal deployment. It does **not** include:

- Docker files
- Kubernetes manifests
- tracked secrets
- frontend `node_modules`
- prebuilt frontend `dist`

You must build the frontend and Java service on the target machine.

## Recommended host layout

```text
/opt/thinkq/
  work_backend/
  thinkq-frontend-fixed-aligned/
  certs/
    global-bundle.pem
    idp-signing.pem
  exports/
  env/
  venvs/
```

## Install host packages

Ubuntu example:

```bash
sudo apt update
sudo apt install -y nginx redis-server openjdk-21-jdk python3 python3-venv python3-pip curl git maven
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## Copy the project

```bash
sudo mkdir -p /opt/thinkq
sudo cp -R THINKQ/* /opt/thinkq/
sudo chown -R $USER:$USER /opt/thinkq
sudo mkdir -p /opt/thinkq/env /opt/thinkq/certs /opt/thinkq/exports /opt/thinkq/venvs
```

## Install frontend dependencies and build

```bash
cd /opt/thinkq/thinkq-frontend-fixed-aligned
npm ci
npm run build
```

## Install backend Node dependencies

```bash
cd /opt/thinkq/work_backend/auth-user-service && npm install
cd /opt/thinkq/work_backend/admin-service && npm install
cd /opt/thinkq/work_backend/tickets-service && npm install
cd /opt/thinkq/work_backend/notifications-service && npm install
```

## Install analytics Python environment

```bash
python3 -m venv /opt/thinkq/venvs/analytics
/opt/thinkq/venvs/analytics/bin/pip install --upgrade pip
/opt/thinkq/venvs/analytics/bin/pip install -r /opt/thinkq/work_backend/analytics-service/requirements.txt
```

## Build the Java data service

```bash
cd /opt/thinkq/work_backend/data-service
mvn clean package -DskipTests
```

## Download required certificates

AWS RDS CA bundle:

```bash
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /opt/thinkq/certs/global-bundle.pem
```

University IdP signing certificate:

- place it at `/opt/thinkq/certs/idp-signing.pem`

## Configure environment files

Copy the templates from `deploy/bare-metal/env/` to `/opt/thinkq/env/` and fill in real values.

## Install systemd units

Copy the unit files from `deploy/bare-metal/systemd/` to `/etc/systemd/system/`, then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics
sudo systemctl start thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics
```

## Install nginx config

Copy `deploy/bare-metal/nginx/thinkq.conf` to `/etc/nginx/sites-available/thinkq.conf`, link it into `sites-enabled`, then test and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/thinkq.conf /etc/nginx/sites-enabled/thinkq.conf
sudo nginx -t
sudo systemctl reload nginx
```

## TLS certificate paths

Update the nginx file to point to your real certificate and key:

- `/etc/ssl/thinkq/fullchain.pem`
- `/etc/ssl/thinkq/privkey.pem`

## Service ports

- auth-user-service: `3001`
- admin-service: `3002`
- tickets-service: `3003`
- notifications-service: `3004`
- analytics-service: `3005`
- data-service: `8080`
- nginx public TLS: `443`

## Aurora PostgreSQL values

Use the Aurora cluster or writer endpoint in `data-service.env`:

- `DB_HOST=<aurora-endpoint>`
- `DB_PORT=5432`
- `DB_NAME=thinkq`
- `DB_USER=<db-user>`
- `DB_PASSWORD=<db-password>`
- `DB_SSL=true`
- `DB_SSL_MODE=verify-full`
- `DB_SSL_ROOT_CERT=/opt/thinkq/certs/global-bundle.pem`

## Validation commands

```bash
sudo systemctl status thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics
curl -I https://thinkq.youruniversity.edu/health
curl -I https://thinkq.youruniversity.edu/auth/ping
openssl s_client -connect thinkq.youruniversity.edu:443 -tls1_3
```
