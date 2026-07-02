import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { env } from '@/lib/env';
import { prisma, disconnectPrisma } from '@/lib/prisma';
import { authPreHandler } from '@/plugins/auth';
import { proxyRoutes } from '@/modules/proxy/proxy.routes';
import { audioRoutes } from '@/modules/proxy/audio.routes';
import { keysRoutes } from '@/modules/keys/keys.routes';
import { modelsRoutes } from '@/modules/models/models.routes';
import { startKeyMonitor } from '@/workers/keyMonitor';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  // Default is 1MB; vision requests send images as base64 data URIs inside
  // the JSON body, which inflates well past that.
  bodyLimit: 20 * 1024 * 1024,
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
    },
  },
});

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-KEY'],
});

// Groq's Whisper transcription endpoint caps uploads at 25MB.
await app.register(multipart, {
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Health check (no auth)
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Status endpoint - shows key counts, requires the master API key
app.get('/status', { preHandler: authPreHandler }, async () => {
  const total = await prisma.apiKey.count();
  const live = await prisma.apiKey.count({ where: { status: 'live' } });
  const dead = await prisma.apiKey.count({ where: { status: 'dead' } });
  const invalid = await prisma.apiKey.count({ where: { status: 'invalid' } });
  return { total, live, dead, invalid };
});

// Protected routes
await app.register(proxyRoutes, { prefix: '/v1' });
await app.register(audioRoutes, { prefix: '/v1' });
await app.register(keysRoutes, { prefix: '/api/v1' });
await app.register(modelsRoutes, { prefix: '/api/v1' });

// Start background worker
const stopMonitor = startKeyMonitor(env.KEY_MONITOR_INTERVAL_MS);

// Serve built frontend (production) — if dist/ exists, serve static files
// and fall back to index.html for SPA routing.
// Resolves correctly both from dev (src/) and prod (dist/) locations:
//   src/  → ../../frontend/dist = <root>/apps/frontend/dist
//   dist/ → ../../frontend/dist = <root>/apps/frontend/dist
const FRONTEND_DIST = resolve(__dirname, '../../frontend/dist');
if (existsSync(FRONTEND_DIST) && existsSync(resolve(FRONTEND_DIST, 'index.html'))) {
  await app.register(fastifyStatic, {
    root: FRONTEND_DIST,
    prefix: '/',
    wildcard: false,
  });

  // SPA fallback: any unmatched GET request serves index.html
  app.setNotFoundHandler(async (request, reply) => {
    if (request.method === 'GET') {
      return reply.sendFile('index.html');
    }
    return reply.status(404).send({ error: 'Not found' });
  });

  app.log.info(`Serving frontend from ${FRONTEND_DIST}`);
}

// Graceful shutdown
async function shutdown() {
  app.log.info('Shutting down...');
  stopMonitor();
  await app.close();
  await disconnectPrisma();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ port: env.PORT, host: '::' });
  app.log.info(`GroSwitch running on http://localhost:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
