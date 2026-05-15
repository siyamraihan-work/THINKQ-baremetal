import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

export function readSecret(pathValue, envValue, defaultValue = '') {
  if (pathValue && fs.existsSync(pathValue)) {
    return fs.readFileSync(pathValue, 'utf8').trim();
  }
  if (envValue !== undefined && envValue !== null && String(envValue).trim() !== '') {
    return String(envValue).trim();
  }
  return defaultValue;
}
