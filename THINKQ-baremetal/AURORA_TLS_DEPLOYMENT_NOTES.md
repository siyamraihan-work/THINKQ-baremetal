# THINKQ Aurora + TLS deployment notes

## TLS at the edge

This package assumes public TLS termination at the AWS ALB.

- The public certificate is installed on the ALB HTTPS listener.
- The public TLS private key is not placed on the EC2 instance for this deployment model.
- Host Nginx serves plain HTTP on port 80 behind the ALB; the shipped config has no TLS directives and no HTTP-to-HTTPS redirect.
- Nginx preserves the ALB-provided `X-Forwarded-Proto` and `X-Forwarded-Port` headers so backend services see the original public scheme.

Production auth expects `COOKIE_SECURE=true` and will fail startup if secure cookies are disabled while `NODE_ENV=production`.

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

Set `SERVER_ADDRESS=127.0.0.1` for the data service unless you intentionally place it behind a private network boundary.
