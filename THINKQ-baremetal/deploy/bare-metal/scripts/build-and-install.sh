#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_ROOT="${THINKQ_APP_ROOT:-$(cd "$DEPLOY_DIR/../.." && pwd)}"
FRONTEND_DIR="$APP_ROOT/frontend"
BACKEND_DIR="$APP_ROOT/backend"
ENV_DIR="$APP_ROOT/env"
VENV_ROOT="$APP_ROOT/venvs"
VENV_DIR="$VENV_ROOT/analytics"
JAVA21_HOME=/usr/lib/jvm/java-21-amazon-corretto
SYSTEMD_SYSTEM_DIR=/etc/systemd/system
NGINX_CONF_DIR=/etc/nginx/conf.d
SERVICE_UNITS=(thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics)

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&#]/\\&/g'
}

required_paths=(
  "$FRONTEND_DIR"
  "$BACKEND_DIR"
  "$DEPLOY_DIR/systemd"
  "$DEPLOY_DIR/nginx"
)

for path in "${required_paths[@]}"; do
  if [ ! -e "$path" ]; then
    echo "Missing required path: $path" >&2
    exit 1
  fi
done

for command_name in npm python3 mvn nginx systemctl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

install -d -m 755 "$SYSTEMD_SYSTEM_DIR" "$NGINX_CONF_DIR"

if [ ! -x "$JAVA21_HOME/bin/java" ]; then
  echo "Java 21 not found at $JAVA21_HOME" >&2
  exit 1
fi

echo "Validating runtime environment files..."
python3 "$DEPLOY_DIR/scripts/validate-runtime-env.py" "$ENV_DIR" --strict-files

if [ ! -f /etc/ssl/thinkq/fullchain.pem ] || [ ! -f /etc/ssl/thinkq/privkey.pem ]; then
  echo "Missing TLS certificate files under /etc/ssl/thinkq." >&2
  echo "Expected /etc/ssl/thinkq/fullchain.pem and /etc/ssl/thinkq/privkey.pem before installing Nginx." >&2
  exit 1
fi

install -d -o thinkq -g thinkq "$VENV_ROOT" "$APP_ROOT/exports"
chown -R thinkq:thinkq "$APP_ROOT/frontend" "$APP_ROOT/backend" "$APP_ROOT/deploy" "$APP_ROOT/env" "$APP_ROOT/exports" "$APP_ROOT/venvs"

run_as_thinkq() {
  su -s /bin/bash thinkq -c "$1"
}

echo "Verifying Java 21 runtime..."
"$JAVA21_HOME/bin/java" -version

echo "Verifying Maven is using Java 21..."
run_as_thinkq "export JAVA_HOME='$JAVA21_HOME' && export PATH='$JAVA21_HOME/bin:\$PATH' && mvn -version"

echo "Building frontend..."
run_as_thinkq "cd '$FRONTEND_DIR' && npm ci && npm run build"

echo "Installing Node service dependencies..."
for service in auth-user-service admin-service tickets-service notifications-service; do
  run_as_thinkq "cd '$BACKEND_DIR/$service' && npm ci --omit=dev"
done

echo "Building analytics virtualenv..."
run_as_thinkq "python3 -m venv '$VENV_DIR'"
run_as_thinkq "'$VENV_DIR/bin/pip' install --upgrade pip"
run_as_thinkq "'$VENV_DIR/bin/pip' install -r '$BACKEND_DIR/analytics-service/requirements.txt'"

echo "Building Java data service..."
run_as_thinkq "cd '$BACKEND_DIR/data-service' && export JAVA_HOME='$JAVA21_HOME' && export PATH='$JAVA21_HOME/bin:\$PATH' && mvn clean verify"

echo "Installing systemd units..."
APP_ROOT_ESCAPED="$(escape_sed_replacement "$APP_ROOT")"
for unit in "${SERVICE_UNITS[@]}"; do
  sed "s#/opt/thinkq#$APP_ROOT_ESCAPED#g" "$DEPLOY_DIR/systemd/${unit}.service" > "$SYSTEMD_SYSTEM_DIR/${unit}.service"
done
systemctl daemon-reload

echo "Installing Nginx config..."
sed "s#/opt/thinkq#$APP_ROOT_ESCAPED#g" "$DEPLOY_DIR/nginx/thinkq.conf" > "$NGINX_CONF_DIR/thinkq.conf"
nginx -t

echo "Enabling services..."
systemctl enable nginx
systemctl enable "${SERVICE_UNITS[@]}"

echo "Build and installation complete."
echo "Start services with:"
echo "  systemctl restart thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics"
echo "  systemctl restart nginx"
