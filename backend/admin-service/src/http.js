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
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json().catch(function() { return null; }) : await response.text();
    const message = typeof body === 'string' ? body : body?.error || body?.message || `Data service error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}
