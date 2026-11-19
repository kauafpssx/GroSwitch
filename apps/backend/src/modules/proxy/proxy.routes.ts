import type { FastifyInstance } from 'fastify';
import { authPreHandler } from '@/plugins/auth';
import { keysRepository } from '@/modules/keys/keys.repository';
import { modelsRepository } from '@/modules/models/models.repository';
import { appConfig } from '@/modules/models/config';
import { attemptGroqRequest } from './attempt';
import { proxyToGroq, proxyListModels, proxyGetModel } from './groq-client';
import { unavailable } from './errors';
import type { GroqResponse } from './groq-client';

function parseGroqBody(result: GroqResponse): unknown {
  try {
    return JSON.parse(result.body || '{}');
  } catch {
    return { error: { message: result.body || 'Invalid upstream response', type: 'upstream_error' } };
  }
}

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
  'qwen/qwen3.8-27b',
]);

// Groq's per-model cap on `max_tokens`/`max_completion_tokens`. OpenAI-SDK
// clients often send a fixed large value (e.g. sized for a 131K-context
// model) regardless of which model actually gets called — Groq 400s if it
// exceeds the target model's own completion cap, so clamp instead of
// forwarding it verbatim.
const MAX_COMPLETION_TOKENS: Record<string, number> = {
  'openai/gpt-oss-120b': 65536,
  'openai/gpt-oss-20b': 65536,
  'openai/gpt-oss-safeguard-20b': 65536,
  'qwen/qwen3.8-27b': 16384,
  'meta-llama/llama-prompt-guard-2-22m': 512,
  'meta-llama/llama-prompt-guard-2-86m': 512,
};

// Guard models are text-classifiers, not chat models, and don't support
// client-supplied tools. Every chat model in the current catalog does.
const NO_TOOL_MODELS = new Set([
  'meta-llama/llama-prompt-guard-2-22m',
  'meta-llama/llama-prompt-guard-2-86m',
  'openai/gpt-oss-safeguard-20b',
]);

// Groq's TPM limit counts prompt tokens *and* the requested `max_tokens`
// together — a client can send a small prompt and still get rejected if it
// asks for a huge completion budget the account's per-minute quota can't
// cover. `modelTpm` is this model's real per-key TPM from our own rate-limit
// table (accurate to the account, unlike Groq's theoretical per-model cap),
// so clamp against half of it to leave headroom for the prompt itself.
function sanitizeBody(
  body: Record<string, unknown>,
  model: string,
  modelTpm: number,
): Record<string, unknown> {
  const result = { ...body };

  if (!REASONING_MODELS.has(model)) {
    delete result.reasoning_effort;
  }

  if (NO_TOOL_MODELS.has(model)) {
    delete result.tools;
    delete result.tool_choice;
  }

  const modelCap = MAX_COMPLETION_TOKENS[model] ?? Infinity;
  const tpmCap = modelTpm > 0 ? Math.max(256, Math.floor(modelTpm / 2)) : Infinity;
  const cap = Math.min(modelCap, tpmCap);

  if (typeof result.max_tokens === 'number' && result.max_tokens > cap) {
    result.max_tokens = cap;
  }
  if (typeof result.max_completion_tokens === 'number' && result.max_completion_tokens > cap) {
    result.max_completion_tokens = cap;
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
      if (outcome.reason === 'upstream_rejected') {
        return reply.status(outcome.result.status).send(parseGroqBody(outcome.result));
      }
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
      if (outcome.reason === 'upstream_rejected') {
        return reply.status(outcome.result.status).send(parseGroqBody(outcome.result));
      }
      return reply.status(503).send(unavailable('No available API keys.'));
    }

    return reply.status(outcome.result.status).send(JSON.parse(outcome.result.body || '{}'));
  });

  // Streaming endpoint
  app.post('/chat/completions', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const model = (body.model as string) || appConfig.getDefaultModel();
    app.log.info(`Incoming body size: ${request.headers['content-length'] ?? 'unknown'} bytes`);
    // OpenAI's default is non-streaming unless the caller explicitly opts
    // in — clients that omit `stream` expect a plain JSON body back, not SSE.
    const isStream = body.stream === true;

    const rateLimit = await modelsRepository.findOrCreate(model);
    const sanitizedBody = sanitizeBody(body, model, rateLimit.tpm);
    const liveKeys = await keysRepository.findLiveKeys(rateLimit.rpd, rateLimit.rpm);
    const outcome = await attemptGroqRequest(app.log, rateLimit, liveKeys, (key) =>
      proxyToGroq(key, model, sanitizedBody, isStream),
    );

    if (!outcome.ok) {
      if (outcome.reason === 'upstream_rejected') {
        return reply.status(outcome.result.status).send(parseGroqBody(outcome.result));
      }
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
    app.log.info(`Incoming body size: ${request.headers['content-length'] ?? 'unknown'} bytes`);

    const rateLimit = await modelsRepository.findOrCreate(model);
    const sanitizedBody = sanitizeBody(body, model, rateLimit.tpm);
    const liveKeys = await keysRepository.findLiveKeys(rateLimit.rpd, rateLimit.rpm);
    const outcome = await attemptGroqRequest(app.log, rateLimit, liveKeys, (key) =>
      proxyToGroq(key, model, sanitizedBody, false),
    );

    if (!outcome.ok) {
      if (outcome.reason === 'upstream_rejected') {
        return reply.status(outcome.result.status).send(parseGroqBody(outcome.result));
      }
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
