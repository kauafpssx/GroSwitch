import type { ApiKeyPublic, KeyStats, ManagementResponse, ModelRateLimitPublic } from '@gemrouter/common';

const API_BASE = '';

export function getApiKey(): string | null {
  return localStorage.getItem('gemrouter_api_key');
}

export function authHeaders(): Record<string, string> {
  const apiKey = getApiKey();
  return apiKey ? { 'X-API-KEY': apiKey } : {};
}

function jsonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...authHeaders(),
  };
}

export async function fetchKeys(): Promise<ApiKeyPublic[]> {
  const res = await fetch(`${API_BASE}/api/v1/keys`, { headers: jsonHeaders() });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  const data: ManagementResponse<ApiKeyPublic[]> = await res.json();
  if (!data.success || !data.data) throw new Error(data.error || 'Failed to fetch keys');
  return data.data;
}

export async function addKey(name: string, key: string): Promise<ApiKeyPublic> {
  const res = await fetch(`${API_BASE}/api/v1/keys`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ name, key }),
  });
  const data: ManagementResponse<ApiKeyPublic> = await res.json();
  if (!data.success || !data.data) throw new Error(data.error || 'Failed to add key');
  return data.data;
}

export async function deleteKey(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/keys/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data: ManagementResponse<unknown> = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to delete key');
}

export async function fetchModels(): Promise<ModelRateLimitPublic[]> {
  const res = await fetch(`${API_BASE}/api/v1/models`, { headers: jsonHeaders() });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  const data: ManagementResponse<ModelRateLimitPublic[]> = await res.json();
  if (!data.success || !data.data) throw new Error(data.error || 'Failed to fetch models');
  return data.data;
}

export async function updateModel(
  model: string,
  changes: { rpm?: number; rpd?: number; tpm?: number }
): Promise<ModelRateLimitPublic> {
  const res = await fetch(`${API_BASE}/api/v1/models/${encodeURIComponent(model)}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify(changes),
  });
  const data: ManagementResponse<ModelRateLimitPublic> = await res.json();
  if (!data.success || !data.data) throw new Error(data.error || 'Failed to update model');
  return data.data;
}

export async function fetchStats(): Promise<KeyStats> {
  const res = await fetch(`${API_BASE}/api/v1/stats`, { headers: jsonHeaders() });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  const data: ManagementResponse<KeyStats> = await res.json();
  if (!data.success || !data.data) throw new Error(data.error || 'Failed to fetch stats');
  return data.data;
}

export async function updateDefaultModel(defaultModel: string): Promise<KeyStats> {
  const res = await fetch(`${API_BASE}/api/v1/config`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({ defaultModel }),
  });
  const data: ManagementResponse<{ defaultModel: string }> = await res.json();
  if (!data.success || !data.data) throw new Error(data.error || 'Failed to update default model');
  return fetchStats();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export function setApiKey(key: string) {
  localStorage.setItem('gemrouter_api_key', key);
}

export function clearApiKey() {
  localStorage.removeItem('gemrouter_api_key');
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}
