#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

for unit in thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics; do
  cp "/opt/thinkq/deploy/bare-metal/systemd/${unit}.service" /etc/systemd/system/
done
systemctl daemon-reload
