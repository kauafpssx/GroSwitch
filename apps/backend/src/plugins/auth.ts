import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../lib/env';

export async function authPreHandler(request: FastifyRequest, reply: FastifyReply) {
  const headerKey = request.headers['x-api-key'];
  const queryKey = (request.query as Record<string, string>)?.api_key;

  const providedKey = headerKey || queryKey;

  if (!providedKey || providedKey !== env.MASTER_API_KEY) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized: Invalid or missing API key',
    });
  }
}
