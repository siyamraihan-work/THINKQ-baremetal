#!/usr/bin/env bash
set -Eeuo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
APP_ROOT="${THINKQ_APP_ROOT:-$DEFAULT_APP_ROOT}"
SYSTEMD_SYSTEM_DIR=/etc/systemd/system
NGINX_CONF_DIR=/etc/nginx/conf.d

ensure_user() {
  if ! id -u thinkq >/dev/null 2>&1; then
    useradd --system --home-dir "$APP_ROOT" --shell /sbin/nologin thinkq
  fi
}

install_maven() {
  if command -v mvn >/dev/null 2>&1; then
    echo "Maven already installed: $(mvn -version | head -n 1)"
    return
  fi

  if dnf list --available maven3.9 >/dev/null 2>&1; then
    echo "Installing maven3.9..."
    dnf install -y maven3.9
  else
    echo "Installing maven..."
    dnf install -y maven
  fi
}

echo "Installing Amazon Linux 2023 packages..."
dnf install -y \
  nginx \
  redis6 \
  nodejs20 \
  nodejs20-npm \
  java-21-amazon-corretto-devel \
  python3 \
  python3-pip \
  python3.11 \
  python3.11-pip \
  git \
  curl \
  tar \
  unzip

install_maven

if ! command -v python3.11 >/dev/null 2>&1; then
  echo "ERROR: python3.11 is required for the analytics service but was not installed." >&2
  exit 1
fi

python3.11 -c 'import sys; assert sys.version_info[:2] == (3, 11), sys.version'

if command -v /usr/bin/node-20 >/dev/null 2>&1; then
  alternatives --set node /usr/bin/node-20 || true
fi

if command -v /usr/bin/npm-20 >/dev/null 2>&1; then
  alternatives --set npm /usr/bin/npm-20 || true
fi

ensure_user

install -d -m 755 "$SYSTEMD_SYSTEM_DIR" "$NGINX_CONF_DIR"

mkdir -p \
  "$APP_ROOT" \
  "$APP_ROOT/env" \
  "$APP_ROOT/certs" \
  "$APP_ROOT/exports" \
  "$APP_ROOT/venvs" \
  "$APP_ROOT/frontend" \
  "$APP_ROOT/backend" \
  "$APP_ROOT/deploy"

chown -R thinkq:thinkq \
  "$APP_ROOT" \
  "$APP_ROOT/env" \
  "$APP_ROOT/exports" \
  "$APP_ROOT/venvs" \
  "$APP_ROOT/frontend" \
  "$APP_ROOT/backend" \
  "$APP_ROOT/deploy"

chmod 755 "$APP_ROOT" "$APP_ROOT/certs"
chmod 750 "$APP_ROOT/env" "$APP_ROOT/exports" "$APP_ROOT/venvs"

systemctl enable redis6
systemctl start redis6

echo "Bootstrap complete."
echo "Application root: $APP_ROOT"
echo "Next steps:"
echo "1. Copy or keep project files under $APP_ROOT"
echo "2. Place env files under $APP_ROOT/env"
echo "3. Run install-rds-ca.sh if Aurora TLS is enabled"
echo "4. Run build-and-install.sh"
