import type { KeyStats, ModelRateLimitPublic } from '@groswitch/common';
import { request } from '@/shared/lib/http';
import { fetchStats } from '@/features/keys/api';

export function fetchModels(): Promise<ModelRateLimitPublic[]> {
  return request('/api/v1/models');
}

export function updateModel(
  model: string,
  changes: { rpm?: number; rpd?: number; tpm?: number }
): Promise<ModelRateLimitPublic> {
  return request(`/api/v1/models/${encodeURIComponent(model)}`, {
    method: 'PUT',
    body: JSON.stringify(changes),
  });
}

export async function updateDefaultModel(defaultModel: string): Promise<KeyStats> {
  await request('/api/v1/config', {
    method: 'PUT',
    body: JSON.stringify({ defaultModel }),
  });
  return fetchStats();
}
