import { timingSafeEqual } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '@/lib/env';

// Constant-time compare so response timing can't leak how many leading
// characters of the master key a guess got right.
function safeEquals(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

export async function authPreHandler(request: FastifyRequest, reply: FastifyReply) {
  const providedKey = request.headers['x-api-key'];

  if (typeof providedKey !== 'string' || !safeEquals(providedKey, env.MASTER_API_KEY)) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized: Invalid or missing API key',
    });
  }
}
