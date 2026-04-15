#!/usr/bin/env bash
set -euo pipefail
for unit in thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics; do
  sudo cp "/opt/thinkq/deploy/bare-metal/systemd/${unit}.service" /etc/systemd/system/
done
sudo systemctl daemon-reload
sudo systemctl enable thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics
