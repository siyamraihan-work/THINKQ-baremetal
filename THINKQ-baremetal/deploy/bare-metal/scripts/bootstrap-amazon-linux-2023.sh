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
dnf install -y   nginx   redis6   nodejs20   nodejs20-npm   java-21-amazon-corretto-devel   maven   python3   python3-pip   git   curl   tar   unzip  git   curl   tar   unzip

if command -v /usr/bin/node-20 >/dev/null 2>&1; then
  alternatives --set node /usr/bin/node-20 || true
fi
if command -v /usr/bin/npm-20 >/dev/null 2>&1; then
  alternatives --set npm /usr/bin/npm-20 || true
fi

ensure_user
mkdir -p "$APP_ROOT" "$APP_ROOT/env" "$APP_ROOT/certs" "$APP_ROOT/exports" "$APP_ROOT/venvs"
chown -R thinkq:thinkq "$APP_ROOT/env" "$APP_ROOT/exports" "$APP_ROOT/venvs"
chmod 755 "$APP_ROOT" "$APP_ROOT/certs"
chmod 750 "$APP_ROOT/env" "$APP_ROOT/exports" "$APP_ROOT/venvs"

for template in   auth-user-service   admin-service   tickets-service   notifications-service   analytics-service   data-service; do
  target="$APP_ROOT/env/${template}.env"
  source="$APP_ROOT/deploy/bare-metal/env/${template}.env.example"
  if [ -f "$source" ] && [ ! -f "$target" ]; then
    cp "$source" "$target"
    chown thinkq:thinkq "$target"
    chmod 640 "$target"
  fi
done

echo "Bootstrap complete."
echo "Next: edit /opt/thinkq/env/*.env, install certificates, then run build-and-install.sh"
