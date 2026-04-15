import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

export function readSecret(pathValue, envValue) {
  if (pathValue && fs.existsSync(pathValue)) {
    return fs.readFileSync(pathValue, 'utf8').trim();
  }
  return envValue;
}
