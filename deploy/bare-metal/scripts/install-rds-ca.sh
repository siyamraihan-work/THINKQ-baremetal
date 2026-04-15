#!/usr/bin/env bash
set -euo pipefail
sudo mkdir -p /opt/thinkq/certs
sudo curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /opt/thinkq/certs/global-bundle.pem
sudo chmod 644 /opt/thinkq/certs/global-bundle.pem
