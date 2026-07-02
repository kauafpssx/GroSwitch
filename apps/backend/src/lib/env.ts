import { config } from 'dotenv';
import { resolve } from 'path';
import { ROOT_DIR } from './paths';

config({ path: resolve(ROOT_DIR, '.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  MASTER_API_KEY: required('MASTER_API_KEY'),
  MASTER_ENCRYPTION_KEY: required('MASTER_ENCRYPTION_KEY'),
  PORT: parseInt(process.env.PORT || '8400', 10),
  GROQ_BASE_URL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
KEY_MONITOR_INTERVAL_MS: parseInt(process.env.KEY_MONITOR_INTERVAL_MS || '60000', 10),
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
};
