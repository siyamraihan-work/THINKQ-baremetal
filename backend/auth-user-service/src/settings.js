import { readSecret } from './secret.js';

export const PORT = process.env.PORT || 3001;
export const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:8080';
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const INTERNAL_API_KEY = readSecret(process.env.INTERNAL_API_KEY_FILE, process.env.INTERNAL_API_KEY, '');
export const SESSION_SECRET = readSecret(process.env.SESSION_SECRET_FILE, process.env.SESSION_SECRET, '');

export const COOKIE_SECURE = String(process.env.COOKIE_SECURE || 'false') === 'true';

export const SAML_ENTRY_POINT = process.env.SAML_ENTRY_POINT || 'https://idp.example.com/sso';
export const SAML_ISSUER = process.env.SAML_ISSUER || 'helpdesk-platform';
export const SAML_CALLBACK_URL = process.env.SAML_CALLBACK_URL || 'http://localhost/auth/saml/callback';
export const SAML_CERT = readSecret(process.env.SAML_CERT_PATH, process.env.SAML_CERT, '');

export const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
export const LOGIN_PATH = process.env.LOGIN_PATH || '/login';
export const UNAUTHORIZED_PATH = process.env.UNAUTHORIZED_PATH || '/unauthorized';
export const POST_LOGIN_PATH = process.env.POST_LOGIN_PATH || '/';

export const DEV_AUTH_ENABLED = String(process.env.DEV_AUTH_ENABLED || 'false') === 'true';
