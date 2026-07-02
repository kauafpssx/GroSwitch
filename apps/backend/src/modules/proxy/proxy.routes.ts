import type { FastifyInstance } from 'fastify';
import { authPreHandler } from '@/plugins/auth';
import { keysRepository } from '@/modules/keys/keys.repository';
import { modelsRepository } from '@/modules/models/models.repository';
import { appConfig } from '@/modules/models/config';
import { attemptGroqRequest } from './attempt';
import { proxyToGroq } from './groq-client';

function unavailable(message: string) {
  return { error: { message, code: 503, status: 'UNAVAILABLE' } };
}

export async function proxyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authPreHandler);

  // Streaming endpoint
  app.post('/chat/completions', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const model = (body.model as string) || appConfig.getDefaultModel();
    const isStream = body.stream !== false;

    const rateLimit = await modelsRepository.findOrCreate(model);
    const liveKeys = await keysRepository.findLiveKeys(rateLimit.rpd, rateLimit.rpm);
    const outcome = await attemptGroqRequest(app.log, rateLimit, liveKeys, (key) =>
      proxyToGroq(key, model, body, isStream),
    );

    if (!outcome.ok) {
      const message =
        outcome.reason === 'no_keys'
          ? 'No available API keys. All keys are rate-limited or invalid.'
          : 'All keys exhausted.';
      return reply.status(503).send(unavailable(message));
    }

    const { key, result } = outcome;

    if (!isStream || !result.stream) {
      const data = JSON.parse(result.body || '{}');
      const totalTokens = data?.usage?.total_tokens;
      if (typeof totalTokens === 'number' && totalTokens > 0) {
        await keysRepository.addTokens(key.id, totalTokens);
      }
      return reply.send(data);
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const reader = result.stream.getReader();
    const decoder = new TextDecoder();
    let lastChunk = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
        lastChunk = decoder.decode(value, { stream: true });
      }
    } catch (err) {
      app.log.error(err, 'Stream read error');
    } finally {
      reply.raw.end();
      try {
        const lines = lastChunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const json = JSON.parse(line.slice(6));
            const totalTokens = json?.usage?.total_tokens;
            if (typeof totalTokens === 'number' && totalTokens > 0) {
              await keysRepository.addTokens(key.id, totalTokens);
            }
          }
        }
      } catch {}
    }

    return reply;
  });

  // Non-streaming endpoint
  app.post('/chat/completions/sync', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const model = (body.model as string) || appConfig.getDefaultModel();

    const rateLimit = await modelsRepository.findOrCreate(model);
    const liveKeys = await keysRepository.findLiveKeys(rateLimit.rpd, rateLimit.rpm);
    const outcome = await attemptGroqRequest(app.log, rateLimit, liveKeys, (key) =>
      proxyToGroq(key, model, body, false),
    );

    if (!outcome.ok) {
      const message = outcome.reason === 'no_keys' ? 'No available API keys.' : 'All keys exhausted.';
      return reply.status(503).send(unavailable(message));
    }

    const { key, result } = outcome;
    const data = JSON.parse(result.body || '{}');
    const totalTokens = data?.usage?.total_tokens;
    if (typeof totalTokens === 'number' && totalTokens > 0) {
      await keysRepository.addTokens(key.id, totalTokens);
    }

    return reply.send(data);
  });
}
