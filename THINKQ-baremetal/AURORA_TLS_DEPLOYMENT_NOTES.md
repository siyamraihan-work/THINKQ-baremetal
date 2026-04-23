# THINKQ Aurora + TLS deployment notes

## TLS at the edge

This package assumes TLS termination at host Nginx.

Runtime certificate paths:

- `/etc/ssl/thinkq/fullchain.pem`
- `/etc/ssl/thinkq/privkey.pem`

The shipped Nginx config redirects HTTP to HTTPS and enables TLS 1.2 and TLS 1.3.

## Aurora PostgreSQL

The Java data service reads database connectivity from environment variables.

### Local PostgreSQL

Use values such as:

- `DB_HOST=127.0.0.1`
- `DB_PORT=5432`
- `DB_SSL=false`
- `DB_SSL_MODE=disable`

### Aurora PostgreSQL with TLS

Use values such as:

- `DB_HOST=<aurora-writer-or-cluster-endpoint>`
- `DB_PORT=5432`
- `DB_NAME=<database-name>`
- `DB_USER=<database-user>`
- `DB_PASSWORD=<database-password>`
- `DB_SSL=true`
- `DB_SSL_MODE=verify-full`
- `DB_SSL_ROOT_CERT=/opt/thinkq/certs/global-bundle.pem`

Install the AWS RDS global CA bundle at `/opt/thinkq/certs/global-bundle.pem` before starting the data service.
