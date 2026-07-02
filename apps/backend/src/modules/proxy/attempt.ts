import type { FastifyBaseLogger } from 'fastify';
import { keysRepository, msUntilWindowExpires } from '@/modules/keys/keys.repository';
import { proxyToGroq, type GroqResponse } from './groq-client';
import type { ApiKey } from '@groswitch/common';

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

export type AttemptOutcome =
  | { ok: true; key: ApiKey; result: GroqResponse }
  | { ok: false; reason: 'no_keys' | 'exhausted' };

// Shared by both the streaming and sync chat/completions routes: picks a live
// key, respects the model's RPM before ever calling Groq, and retries across
// keys (or with backoff, for a single key) on 429/401/403/5xx.
export async function attemptGroqRequest(
  log: FastifyBaseLogger,
  model: string,
  body: Record<string, unknown>,
  stream: boolean,
  rateLimit: { rpm: number },
  liveKeys: ApiKey[],
): Promise<AttemptOutcome> {
  if (liveKeys.length === 0) {
    return { ok: false, reason: 'no_keys' };
  }

  const attempts = liveKeys.length === 1 ? SINGLE_KEY_RETRIES : liveKeys.length;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const selectedKey = liveKeys.length === 1 ? liveKeys[0] : liveKeys[attempt % liveKeys.length];

    try {
      const reserved = await keysRepository.tryReserveMinuteSlot(selectedKey.id, rateLimit.rpm);
      if (!reserved) {
        // Re-fetch key to get the current minuteWindowStart (updated by
        // tryReserveMinuteSlot). The stale value from liveKeys may be way off.
        const freshKey = await keysRepository.findById(selectedKey.id);
        const actualWindowStart = freshKey?.minuteWindowStart ?? selectedKey.minuteWindowStart;
        const cooldownMs = msUntilWindowExpires(actualWindowStart);
        await keysRepository.markDead(selectedKey.id, 'minute_limit', cooldownMs);
        log.warn(`Key "${selectedKey.name}" hit RPM limit (${rateLimit.rpm}). Cooldown: ${Math.ceil(cooldownMs / 1000)}s`);
        if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(cooldownMs);
        continue;
      }

      const result = await proxyToGroq(selectedKey, model, body, stream);

      if (result.status === 429) {
        const cooldownMs = parseCooldownMs(result.headers['retry-after']);
        await keysRepository.markDead(selectedKey.id, 'rate_limit', cooldownMs);
        log.warn(`Key "${selectedKey.name}" rate-limited. Cooldown: ${cooldownMs / 1000}s`);
        if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(RETRY_DELAY_MS);
        continue;
      }

      if (result.status === 401 || result.status === 403) {
        await keysRepository.markInvalid(selectedKey.id);
        log.warn(`Key "${selectedKey.name}" invalid (status ${result.status}).`);
        continue;
      }

      if (result.status !== 200) {
        log.warn(`Key "${selectedKey.name}" returned ${result.status}: ${result.body}`);
        if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(RETRY_DELAY_MS);
        continue;
      }

      await keysRepository.incrementDailyCount(selectedKey.id);
      if (selectedKey.status === 'dead') {
        await keysRepository.markLive(selectedKey.id);
      }

      return { ok: true, key: selectedKey, result };
    } catch (err) {
      log.error(err, `Proxy attempt ${attempt + 1} failed for key "${selectedKey.name}"`);
      if (liveKeys.length === 1 && attempt < attempts - 1) await sleep(RETRY_DELAY_MS);
      continue;
    }
  }

  return { ok: false, reason: 'exhausted' };
}
