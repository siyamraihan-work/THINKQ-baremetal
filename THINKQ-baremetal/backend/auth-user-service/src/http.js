import fetch from 'node-fetch';
import { INTERNAL_API_KEY, DATA_SERVICE_URL } from './settings.js';

export async function dataRequest(path, options = {}) {
  const response = await fetch(`${DATA_SERVICE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': INTERNAL_API_KEY,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Data service error ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}
