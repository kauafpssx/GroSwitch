import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(import.meta.dir, '../../../../.env') });

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
  PORT: parseInt(process.env.PORT || '3000', 10),
  GROQ_BASE_URL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  DAILY_REQUEST_LIMIT: parseInt(process.env.DAILY_REQUEST_LIMIT || '1500', 10),
  KEY_MONITOR_INTERVAL_MS: parseInt(process.env.KEY_MONITOR_INTERVAL_MS || '60000', 10),
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
};
