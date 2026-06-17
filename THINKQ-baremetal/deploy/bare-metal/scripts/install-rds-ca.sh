#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
APP_ROOT="${THINKQ_APP_ROOT:-$DEFAULT_APP_ROOT}"
CERT_DIR="$APP_ROOT/certs"
CERT_FILE="$CERT_DIR/global-bundle.pem"

mkdir -p "$CERT_DIR"
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o "$CERT_FILE"
chmod 644 "$CERT_FILE"
echo "Installed AWS RDS CA bundle at $CERT_FILE"
