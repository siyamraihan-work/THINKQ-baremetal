#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_ROOT="${THINKQ_APP_ROOT:-$(cd "$DEPLOY_DIR/../.." && pwd)}"
RUNTIME_ENV_DIR="${THINKQ_ENV_DIR:-$APP_ROOT/env}"

cd "$APP_ROOT"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || fail "Missing required file: $1"
}

echo "Validating deployment layout at $APP_ROOT"

for path in frontend backend deploy/bare-metal deploy/bare-metal/systemd deploy/bare-metal/nginx deploy/bare-metal/env; do
  [ -e "$path" ] || fail "Missing required path: $APP_ROOT/$path"
done

echo "Checking shell syntax..."
bash -n deploy/bare-metal/scripts/*.sh

echo "Checking JavaScript syntax..."
find backend -path '*/node_modules' -prune -o -type f -name '*.js' -print0 |
  while IFS= read -r -d '' file; do
    node --check "$file" >/dev/null
  done
node --check frontend/vite.config.js >/dev/null

echo "Checking Python syntax..."
python3 -m py_compile backend/analytics-service/app/main.py

echo "Checking package lock coverage..."
for package_dir in frontend backend/auth-user-service backend/admin-service backend/tickets-service backend/notifications-service; do
  require_file "$package_dir/package.json"
  require_file "$package_dir/package-lock.json"
done

echo "Checking Maven project..."
python3 - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET

pom = Path("backend/data-service/pom.xml")
root = ET.parse(pom).getroot()
ns = {"m": "http://maven.apache.org/POM/4.0.0"}
artifact = root.findtext("m:artifactId", namespaces=ns)
version = root.findtext("m:version", namespaces=ns)
if artifact != "data-service":
    raise SystemExit(f"Unexpected Maven artifactId: {artifact!r}")
if version != "1.0.0":
    raise SystemExit(f"Unexpected Maven version: {version!r}")
PY

echo "Checking deployment script host-runtime safeguards..."
python3 - <<'PY'
from pathlib import Path

script = Path("deploy/bare-metal/scripts/build-and-install.sh").read_text(encoding="utf-8")

required_snippets = {
    "sudo -H -u thinkq": "commands executed as thinkq must use sudo -H with a controlled HOME",
    "cd $quoted_workdir": "commands executed as thinkq must explicitly cd to the requested workdir",
    "PYTHON311_BIN=python3.11": "analytics virtualenv must pin python3.11",
    "$PYTHON311_BIN -m venv": "analytics virtualenv must be created with python3.11",
    "sys.version_info[:2] == (3, 11)": "analytics virtualenv must validate Python 3.11",
    "openssl x509": "IdP certificate must be validated with OpenSSL",
    "SAML_CERT_PATH": "deployment must validate the configured SAML certificate path",
}

for snippet, message in required_snippets.items():
    if snippet not in script:
        raise SystemExit(f"build-and-install.sh missing safeguard: {message}")

for forbidden in ("python3 -m venv", "su -s /bin/bash thinkq", "runuser"):
    if forbidden in script:
        raise SystemExit(f"build-and-install.sh still contains forbidden pattern: {forbidden}")
PY

echo "Checking environment templates..."
python3 - <<'PY'
from pathlib import Path

required = {
    "data-service.env.example": {
        "SERVER_PORT", "SERVER_ADDRESS", "DB_HOST", "DB_PORT", "DB_NAME",
        "DB_USER", "DB_PASSWORD", "DB_SSL", "DB_SSL_MODE",
        "INTERNAL_API_KEY", "ALLOW_EMPTY_INTERNAL_API_KEY", "DEV_AUTH_ENABLED",
    },
    "auth-user-service.env.example": {
        "PORT", "SERVICE_HOST", "NODE_ENV", "DATA_SERVICE_URL", "REDIS_URL",
        "INTERNAL_API_KEY", "COOKIE_SECURE", "DEV_AUTH_ENABLED",
        "FRONTEND_BASE_URL", "SAML_ENTRY_POINT", "SAML_IDP_ENTITY_ID",
        "SAML_ISSUER", "SAML_CALLBACK_URL", "SAML_CERT_PATH",
    },
    "admin-service.env.example": {
        "PORT", "SERVICE_HOST", "NODE_ENV", "DATA_SERVICE_URL",
        "REDIS_URL", "INTERNAL_API_KEY",
    },
    "tickets-service.env.example": {
        "PORT", "SERVICE_HOST", "NODE_ENV", "DATA_SERVICE_URL",
        "REDIS_URL", "INTERNAL_API_KEY",
    },
    "notifications-service.env.example": {
        "PORT", "SERVICE_HOST", "NODE_ENV", "DATA_SERVICE_URL",
        "TICKETS_SERVICE_URL", "REDIS_URL", "INTERNAL_API_KEY",
    },
    "analytics-service.env.example": {
        "PYTHONUNBUFFERED", "DATA_SERVICE_URL", "TICKETS_SERVICE_URL",
        "REDIS_URL", "EXPORT_DIR", "INTERNAL_API_KEY",
    },
}

env_dir = Path("deploy/bare-metal/env")
for filename, expected_keys in required.items():
    path = env_dir / filename
    keys = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        keys.add(line.split("=", 1)[0])
    missing = sorted(expected_keys - keys)
    if missing:
        raise SystemExit(f"{path} is missing keys: {', '.join(missing)}")
PY

echo "Checking systemd units..."
python3 - <<'PY'
from pathlib import Path
import configparser

units = {
    "thinkq-data.service",
    "thinkq-auth.service",
    "thinkq-admin.service",
    "thinkq-tickets.service",
    "thinkq-notifications.service",
    "thinkq-analytics.service",
}

for unit in units:
    path = Path("deploy/bare-metal/systemd") / unit
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    parser.optionxform = str
    parser.read(path)
    if not parser.has_section("Service"):
        raise SystemExit(f"{path} is missing [Service]")
    service = parser["Service"]
    for key in ("WorkingDirectory", "EnvironmentFile", "ExecStart", "Restart", "User", "Group"):
        if key not in service:
            raise SystemExit(f"{path} is missing Service.{key}")
    if service["User"] != "thinkq" or service["Group"] != "thinkq":
        raise SystemExit(f"{path} must run as thinkq:thinkq")
    if service.get("Restart") != "always":
        raise SystemExit(f"{path} must set Restart=always")
    if service.get("NoNewPrivileges") != "true":
        raise SystemExit(f"{path} must set NoNewPrivileges=true")
    if "/opt/thinkq" not in service["WorkingDirectory"]:
        raise SystemExit(f"{path} WorkingDirectory should use the canonical /opt/thinkq template path")
PY

echo "Checking Nginx route coverage..."
python3 - <<'PY'
from pathlib import Path

conf = Path("deploy/bare-metal/nginx/thinkq.conf").read_text(encoding="utf-8")
public_hostname = "thinkq.colo-prod-aws.arizona.edu"
old_hostname = "thinkq.thinktank.arizona.edu"
required_routes = [
    "location /auth",
    "location /users",
    "location /api/admin",
    "location /tickets",
    "location /analytics",
    "location /student/live",
    "location /queue",
    "location /events",
]
for route in required_routes:
    if route not in conf:
        raise SystemExit(f"Missing Nginx route block: {route}")
for upstream in ("127.0.0.1:3001", "127.0.0.1:3002", "127.0.0.1:3003", "127.0.0.1:3004", "127.0.0.1:3005"):
    if upstream not in conf:
        raise SystemExit(f"Missing Nginx upstream: {upstream}")
if "/opt/thinkq/frontend/dist" not in conf:
    raise SystemExit("Nginx root should use the canonical /opt/thinkq template path")
if old_hostname in conf:
    raise SystemExit(f"Nginx config still contains obsolete hostname: {old_hostname}")
if conf.count(f"server_name {public_hostname};") != 1:
    raise SystemExit(f"Nginx config should contain exactly one server_name entry for {public_hostname}")
for forbidden in ("listen 443", "ssl_certificate", "ssl_certificate_key", "return 301 https://", "X-Forwarded-Proto $scheme"):
    if forbidden in conf:
        raise SystemExit(f"Nginx config still contains ALB-incompatible TLS/proxy setting: {forbidden}")
if "map $http_x_forwarded_proto $thinkq_forwarded_proto" not in conf:
    raise SystemExit("Nginx config must preserve the ALB X-Forwarded-Proto header")
if "map $http_x_forwarded_port $thinkq_forwarded_port" not in conf:
    raise SystemExit("Nginx config must preserve the ALB X-Forwarded-Port header")
PY

if [ -d "$RUNTIME_ENV_DIR" ]; then
  echo "Checking runtime env files at $RUNTIME_ENV_DIR..."
  python3 deploy/bare-metal/scripts/validate-runtime-env.py "$RUNTIME_ENV_DIR"
else
  echo "Skipping runtime env validation; no env dir found at $RUNTIME_ENV_DIR"
fi

echo "Deployment validation passed."
