#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

APP_ROOT=/opt/thinkq
FRONTEND_DIR="$APP_ROOT/frontend"
BACKEND_DIR="$APP_ROOT/backend"
VENV_ROOT="$APP_ROOT/venvs"
VENV_DIR="$VENV_ROOT/analytics"
JAVA21_HOME=/usr/lib/jvm/java-21-amazon-corretto

if [ ! -d "$FRONTEND_DIR" ] || [ ! -d "$BACKEND_DIR" ]; then
  echo "Expected frontend/ and backend/ under $APP_ROOT" >&2
  exit 1
fi

if [ ! -x "$JAVA21_HOME/bin/java" ]; then
  echo "Java 21 not found at $JAVA21_HOME" >&2
  exit 1
fi

chown -R thinkq:thinkq "$APP_ROOT/frontend" "$APP_ROOT/backend"
install -d -o thinkq -g thinkq "$VENV_ROOT"

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
  run_as_thinkq "cd '$BACKEND_DIR/$service' && npm install --omit=dev"
done

echo "Building analytics virtualenv..."
run_as_thinkq "python3 -m venv '$VENV_DIR'"
run_as_thinkq "'$VENV_DIR/bin/pip' install --upgrade pip"
run_as_thinkq "'$VENV_DIR/bin/pip' install -r '$BACKEND_DIR/analytics-service/requirements.txt'"

echo "Building Java data service..."
run_as_thinkq "cd '$BACKEND_DIR/data-service' && export JAVA_HOME='$JAVA21_HOME' && export PATH='$JAVA21_HOME/bin:\$PATH' && mvn clean package -DskipTests"

echo "Installing systemd units..."
for unit in thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics; do
  cp "$APP_ROOT/deploy/bare-metal/systemd/${unit}.service" /etc/systemd/system/
done
systemctl daemon-reload

echo "Installing Nginx config..."
cp "$APP_ROOT/deploy/bare-metal/nginx/thinkq.conf" /etc/nginx/conf.d/thinkq.conf
nginx -t

echo "Build and installation steps completed."
echo "Start services with: systemctl enable"