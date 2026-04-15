# THINKQ Aurora + TLS deployment notes

## TLS

Both frontend and backend Nginx layers now support HTTPS with TLS 1.2/1.3 and redirect HTTP to HTTPS.

- Runtime cert path: `/etc/nginx/tls/tls.crt`
- Runtime key path: `/etc/nginx/tls/tls.key`
- If no certs are mounted and `GENERATE_SELF_SIGNED_CERT=true`, the container generates a self-signed development certificate automatically.

For production, mount a real PEM certificate and key into each `nginx/tls/` directory and set:

- `SERVER_NAME=your-domain.example`
- `GENERATE_SELF_SIGNED_CERT=false`

## Aurora PostgreSQL

The Java data service now supports either local PostgreSQL or Aurora PostgreSQL via environment variables.

### Local PostgreSQL

Keep:

- `DB_HOST=postgres`
- `DB_PORT=5432`
- `DB_SSL=false`
- `DB_SSL_MODE=disable`

### Aurora PostgreSQL

Set:

- `DB_HOST=<aurora-writer-or-cluster-endpoint>`
- `DB_PORT=5432`
- `DB_NAME=<database-name>`
- `DB_USER=<database-user>`
- `DB_SSL=true`
- `DB_SSL_MODE=verify-full`
- `DB_SSL_ROOT_CERT=/opt/rds-ca/global-bundle.pem`

The data-service image now downloads the AWS RDS global CA bundle to `/opt/rds-ca/global-bundle.pem` during build so TLS certificate verification can work against Aurora.
