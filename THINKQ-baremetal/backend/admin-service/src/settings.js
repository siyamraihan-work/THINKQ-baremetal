import { readSecret } from './secret.js';

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = process.env.PORT || 3002;
export const SERVICE_HOST = process.env.SERVICE_HOST || '127.0.0.1';
export const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:8080';
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const INTERNAL_API_KEY = readSecret(process.env.INTERNAL_API_KEY_FILE, process.env.INTERNAL_API_KEY, '');

if (NODE_ENV === 'production' && !INTERNAL_API_KEY) {
  throw new Error('INTERNAL_API_KEY or INTERNAL_API_KEY_FILE is required when NODE_ENV=production');
}
