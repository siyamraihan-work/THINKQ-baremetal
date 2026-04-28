#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

APP_ROOT=/opt/thinkq

ensure_user() {
  if ! id -u thinkq >/dev/null 2>&1; then
    useradd --system --home-dir "$APP_ROOT" --shell /sbin/nologin thinkq
  fi
}

echo "Installing Amazon Linux 2023 packages..."
dnf install -y \
  nginx \
  redis6 \
  nodejs20 \
  nodejs20-npm \
  java-21-amazon-corretto-devel \
  maven \
  python3 \
  python3-pip \
  git \
  curl \
  tar \
  unzip

if command -v /usr/bin/node-20 >/dev/null 2>&1; then
  alternatives --set node /usr/bin/node-20 || true
fi

if command -v /usr/bin/npm-20 >/dev/null 2>&1; then
  alternatives --set npm /usr/bin/npm-20 || true
fi

ensure_user

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
echo "Next steps:"
echo "1. Copy project files into /opt/thinkq"
echo "2. Place env files under /opt/thinkq/env"
echo "3. Run install-rds-ca.sh if Aurora TLS is enabled"
echo "4. Run build-and-install.sh"