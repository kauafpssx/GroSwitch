import type { FastifyInstance } from 'fastify';
import { authPreHandler } from '@/plugins/auth';
import { keysRepository } from '@/modules/keys/keys.repository';
import { modelsRepository } from '@/modules/models/models.repository';
import { appConfig } from '@/modules/models/config';
import { attemptGroqRequest } from './attempt';
import { proxyToGroq, proxyListModels, proxyGetModel } from './groq-client';
import { unavailable } from './errors';

// Model listing isn't tied to any single model's rpm/rpd — just needs a live
// key with headroom, so use generous limits rather than a real model's.
const MODEL_LIST_LIMITS = { rpm: 1000, rpd: 1_000_000 };

// Only Groq's reasoning-capable models accept `reasoning_effort`; every
// other model 400s on it. OpenAI-SDK clients (e.g. Hermes) send it by
// default on every request regardless of model, expecting the server to
// just ignore it if unsupported — so strip it here instead of letting it
// fail every key in the pool with the same 400.
const REASONING_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-safeguard-20b',
  'qwen/qwen3-32b',
  'qwen/qwen3.6-27b',
]);

// Groq's per-model cap on `max_tokens`/`max_completion_tokens`. OpenAI-SDK
// clients often send a fixed large value (e.g. sized for a 131K-context
// model) regardless of which model actually gets called — Groq 400s if it
// exceeds the target model's own completion cap, so clamp instead of
// forwarding it verbatim.
const MAX_COMPLETION_TOKENS: Record<string, number> = {
  'llama-3.1-8b-instant': 131072,
  'llama-3.3-70b-versatile': 32768,
  'openai/gpt-oss-120b': 65536,
  'openai/gpt-oss-20b': 65536,
  'openai/gpt-oss-safeguard-20b': 65536,
  'qwen/qwen3-32b': 16384,
  'qwen/qwen3.6-27b': 16384,
  'groq/compound': 8192,
  'groq/compound-mini': 8192,
  'meta-llama/llama-prompt-guard-2-22m': 512,
  'meta-llama/llama-prompt-guard-2-86m': 512,
};

function sanitizeBody(body: Record<string, unknown>, model: string): Record<string, unknown> {
  const result = { ...body };

  if (!REASONING_MODELS.has(model)) {
    delete result.reasoning_effort;
  }

  const cap = MAX_COMPLETION_TOKENS[model];
  if (cap !== undefined) {
    if (typeof result.max_tokens === 'number' && result.max_tokens > cap) {
      result.max_tokens = cap;
    }
    if (typeof result.max_completion_tokens === 'number' && result.max_completion_tokens > cap) {
      result.max_completion_tokens = cap;
    }
  }

  return result;
}

export async function proxyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authPreHandler);

  // OpenAI-compatible model listing — passes Groq's own catalog straight
  // through so it never drifts from what Groq actually has live.
  app.get('/models', async (_request, reply) => {
    const liveKeys = await keysRepository.findLiveKeys(MODEL_LIST_LIMITS.rpd, MODEL_LIST_LIMITS.rpm);
    const outcome = await attemptGroqRequest(app.log, MODEL_LIST_LIMITS, liveKeys, (key) => proxyListModels(key));

    if (!outcome.ok) {
      return reply.status(503).send(unavailable('No available API keys.'));
    }

    return reply.send(JSON.parse(outcome.result.body || '{}'));
  });

  // OpenAI-compatible single-model lookup.
  app.get('/models/:model', async (request, reply) => {
    const { model } = request.params as { model: string };
    const liveKeys = await keysRepository.findLiveKeys(MODEL_LIST_LIMITS.rpd, MODEL_LIST_LIMITS.rpm);
    const outcome = await attemptGroqRequest(app.log, MODEL_LIST_LIMITS, liveKeys, (key) => proxyGetModel(key, model));

    if (!outcome.ok) {
      return reply.status(503).send(unavailable('No available API keys.'));
    }

    return reply.status(outcome.result.status).send(JSON.parse(outcome.result.body || '{}'));
  });

  // Streaming endpoint
  app.post('/chat/completions', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const model = (body.model as string) || appConfig.getDefaultModel();
    // OpenAI's default is non-streaming unless the caller explicitly opts
    // in — clients that omit `stream` expect a plain JSON body back, not SSE.
    const isStream = body.stream === true;

    const sanitizedBody = sanitizeBody(body, model);
    const rateLimit = await modelsRepository.findOrCreate(model);
    const liveKeys = await keysRepository.findLiveKeys(rateLimit.rpd, rateLimit.rpm);
    const outcome = await attemptGroqRequest(app.log, rateLimit, liveKeys, (key) =>
      proxyToGroq(key, model, sanitizedBody, isStream),
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

    const sanitizedBody = sanitizeBody(body, model);
    const rateLimit = await modelsRepository.findOrCreate(model);
    const liveKeys = await keysRepository.findLiveKeys(rateLimit.rpd, rateLimit.rpm);
    const outcome = await attemptGroqRequest(app.log, rateLimit, liveKeys, (key) =>
      proxyToGroq(key, model, sanitizedBody, false),
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
