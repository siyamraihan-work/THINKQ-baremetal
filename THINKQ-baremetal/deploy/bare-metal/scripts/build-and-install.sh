#!/usr/bin/env bash
set -Eeuo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_ROOT="${THINKQ_APP_ROOT:-$(cd "$DEPLOY_DIR/../.." && pwd)}"
FRONTEND_DIR="$APP_ROOT/frontend"
BACKEND_DIR="$APP_ROOT/backend"
ENV_DIR="$APP_ROOT/env"
VENV_ROOT="$APP_ROOT/venvs"
VENV_DIR="$VENV_ROOT/analytics"
MAVEN_PROJECT_DIR="$BACKEND_DIR/data-service"
JAVA21_HOME=/usr/lib/jvm/java-21-amazon-corretto
PYTHON311_BIN=python3.11
PUBLIC_HOSTNAME=thinkq.colo-prod-aws.arizona.edu
OLD_HOSTNAME=thinkq.thinktank.arizona.edu
SYSTEMD_SYSTEM_DIR=/etc/systemd/system
NGINX_CONF_DIR=/etc/nginx/conf.d
SERVICE_UNITS=(thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics)

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&#]/\\&/g'
}

shell_quote() {
  printf '%q' "$1"
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || fail "required command not found: $command_name"
}

require_file() {
  local path="$1"
  [ -f "$path" ] || fail "Missing required file: $path"
}

read_env_value() {
  local env_file="$1"
  local env_key="$2"
  "$PYTHON311_BIN" - "$env_file" "$env_key" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
target = sys.argv[2]

for raw in path.read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    if line.startswith("export "):
        line = line[len("export "):].strip()
    if "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key.strip() != target:
        continue
    value = value.strip()
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        value = value[1:-1]
    print(value)
    raise SystemExit(0)

raise SystemExit(1)
PY
}

assert_thinkq_can_access_dir() {
  local path="$1"
  [ -d "$path" ] || fail "directory does not exist: $path"
  sudo -H -u thinkq -- test -r "$path" || fail "thinkq cannot read directory: $path"
  sudo -H -u thinkq -- test -x "$path" || fail "thinkq cannot enter directory: $path"
}

run_as_thinkq() {
  local workdir="$1"
  shift
  local command="$*"
  local quoted_workdir

  assert_thinkq_can_access_dir "$workdir"
  quoted_workdir="$(shell_quote "$workdir")"
  sudo -H -u thinkq -- bash -lc "cd $quoted_workdir && $command"
}

verify_python311() {
  "$PYTHON311_BIN" -c 'import sys; assert sys.version_info[:2] == (3, 11), sys.version' \
    || fail "$PYTHON311_BIN is not Python 3.11"
}

analytics_venv_python_is_311() {
  [ -x "$VENV_DIR/bin/python" ] \
    && sudo -H -u thinkq -- "$VENV_DIR/bin/python" -c 'import sys; assert sys.version_info[:2] == (3, 11), sys.version' >/dev/null 2>&1
}

recreate_analytics_venv() {
  local expected_venv="$APP_ROOT/venvs/analytics"

  [ "$VENV_DIR" = "$expected_venv" ] || fail "Refusing to recreate unexpected analytics venv path: $VENV_DIR"
  [ -n "$VENV_DIR" ] && [ "$VENV_DIR" != "/" ] || fail "Refusing to recreate unsafe analytics venv path: $VENV_DIR"

  rm -rf -- "$VENV_DIR"
}

ensure_analytics_venv() {
  local quoted_venv
  quoted_venv="$(shell_quote "$VENV_DIR")"

  if analytics_venv_python_is_311; then
    echo "Analytics virtualenv already uses Python 3.11."
  else
    if [ -e "$VENV_DIR" ]; then
      echo "Analytics virtualenv is missing Python 3.11; recreating $VENV_DIR."
      recreate_analytics_venv
    fi
    run_as_thinkq "$APP_ROOT" "$PYTHON311_BIN -m venv $quoted_venv"
  fi

  sudo -H -u thinkq -- "$VENV_DIR/bin/python" -c 'import sys; assert sys.version_info[:2] == (3, 11), sys.version' \
    || fail "Analytics virtualenv was not created with Python 3.11"
}

validate_idp_certificate() {
  local cert_path="$1"

  [ -n "$cert_path" ] || fail "SAML_CERT_PATH is empty"
  [ -s "$cert_path" ] || fail "IdP signing certificate is missing or empty: $cert_path"
  sudo -H -u thinkq -- test -r "$cert_path" || fail "IdP signing certificate is not readable by thinkq: $cert_path"
  openssl x509 -in "$cert_path" -noout -subject -issuer -dates >/dev/null \
    || fail "IdP signing certificate is not a valid X.509 certificate: $cert_path"
}

validate_nginx_config() {
  local conf_path="$1"
  local effective_config
  local server_name_count
  local effective_server_name_count

  grep -Eq "server_name[[:space:]]+$PUBLIC_HOSTNAME;" "$conf_path" \
    || fail "Nginx config does not contain server_name $PUBLIC_HOSTNAME"
  if grep -q "$OLD_HOSTNAME" "$conf_path"; then
    fail "Nginx config still contains obsolete hostname $OLD_HOSTNAME"
  fi
  server_name_count="$(grep -Ec "server_name[[:space:]]+$PUBLIC_HOSTNAME;" "$conf_path")"
  [ "$server_name_count" = "2" ] \
    || fail "Nginx config should contain exactly two server_name entries for $PUBLIC_HOSTNAME; found $server_name_count"

  nginx -t

  effective_config="$(mktemp)"
  if ! nginx -T >"$effective_config" 2>&1; then
    rm -f "$effective_config"
    fail "Unable to inspect effective Nginx configuration"
  fi

  grep -q "$PUBLIC_HOSTNAME" "$effective_config" \
    || { rm -f "$effective_config"; fail "Effective Nginx configuration does not contain $PUBLIC_HOSTNAME"; }
  if grep -q "$OLD_HOSTNAME" "$effective_config"; then
    rm -f "$effective_config"
    fail "Effective Nginx configuration still contains obsolete hostname $OLD_HOSTNAME"
  fi
  effective_server_name_count="$(grep -Ec "server_name[[:space:]]+$PUBLIC_HOSTNAME;" "$effective_config")"
  if [ "$effective_server_name_count" != "2" ]; then
    rm -f "$effective_config"
    fail "Effective Nginx configuration should contain exactly two server_name entries for $PUBLIC_HOSTNAME; found $effective_server_name_count"
  fi

  rm -f "$effective_config"
}

required_paths=(
  "$FRONTEND_DIR"
  "$BACKEND_DIR"
  "$DEPLOY_DIR/systemd"
  "$DEPLOY_DIR/nginx"
)

for path in "${required_paths[@]}"; do
  if [ ! -e "$path" ]; then
    fail "Missing required path: $path"
  fi
done

require_file "$MAVEN_PROJECT_DIR/pom.xml"

for command_name in npm "$PYTHON311_BIN" mvn nginx systemctl sudo openssl; do
  require_command "$command_name"
done

install -d -m 755 "$SYSTEMD_SYSTEM_DIR" "$NGINX_CONF_DIR"

if [ ! -x "$JAVA21_HOME/bin/java" ]; then
  fail "Java 21 not found at $JAVA21_HOME"
fi

verify_python311

echo "Validating runtime environment files..."
"$PYTHON311_BIN" "$DEPLOY_DIR/scripts/validate-runtime-env.py" "$ENV_DIR" --strict-files

echo "Validating IdP signing certificate..."
SAML_CERT_PATH_VALUE="$(read_env_value "$ENV_DIR/auth-user-service.env" "SAML_CERT_PATH")" \
  || fail "Unable to read SAML_CERT_PATH from $ENV_DIR/auth-user-service.env"
validate_idp_certificate "$SAML_CERT_PATH_VALUE"

if [ ! -f /etc/ssl/thinkq/fullchain.pem ] || [ ! -f /etc/ssl/thinkq/privkey.pem ]; then
  fail "Missing TLS certificate files under /etc/ssl/thinkq. Expected fullchain.pem and privkey.pem before installing Nginx."
fi

install -d -o thinkq -g thinkq "$VENV_ROOT" "$APP_ROOT/exports"
chown -R thinkq:thinkq "$APP_ROOT/frontend" "$APP_ROOT/backend" "$APP_ROOT/deploy" "$APP_ROOT/env" "$APP_ROOT/exports" "$APP_ROOT/venvs"

echo "Verifying Java 21 runtime..."
"$JAVA21_HOME/bin/java" -version

echo "Verifying Maven is using Java 21..."
run_as_thinkq "$APP_ROOT" "export JAVA_HOME='$JAVA21_HOME' && export PATH='$JAVA21_HOME/bin:\$PATH' && test \"\$(pwd)\" != /home/ec2-user && mvn -version"

echo "Building frontend..."
run_as_thinkq "$FRONTEND_DIR" "npm ci && npm run build"

echo "Installing Node service dependencies..."
for service in auth-user-service admin-service tickets-service notifications-service; do
  run_as_thinkq "$BACKEND_DIR/$service" "npm ci --omit=dev"
done

echo "Building analytics virtualenv..."
ensure_analytics_venv
run_as_thinkq "$BACKEND_DIR/analytics-service" "$(shell_quote "$VENV_DIR/bin/pip") install --upgrade pip"
run_as_thinkq "$BACKEND_DIR/analytics-service" "$(shell_quote "$VENV_DIR/bin/pip") install -r $(shell_quote "$BACKEND_DIR/analytics-service/requirements.txt")"

echo "Building Java data service..."
run_as_thinkq "$MAVEN_PROJECT_DIR" "export JAVA_HOME='$JAVA21_HOME' && export PATH='$JAVA21_HOME/bin:\$PATH' && test \"\$(pwd)\" != /home/ec2-user && mvn clean verify"

echo "Installing systemd units..."
APP_ROOT_ESCAPED="$(escape_sed_replacement "$APP_ROOT")"
for unit in "${SERVICE_UNITS[@]}"; do
  sed "s#/opt/thinkq#$APP_ROOT_ESCAPED#g" "$DEPLOY_DIR/systemd/${unit}.service" > "$SYSTEMD_SYSTEM_DIR/${unit}.service"
done
systemctl daemon-reload

echo "Installing Nginx config..."
sed "s#/opt/thinkq#$APP_ROOT_ESCAPED#g" "$DEPLOY_DIR/nginx/thinkq.conf" > "$NGINX_CONF_DIR/thinkq.conf"
validate_nginx_config "$NGINX_CONF_DIR/thinkq.conf"

echo "Enabling services..."
systemctl enable nginx
systemctl enable "${SERVICE_UNITS[@]}"

echo "Build and installation complete."
echo "Start services with:"
echo "  systemctl restart thinkq-data thinkq-auth thinkq-admin thinkq-tickets thinkq-notifications thinkq-analytics"
echo "  systemctl restart nginx"
