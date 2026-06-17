#!/usr/bin/env python3
import argparse
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


REQUIRED = {
    "data-service.env": {
        "SERVER_PORT",
        "SERVER_ADDRESS",
        "DB_HOST",
        "DB_PORT",
        "DB_NAME",
        "DB_USER",
        "DB_PASSWORD",
        "DB_SSL",
        "DB_SSL_MODE",
        "INTERNAL_API_KEY",
        "ALLOW_EMPTY_INTERNAL_API_KEY",
        "DEV_AUTH_ENABLED",
    },
    "auth-user-service.env": {
        "PORT",
        "SERVICE_HOST",
        "NODE_ENV",
        "DATA_SERVICE_URL",
        "REDIS_URL",
        "INTERNAL_API_KEY",
        "COOKIE_SECURE",
        "DEV_AUTH_ENABLED",
        "FRONTEND_BASE_URL",
        "SAML_ENTRY_POINT",
        "SAML_IDP_ENTITY_ID",
        "SAML_ISSUER",
        "SAML_CALLBACK_URL",
        "SAML_CERT_PATH",
    },
    "admin-service.env": {
        "PORT",
        "SERVICE_HOST",
        "NODE_ENV",
        "DATA_SERVICE_URL",
        "REDIS_URL",
        "INTERNAL_API_KEY",
    },
    "tickets-service.env": {
        "PORT",
        "SERVICE_HOST",
        "NODE_ENV",
        "DATA_SERVICE_URL",
        "REDIS_URL",
        "INTERNAL_API_KEY",
    },
    "notifications-service.env": {
        "PORT",
        "SERVICE_HOST",
        "NODE_ENV",
        "DATA_SERVICE_URL",
        "TICKETS_SERVICE_URL",
        "REDIS_URL",
        "INTERNAL_API_KEY",
    },
    "analytics-service.env": {
        "PYTHONUNBUFFERED",
        "DATA_SERVICE_URL",
        "TICKETS_SERVICE_URL",
        "REDIS_URL",
        "EXPORT_DIR",
        "INTERNAL_API_KEY",
    },
}

EXPECTED_PORTS = {
    "auth-user-service.env": "3001",
    "admin-service.env": "3002",
    "tickets-service.env": "3003",
    "notifications-service.env": "3004",
}

NODE_ENV_FILES = {
    "auth-user-service.env",
    "admin-service.env",
    "tickets-service.env",
    "notifications-service.env",
}


def parse_env(path):
    data = {}
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].strip()
        if "=" not in line:
            raise ValueError(f"{path.name}:{line_number} is not KEY=VALUE")
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if (
            (value.startswith('"') and value.endswith('"'))
            or (value.startswith("'") and value.endswith("'"))
        ):
            value = value[1:-1]
        data[key] = value
    return data


def is_true(value):
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def normalized_base_url(value):
    return str(value or "").rstrip("/")


def add(errors, message):
    errors.append(message)


def validate_url(errors, filename, key, value, scheme=None):
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        add(errors, f"{filename}: {key} must be an absolute URL")
        return
    if scheme and parsed.scheme != scheme:
        add(errors, f"{filename}: {key} must use {scheme}")


def validate(env_dir, strict_files):
    errors = []
    warnings = []
    configs = {}

    for filename, required_keys in REQUIRED.items():
        path = env_dir / filename
        if not path.exists():
            add(errors, f"Missing required env file: {path}")
            continue
        try:
            data = parse_env(path)
        except ValueError as exc:
            add(errors, str(exc))
            continue
        configs[filename] = data

        missing = sorted(required_keys - set(data))
        if missing:
            add(errors, f"{filename}: missing keys: {', '.join(missing)}")

        for key in required_keys:
            value = data.get(key, "")
            if "replace-with-" in value:
                add(errors, f"{filename}: {key} still contains a placeholder value")
            if key in {"INTERNAL_API_KEY", "DB_PASSWORD"} and not value:
                add(errors, f"{filename}: {key} must not be empty")

    if errors:
        return errors, warnings

    internal_keys = {
        filename: data.get("INTERNAL_API_KEY", "")
        for filename, data in configs.items()
    }
    unique_internal_keys = set(internal_keys.values())
    if len(unique_internal_keys) != 1:
        add(errors, "All services must use the same INTERNAL_API_KEY")
    else:
        internal_key = next(iter(unique_internal_keys))
        if len(internal_key) < 32:
            add(errors, "INTERNAL_API_KEY should be at least 32 characters")
        if re.search(r"\s", internal_key):
            add(errors, "INTERNAL_API_KEY must not contain whitespace")

    for filename, expected_port in EXPECTED_PORTS.items():
        data = configs[filename]
        if data.get("PORT") != expected_port:
            add(errors, f"{filename}: PORT should be {expected_port}")
        if data.get("SERVICE_HOST") != "127.0.0.1":
            add(errors, f"{filename}: SERVICE_HOST should be 127.0.0.1 behind Nginx")

    for filename in NODE_ENV_FILES:
        if configs[filename].get("NODE_ENV") != "production":
            add(errors, f"{filename}: NODE_ENV should be production")

    for filename in (
        "auth-user-service.env",
        "admin-service.env",
        "tickets-service.env",
        "notifications-service.env",
        "analytics-service.env",
    ):
        data_service_url = configs[filename].get("DATA_SERVICE_URL", "")
        if data_service_url != "http://127.0.0.1:8080":
            add(errors, f"{filename}: DATA_SERVICE_URL should be http://127.0.0.1:8080")

    for filename in ("notifications-service.env", "analytics-service.env"):
        if configs[filename].get("TICKETS_SERVICE_URL") != "http://127.0.0.1:3003":
            add(errors, f"{filename}: TICKETS_SERVICE_URL should be http://127.0.0.1:3003")

    redis_values = {
        filename: data.get("REDIS_URL", "")
        for filename, data in configs.items()
        if "REDIS_URL" in data
    }
    if len(set(redis_values.values())) != 1:
        add(errors, "All Redis-backed services should use the same REDIS_URL")

    data_env = configs["data-service.env"]
    if data_env.get("SERVER_PORT") != "8080":
        add(errors, "data-service.env: SERVER_PORT should be 8080")
    if data_env.get("SERVER_ADDRESS") != "127.0.0.1":
        add(errors, "data-service.env: SERVER_ADDRESS should be 127.0.0.1 behind Nginx")
    if data_env.get("DB_PORT") != "5432":
        add(errors, "data-service.env: DB_PORT should be 5432 for PostgreSQL/Aurora")
    if is_true(data_env.get("ALLOW_EMPTY_INTERNAL_API_KEY")):
        add(errors, "data-service.env: ALLOW_EMPTY_INTERNAL_API_KEY must be false in production")
    if is_true(data_env.get("DEV_AUTH_ENABLED")):
        add(errors, "data-service.env: DEV_AUTH_ENABLED must be false in production")
    if is_true(data_env.get("DB_SSL")) and data_env.get("DB_SSL_MODE") not in {"require", "verify-ca", "verify-full"}:
        add(errors, "data-service.env: DB_SSL_MODE should be require, verify-ca, or verify-full when DB_SSL=true")

    auth_env = configs["auth-user-service.env"]
    if auth_env.get("COOKIE_SECURE") != "true":
        add(errors, "auth-user-service.env: COOKIE_SECURE must be true in production")
    if is_true(auth_env.get("DEV_AUTH_ENABLED")):
        add(errors, "auth-user-service.env: DEV_AUTH_ENABLED must be false in production")

    frontend_base_url = normalized_base_url(auth_env.get("FRONTEND_BASE_URL"))
    validate_url(errors, "auth-user-service.env", "FRONTEND_BASE_URL", frontend_base_url, scheme="https")
    validate_url(errors, "auth-user-service.env", "SAML_ENTRY_POINT", auth_env.get("SAML_ENTRY_POINT", ""), scheme="https")
    if normalized_base_url(auth_env.get("SAML_ISSUER")) != f"{frontend_base_url}/auth/metadata":
        add(errors, "auth-user-service.env: SAML_ISSUER should match FRONTEND_BASE_URL + /auth/metadata")
    if normalized_base_url(auth_env.get("SAML_CALLBACK_URL")) != f"{frontend_base_url}/auth/saml/callback":
        add(errors, "auth-user-service.env: SAML_CALLBACK_URL should match FRONTEND_BASE_URL + /auth/saml/callback")

    if configs["analytics-service.env"].get("EXPORT_DIR") != "/opt/thinkq/exports":
        warnings.append("analytics-service.env: EXPORT_DIR is not /opt/thinkq/exports; make sure systemd ReadWritePaths allows it")

    if strict_files:
        saml_cert_path = Path(auth_env.get("SAML_CERT_PATH", ""))
        if not saml_cert_path.exists():
            add(errors, "auth-user-service.env: SAML_CERT_PATH does not exist on this host")
        ssl_root_cert = data_env.get("DB_SSL_ROOT_CERT", "")
        if is_true(data_env.get("DB_SSL")) and ssl_root_cert and not Path(ssl_root_cert).exists():
            add(errors, "data-service.env: DB_SSL_ROOT_CERT does not exist on this host")
        export_dir = Path(configs["analytics-service.env"].get("EXPORT_DIR", ""))
        if not export_dir.exists():
            add(errors, "analytics-service.env: EXPORT_DIR does not exist on this host")

    return errors, warnings


def main():
    parser = argparse.ArgumentParser(description="Validate ThinkQ runtime env files without printing secret values.")
    parser.add_argument("env_dir", type=Path)
    parser.add_argument("--strict-files", action="store_true", help="Require referenced cert/export paths to exist on this host.")
    args = parser.parse_args()

    errors, warnings = validate(args.env_dir, args.strict_files)
    for warning in warnings:
        print(f"WARNING: {warning}")
    if errors:
        print("Runtime env validation failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print(f"Runtime env validation passed for {args.env_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
