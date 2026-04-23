#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

mkdir -p /opt/thinkq/certs
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /opt/thinkq/certs/global-bundle.pem
chmod 644 /opt/thinkq/certs/global-bundle.pem
