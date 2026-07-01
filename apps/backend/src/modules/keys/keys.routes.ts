import type { FastifyInstance } from 'fastify';
import { authPreHandler } from '@/plugins/auth';
import { keysRepository } from './keys.repository';
import { modelsRepository } from '@/modules/models/models.repository';
import { appConfig } from '@/modules/models/config';
import type { ApiKeyPublic } from '@groswitch/common';

function toPublic(apiKey: import('@groswitch/common').ApiKey): ApiKeyPublic {
  const now = Date.now();
  const cooldownRemainingMs =
    apiKey.limitedUntil && apiKey.status === 'dead'
      ? Math.max(0, new Date(apiKey.limitedUntil).getTime() - now)
      : null;

  return {
    id: apiKey.id,
    name: apiKey.name,
    status: apiKey.status,
    lastUsedAt: apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toISOString() : null,
    limitedUntil: apiKey.limitedUntil ? new Date(apiKey.limitedUntil).toISOString() : null,
    cooldownRemainingMs,
    deadReason: apiKey.deadReason,
    dailyCount: apiKey.dailyCount,
    minuteCount: apiKey.minuteCount,
    totalTokens: apiKey.totalTokens,
    createdAt: new Date(apiKey.createdAt).toISOString(),
  };
}

export async function keysRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authPreHandler);

  // List all keys
  app.get('/keys', async (_request, reply) => {
    const keys = await keysRepository.findAll();
    return reply.send({ success: true, data: keys.map(toPublic) });
  });

  // Get single key
  app.get('/keys/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const key = await keysRepository.findById(id);
    if (!key) return reply.status(404).send({ success: false, error: 'Key not found' });
    return reply.send({ success: true, data: toPublic(key) });
  });

  // Add new key
  app.post('/keys', async (request, reply) => {
    const { name, key } = request.body as { name?: string; key?: string };

    if (!name || !key) {
      return reply.status(400).send({ success: false, error: 'Missing required fields: name, key' });
    }
    if (typeof name !== 'string' || name.trim().length === 0) {
      return reply.status(400).send({ success: false, error: 'Invalid name' });
    }
    if (typeof key !== 'string' || key.length < 10) {
      return reply.status(400).send({ success: false, error: 'Invalid API key format' });
    }

    const existing = await keysRepository.findAll();
    if (existing.length >= 100) {
      return reply.status(400).send({ success: false, error: 'Maximum key limit reached (100)' });
    }

    const newKey = await keysRepository.create(name.trim(), key);
    return reply.status(201).send({ success: true, data: toPublic(newKey) });
  });

  // Update a key's name and/or credential
  app.put('/keys/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, key } = request.body as { name?: string; key?: string };

    if (name === undefined && key === undefined) {
      return reply.status(400).send({ success: false, error: 'Provide at least one: name, key' });
    }
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return reply.status(400).send({ success: false, error: 'Invalid name' });
    }
    if (key !== undefined && (typeof key !== 'string' || key.length < 10)) {
      return reply.status(400).send({ success: false, error: 'Invalid API key format' });
    }

    const updated = await keysRepository.update(id, {
      name: name?.trim(),
      rawKey: key,
    });
    if (!updated) return reply.status(404).send({ success: false, error: 'Key not found' });
    return reply.send({ success: true, data: toPublic(updated) });
  });

  // Reveal a key's decrypted value, for copying into another tool
  app.get('/keys/:id/reveal', async (request, reply) => {
    const { id } = request.params as { id: string };
    const key = await keysRepository.findById(id);
    if (!key) return reply.status(404).send({ success: false, error: 'Key not found' });
    return reply.send({ success: true, data: { key: keysRepository.getDecryptedKey(key.key) } });
  });

  // Reset the totalTokens counter for every key
  app.post('/keys/reset-tokens', async (_request, reply) => {
    await keysRepository.resetAllTokens();
    return reply.send({ success: true, data: { message: 'Tokens reset' } });
  });

  // Delete key
  app.delete('/keys/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await keysRepository.delete(id);
    if (!deleted) return reply.status(404).send({ success: false, error: 'Key not found' });
    return reply.send({ success: true, data: { message: 'Key deleted' } });
  });

  // Aggregate stats for the dashboard
  app.get('/stats', async (_request, reply) => {
    const keys = await keysRepository.findAll();
    const liveKeys = keys.filter((k) => k.status === 'live');
    const deadKeys = keys.filter((k) => k.status === 'dead');
    const invalidKeys = keys.filter((k) => k.status === 'invalid');
    const deadByReason = {
      minute_limit: deadKeys.filter((k) => k.deadReason === 'minute_limit').length,
      daily_limit: deadKeys.filter((k) => k.deadReason === 'daily_limit').length,
      rate_limit: deadKeys.filter((k) => k.deadReason === 'rate_limit').length,
    };
    const defaultModel = appConfig.getDefaultModel();
    const defaultModelLimits = await modelsRepository.findOrCreate(defaultModel);

    return reply.send({
      success: true,
      data: {
        total: keys.length,
        live: liveKeys.length,
        dead: deadKeys.length,
        invalid: invalidKeys.length,
        deadByReason,
        dailyLimit: defaultModelLimits.rpd,
        minuteLimit: defaultModelLimits.rpm,
        defaultModel,
      },
    });
  });
}
