#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_ROOT="${THINKQ_APP_ROOT:-$(cd "$DEPLOY_DIR/../.." && pwd)}"
APP_ROOT_ESCAPED="$(printf '%s' "$APP_ROOT" | sed 's/[&#]/\\&/g')"
SYSTEMD_SYSTEM_DIR=/etc/systemd/system

install -d -m 755 "$SYSTEMD_SYSTEM_DIR"

for unit in thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics; do
  sed "s#/opt/thinkq#$APP_ROOT_ESCAPED#g" "$DEPLOY_DIR/systemd/${unit}.service" > "$SYSTEMD_SYSTEM_DIR/${unit}.service"
done
systemctl daemon-reload
echo "Installed systemd units for APP_ROOT=$APP_ROOT"
