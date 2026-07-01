import type { ApiKeyPublic, KeyStats } from '@groswitch/common';
import { request } from '@/shared/lib/http';

export function fetchKeys(): Promise<ApiKeyPublic[]> {
  return request('/api/v1/keys');
}

export function addKey(name: string, key: string): Promise<ApiKeyPublic> {
  return request('/api/v1/keys', {
    method: 'POST',
    body: JSON.stringify({ name, key }),
  });
}

export async function deleteKey(id: string): Promise<void> {
  await request(`/api/v1/keys/${id}`, { method: 'DELETE' });
}

export function updateKey(id: string, changes: { name?: string; key?: string }): Promise<ApiKeyPublic> {
  return request(`/api/v1/keys/${id}`, {
    method: 'PUT',
    body: JSON.stringify(changes),
  });
}

export function fetchStats(): Promise<KeyStats> {
  return request('/api/v1/stats');
}

export async function resetTokens(): Promise<void> {
  await request('/api/v1/keys/reset-tokens', { method: 'POST' });
}

export async function revealKey(id: string): Promise<string> {
  const { key } = await request<{ key: string }>(`/api/v1/keys/${id}/reveal`);
  return key;
}
