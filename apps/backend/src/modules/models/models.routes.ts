import type { FastifyInstance } from 'fastify';
import { authPreHandler } from '@/plugins/auth';
import { modelsRepository } from './models.repository';
import { appConfig } from './config';
import type { ModelRateLimitPublic } from '@groswitch/common';

function toPublic(m: import('@groswitch/common').ModelRateLimit): ModelRateLimitPublic {
  return {
    id: m.id,
    model: m.model,
    rpm: m.rpm,
    rpd: m.rpd,
    tpm: m.tpm,
  };
}

export async function modelsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authPreHandler);

  // List all model rate limits
  app.get('/models', async (_request, reply) => {
    const models = await modelsRepository.findAll();
    return reply.send({ success: true, data: models.map(toPublic) });
  });

  // Get single model
  app.get('/models/:model', async (request, reply) => {
    const { model } = request.params as { model: string };
    const record = await modelsRepository.findOrCreate(model);
    return reply.send({ success: true, data: toPublic(record) });
  });

  // Update model rate limits
  app.put('/models/:model', async (request, reply) => {
    const { model } = request.params as { model: string };
    const body = request.body as { rpm?: number; rpd?: number; tpm?: number };

    if (!body.rpm && !body.rpd && !body.tpm) {
      return reply.status(400).send({ success: false, error: 'Provide at least one: rpm, rpd, tpm' });
    }

    const updated = await modelsRepository.update(model, body);
    return reply.send({ success: true, data: toPublic(updated) });
  });

  // Delete model
  app.delete('/models/:model', async (request, reply) => {
    const { model } = request.params as { model: string };
    const deleted = await modelsRepository.delete(model);
    if (!deleted) return reply.status(404).send({ success: false, error: 'Model not found' });
    return reply.send({ success: true, data: { message: 'Model deleted' } });
  });

  // Update the default model (persisted to config.yml)
  app.put('/config', async (request, reply) => {
    const { defaultModel } = request.body as { defaultModel?: string };

    if (!defaultModel || typeof defaultModel !== 'string') {
      return reply.status(400).send({ success: false, error: 'Missing required field: defaultModel' });
    }

    const knownModels = await modelsRepository.findAll();
    if (!knownModels.some((m) => m.model === defaultModel)) {
      return reply.status(400).send({ success: false, error: 'Unknown model' });
    }

    const config = appConfig.setDefaultModel(defaultModel);
    return reply.send({ success: true, data: config });
  });
}
