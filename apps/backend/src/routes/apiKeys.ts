import type { FastifyInstance } from 'fastify';
import { authPreHandler } from '../plugins/auth';
import { apiKeyRepository } from '../repositories/apiKeyRepository';
import { modelRateLimitRepository } from '../repositories/modelRateLimitRepository';
import { appConfig } from '../lib/config';
import type { ApiKeyPublic, ModelRateLimitPublic } from '@gemrouter/common';

function toPublic(apiKey: import('@gemrouter/common').ApiKey): ApiKeyPublic {
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

function modelToPublic(m: import('@gemrouter/common').ModelRateLimit): ModelRateLimitPublic {
  return {
    id: m.id,
    model: m.model,
    rpm: m.rpm,
    rpd: m.rpd,
    tpm: m.tpm,
  };
}

export async function apiKeyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authPreHandler);

  // List all keys
  app.get('/keys', async (_request, reply) => {
    const keys = await apiKeyRepository.findAll();
    return reply.send({ success: true, data: keys.map(toPublic) });
  });

  // Get single key
  app.get('/keys/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const key = await apiKeyRepository.findById(id);
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

    const existing = await apiKeyRepository.findAll();
    if (existing.length >= 100) {
      return reply.status(400).send({ success: false, error: 'Maximum key limit reached (100)' });
    }

    const newKey = await apiKeyRepository.create(name.trim(), key);
    return reply.status(201).send({ success: true, data: toPublic(newKey) });
  });

  // Delete key
  app.delete('/keys/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await apiKeyRepository.delete(id);
    if (!deleted) return reply.status(404).send({ success: false, error: 'Key not found' });
    return reply.send({ success: true, data: { message: 'Key deleted' } });
  });

  // Get stats
  app.get('/stats', async (_request, reply) => {
    const keys = await apiKeyRepository.findAll();
    const liveKeys = keys.filter((k) => k.status === 'live');
    const deadKeys = keys.filter((k) => k.status === 'dead');
    const invalidKeys = keys.filter((k) => k.status === 'invalid');
    const deadByReason = {
      minute_limit: deadKeys.filter((k) => k.deadReason === 'minute_limit').length,
      daily_limit: deadKeys.filter((k) => k.deadReason === 'daily_limit').length,
      rate_limit: deadKeys.filter((k) => k.deadReason === 'rate_limit').length,
    };
    const defaultModel = appConfig.getDefaultModel();
    const defaultModelLimits = await modelRateLimitRepository.findOrCreate(defaultModel);

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

  // Update the default model (persisted to config.yml)
  app.put('/config', async (request, reply) => {
    const { defaultModel } = request.body as { defaultModel?: string };

    if (!defaultModel || typeof defaultModel !== 'string') {
      return reply.status(400).send({ success: false, error: 'Missing required field: defaultModel' });
    }

    const knownModels = await modelRateLimitRepository.findAll();
    if (!knownModels.some((m) => m.model === defaultModel)) {
      return reply.status(400).send({ success: false, error: 'Unknown model' });
    }

    const config = appConfig.setDefaultModel(defaultModel);
    return reply.send({ success: true, data: config });
  });

  // --- Model Rate Limits ---

  // List all model rate limits
  app.get('/models', async (_request, reply) => {
    const models = await modelRateLimitRepository.findAll();
    return reply.send({ success: true, data: models.map(modelToPublic) });
  });

  // Get single model
  app.get('/models/:model', async (request, reply) => {
    const { model } = request.params as { model: string };
    const record = await modelRateLimitRepository.findOrCreate(model);
    return reply.send({ success: true, data: modelToPublic(record) });
  });

  // Update model rate limits
  app.put('/models/:model', async (request, reply) => {
    const { model } = request.params as { model: string };
    const body = request.body as { rpm?: number; rpd?: number; tpm?: number };

    if (!body.rpm && !body.rpd && !body.tpm) {
      return reply.status(400).send({ success: false, error: 'Provide at least one: rpm, rpd, tpm' });
    }

    const updated = await modelRateLimitRepository.update(model, body);
    return reply.send({ success: true, data: modelToPublic(updated) });
  });

  // Delete model
  app.delete('/models/:model', async (request, reply) => {
    const { model } = request.params as { model: string };
    const deleted = await modelRateLimitRepository.delete(model);
    if (!deleted) return reply.status(404).send({ success: false, error: 'Model not found' });
    return reply.send({ success: true, data: { message: 'Model deleted' } });
  });
}
