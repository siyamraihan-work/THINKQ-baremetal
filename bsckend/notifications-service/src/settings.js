import { readSecret } from './secret.js';

export const PORT = process.env.PORT || 3004;
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const TICKETS_SERVICE_URL = process.env.TICKETS_SERVICE_URL || 'http://localhost:3003';
export const INTERNAL_API_KEY = readSecret(process.env.INTERNAL_API_KEY_FILE, process.env.INTERNAL_API_KEY, '');
