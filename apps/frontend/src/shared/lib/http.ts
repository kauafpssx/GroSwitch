import type { ManagementResponse } from '@groswitch/common';
import { getApiKey } from './auth';

const API_BASE = '';

export class UnauthorizedError extends Error {
  constructor() {
    super('UNAUTHORIZED');
  }
}

export function authHeaders(): Record<string, string> {
  const apiKey = getApiKey();
  return apiKey ? { 'X-API-KEY': apiKey } : {};
}

function jsonHeaders(hasBody: boolean): Record<string, string> {
  return {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...authHeaders(),
  };
}

// Wraps fetch + the ManagementResponse<T> envelope every management endpoint
// returns, so callers just get T back (or a thrown Error/UnauthorizedError).
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    // Fastify's JSON parser rejects an empty body when Content-Type is set
    // to application/json, so only send that header for calls that have one.
    headers: { ...jsonHeaders(init?.body !== undefined), ...(init?.headers as Record<string, string> | undefined) },
  });

  if (res.status === 401) throw new UnauthorizedError();

  const data: ManagementResponse<T> = await res.json();
  if (!data.success || data.data === undefined) {
    throw new Error(data.error || 'Request failed');
  }
  return data.data;
}

// Pings an authenticated endpoint to confirm a freshly-entered API key is
// actually valid, so the login form can find out before ever showing the
// main app (instead of flashing it and bouncing back on the first 401).
export async function verifyApiKey(): Promise<boolean> {
  try {
    await request('/api/v1/stats');
    return true;
  } catch (err) {
    if (err instanceof UnauthorizedError) return false;
    throw err;
  }
}
