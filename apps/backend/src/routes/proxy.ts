import type { FastifyInstance } from 'fastify';
import { authPreHandler } from '../plugins/auth';
import { apiKeyRepository } from '../repositories/apiKeyRepository';
import { modelRateLimitRepository } from '../repositories/modelRateLimitRepository';
import { env } from '../lib/env';
import { appConfig } from '../lib/config';
import type { ApiKey } from '@gemrouter/common';

const SINGLE_KEY_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const DEFAULT_COOLDOWN_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCooldownMs(retryAfterHeader: string | undefined): number {
  if (!retryAfterHeader) return DEFAULT_COOLDOWN_MS;
  const seconds = parseInt(retryAfterHeader, 10);
  return isNaN(seconds) ? DEFAULT_COOLDOWN_MS : seconds * 1000;
}

function msUntilNextMinute(): number {
  const now = Date.now();
  const nextMinute = (Math.floor(now / 60_000) + 1) * 60_000;
  return Math.max(1000, nextMinute - now);
}

async function proxyToGroq(
  apiKey: ApiKey,
  model: string,
  body: Record<string, unknown>,
  stream: boolean,
): Promise<{ status: number; headers: Record<string, string>; stream: ReadableStream | null; body?: string }> {
  const decryptedKey = apiKeyRepository.getDecryptedKey(apiKey.key);
  const endpoint = stream ? 'chat/completions' : 'chat/completions';

  const requestBody = { ...body, model, stream };

  const response = await fetch(`${env.GROQ_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${decryptedKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  let bodyText: string | undefined;
  if (response.status !== 200) {
    try {
      bodyText = await response.text();
    } catch {
      bodyText = '{"error":{"message":"Failed to read upstream response"}}';
    }
  }

  return {
    status: response.status,
    headers: responseHeaders,
    stream: response.status === 200 && stream ? (response.body as ReadableStream) : null,
    body: bodyText,
  };
}

export async function proxyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authPreHandler);

  // Streaming endpoint
  app.post('/chat/completions', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const model = (body.model as string) || appConfig.getDefaultModel();
    const isStream = body.stream !== false;

    const rateLimit = await modelRateLimitRepository.findOrCreate(model);
    const liveKeys = await apiKeyRepository.findLiveKeys(rateLimit.rpd);

    if (liveKeys.length === 0) {
      return reply.status(503).send({
        error: {
          message: 'No available API keys. All keys are rate-limited or invalid.',
          code: 503,
          status: 'UNAVAILABLE',
        },
      });
    }

    const attempts = liveKeys.length === 1 ? SINGLE_KEY_RETRIES : liveKeys.length;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const selectedKey = liveKeys.length === 1
        ? liveKeys[0]
        : liveKeys[attempt % liveKeys.length];

      try {
        const currentMinute = Math.floor(Date.now() / 60_000);
        const isInSameMinute = selectedKey.minuteWindowStart === currentMinute;

        if (isInSameMinute && selectedKey.minuteCount >= rateLimit.rpm) {
          const cooldownMs = msUntilNextMinute();
          await apiKeyRepository.markDead(selectedKey.id, 'minute_limit', cooldownMs);
          app.log.warn(`Key "${selectedKey.name}" hit RPM limit (${rateLimit.rpm}). Cooldown: ${Math.ceil(cooldownMs / 1000)}s`);
          if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(cooldownMs);
          continue;
        }

        const result = await proxyToGroq(selectedKey, model, body, isStream);

        if (result.status === 429) {
          const cooldownMs = parseCooldownMs(result.headers['retry-after']);
          await apiKeyRepository.markDead(selectedKey.id, 'rate_limit', cooldownMs);
          app.log.warn(`Key "${selectedKey.name}" rate-limited. Cooldown: ${cooldownMs / 1000}s`);
          if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(RETRY_DELAY_MS);
          continue;
        }

        if (result.status === 401 || result.status === 403) {
          await apiKeyRepository.markInvalid(selectedKey.id);
          app.log.warn(`Key "${selectedKey.name}" invalid (status ${result.status}).`);
          continue;
        }

        if (result.status !== 200) {
          app.log.warn(`Key "${selectedKey.name}" returned ${result.status}: ${result.body}`);
          if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(RETRY_DELAY_MS);
          continue;
        }

        await apiKeyRepository.incrementMinuteCount(selectedKey.id);
        await apiKeyRepository.incrementDailyCount(selectedKey.id);
        if (selectedKey.status === 'dead') {
          await apiKeyRepository.markLive(selectedKey.id);
        }

        if (!isStream || !result.stream) {
          const data = JSON.parse(result.body || '{}');
          const totalTokens = data?.usage?.total_tokens;
          if (typeof totalTokens === 'number' && totalTokens > 0) {
            await apiKeyRepository.addTokens(selectedKey.id, totalTokens);
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
                  await apiKeyRepository.addTokens(selectedKey.id, totalTokens);
                }
              }
            }
          } catch {}
        }

        return reply;
      } catch (err) {
        app.log.error(err, `Proxy attempt ${attempt + 1} failed for key "${selectedKey.name}"`);
        if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(RETRY_DELAY_MS);
        continue;
      }
    }

    return reply.status(503).send({
      error: {
        message: 'All keys exhausted.',
        code: 503,
        status: 'UNAVAILABLE',
      },
    });
  });

  // Non-streaming endpoint
  app.post('/chat/completions/sync', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const model = (body.model as string) || appConfig.getDefaultModel();

    const rateLimit = await modelRateLimitRepository.findOrCreate(model);
    const liveKeys = await apiKeyRepository.findLiveKeys(rateLimit.rpd);

    if (liveKeys.length === 0) {
      return reply.status(503).send({
        error: {
          message: 'No available API keys.',
          code: 503,
          status: 'UNAVAILABLE',
        },
      });
    }

    const attempts = liveKeys.length === 1 ? SINGLE_KEY_RETRIES : liveKeys.length;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const selectedKey = liveKeys.length === 1
        ? liveKeys[0]
        : liveKeys[attempt % liveKeys.length];

      try {
        const currentMinute = Math.floor(Date.now() / 60_000);
        const isInSameMinute = selectedKey.minuteWindowStart === currentMinute;

        if (isInSameMinute && selectedKey.minuteCount >= rateLimit.rpm) {
          const cooldownMs = msUntilNextMinute();
          await apiKeyRepository.markDead(selectedKey.id, 'minute_limit', cooldownMs);
          app.log.warn(`Key "${selectedKey.name}" hit RPM limit (${rateLimit.rpm}). Cooldown: ${Math.ceil(cooldownMs / 1000)}s`);
          if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(cooldownMs);
          continue;
        }

        const result = await proxyToGroq(selectedKey, model, body, false);

        if (result.status === 429) {
          const cooldownMs = parseCooldownMs(result.headers['retry-after']);
          await apiKeyRepository.markDead(selectedKey.id, 'rate_limit', cooldownMs);
          app.log.warn(`Key "${selectedKey.name}" rate-limited. Cooldown: ${cooldownMs / 1000}s`);
          if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(RETRY_DELAY_MS);
          continue;
        }

        if (result.status === 401 || result.status === 403) {
          await apiKeyRepository.markInvalid(selectedKey.id);
          app.log.warn(`Key "${selectedKey.name}" invalid (status ${result.status}).`);
          continue;
        }

        if (result.status !== 200) {
          app.log.warn(`Key "${selectedKey.name}" returned ${result.status}: ${result.body}`);
          if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(RETRY_DELAY_MS);
          continue;
        }

        await apiKeyRepository.incrementMinuteCount(selectedKey.id);
        await apiKeyRepository.incrementDailyCount(selectedKey.id);
        if (selectedKey.status === 'dead') {
          await apiKeyRepository.markLive(selectedKey.id);
        }

        const data = JSON.parse(result.body || '{}');
        const totalTokens = data?.usage?.total_tokens;
        if (typeof totalTokens === 'number' && totalTokens > 0) {
          await apiKeyRepository.addTokens(selectedKey.id, totalTokens);
        }

        return reply.send(data);
      } catch (err) {
        app.log.error(err, `Sync proxy attempt ${attempt + 1} failed`);
        if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(RETRY_DELAY_MS);
        continue;
      }
    }

    return reply.status(503).send({
      error: { message: 'All keys exhausted.', code: 503, status: 'UNAVAILABLE' },
    });
  });
}
