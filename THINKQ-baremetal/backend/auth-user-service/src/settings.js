import { readSecret } from './secret.js';

export const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

export const PORT = process.env.PORT || 3001;
export const SERVICE_HOST = process.env.SERVICE_HOST || '127.0.0.1';
export const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:8080';
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const INTERNAL_API_KEY = readSecret(process.env.INTERNAL_API_KEY_FILE, process.env.INTERNAL_API_KEY, '');

export const COOKIE_SECURE = String(process.env.COOKIE_SECURE || (IS_PRODUCTION ? 'true' : 'false')) === 'true';

const ARIZONA_IDP_SIGNING_CERT = `-----BEGIN CERTIFICATE-----
MIIDhjCCAm4CCQDai2P3utkU9zANBgkqhkiG9w0BAQsFADCBhDELMAkGA1UEBhMC
VVMxEDAOBgNVBAgMB0FyaXpvbmExDzANBgNVBAcMBlR1Y3NvbjEiMCAGA1UECgwZ
VGhlIFVuaXZlcnNpdHkgb2YgQXJpem9uYTENMAsGA1UECwwEVUlUUzEfMB0GA1UE
AwwWc2hpYmJvbGV0aC5hcml6b25hLmVkdTAeFw0yMzAxMjYxNjA5MDBaFw0zMzAx
MjMxNjA5MDBaMIGEMQswCQYDVQQGEwJVUzEQMA4GA1UECAwHQXJpem9uYTEPMA0G
A1UEBwwGVHVjc29uMSIwIAYDVQQKDBlUaGUgVW5pdmVyc2l0eSBvZiBBcml6b25h
MQ0wCwYDVQQLDARVSVRTMR8wHQYDVQQDDBZzaGliYm9sZXRoLmFyaXpvbmEuZWR1
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnrWsykBM1zdI/X+s+Vtv
db9yCnKNhwTC0z5FV2o+cj6ooFqKuRTeEry/+BunArDfeHwl1ybL4LvEABaqa0S6
SwlCu9SelyeJN9y9Pqq5dvVqcdfxMRUIJuu4hojBAFy9/1ctrWJ0N2GrZrLzvAnA
dJCFe+Nz9mSaRy7JbLEp4WFgr043gbl+oOor6d+N+Kjo6t6w92eAIVt+5VZX0N+X
WLGJwg//fxBAlZQyozddfo52f7j59BGog3knRE6JPGc9DbA0u4NKkxZ0Z6BJMhmt
TtVfS2OR/nyoNdOZRZ9x16IjaWX5kb8O5Y20yvO7lZsMwFugH/WUvPzH6xF0/iCv
tQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQCPy93iMvwrDkU8wOdykZ8GaCeAQAOl
T+Tl6EQ2OQk4yokco65Cg6DYgtb7QsEwWzbnFdtfHxrPiEsZzM3VxN1VJRFnEoXW
Bp1hFJ83DApjaS/1zW0sgxleK7jW1+DAD3FcrST18NFidfjNety82RKF8PXtz1z0
2lToIYHR9GF8/GOZyEnKqqFZbgaidakHfryIkiAzYm5Wo98g5dayMQkUCTH3cKfd
bIjzdjGFpVdeUFGNECqMJSj3m+q4e0vslzziS1Qv738pzepL8XUDj3QkWVoE3jVw
UvF8HVwKDLJ0n6Vwgsft9/iYix49JR53FCCQ9osF2ctaRQ1Y4LoBrenA
-----END CERTIFICATE-----`;

export const SAML_ENTRY_POINT = process.env.SAML_ENTRY_POINT || 'https://shibboleth.arizona.edu/idp/profile/SAML2/Redirect/SSO';
export const SAML_IDP_ENTITY_ID = process.env.SAML_IDP_ENTITY_ID || 'urn:mace:incommon:arizona.edu';
export const SAML_ISSUER = process.env.SAML_ISSUER || 'https://thinkq.colo-prod-aws.arizona.edu/auth/metadata';
export const SAML_CALLBACK_URL = process.env.SAML_CALLBACK_URL || 'https://thinkq.colo-prod-aws.arizona.edu/auth/saml/callback';
export const SAML_CERT = readSecret(process.env.SAML_CERT_PATH, process.env.SAML_CERT, ARIZONA_IDP_SIGNING_CERT);

export const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || (IS_PRODUCTION ? 'https://thinkq.colo-prod-aws.arizona.edu' : 'http://localhost:5173');
export const LOGIN_PATH = process.env.LOGIN_PATH || '/login';
export const UNAUTHORIZED_PATH = process.env.UNAUTHORIZED_PATH || '/unauthorized';
export const POST_LOGIN_PATH = process.env.POST_LOGIN_PATH || '/';

export const DEV_AUTH_ENABLED = String(process.env.DEV_AUTH_ENABLED || 'false') === 'true';

if (IS_PRODUCTION) {
  const missing = [];
  if (!INTERNAL_API_KEY) {
    missing.push('INTERNAL_API_KEY or INTERNAL_API_KEY_FILE');
  }
  if (!SAML_ENTRY_POINT) {
    missing.push('SAML_ENTRY_POINT');
  }
  if (!SAML_ISSUER) {
    missing.push('SAML_ISSUER');
  }
  if (!SAML_CALLBACK_URL) {
    missing.push('SAML_CALLBACK_URL');
  }
  if (!SAML_CERT) {
    missing.push('SAML_CERT or SAML_CERT_PATH');
  }
  if (DEV_AUTH_ENABLED) {
    throw new Error('DEV_AUTH_ENABLED must not be true when NODE_ENV=production');
  }
  if (!COOKIE_SECURE) {
    throw new Error('COOKIE_SECURE must be true when NODE_ENV=production');
  }
  if (missing.length) {
    throw new Error('Missing production auth settings: ' + missing.join(', '));
  }
}
