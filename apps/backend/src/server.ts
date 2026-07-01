import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from '@/lib/env';
import { prisma, disconnectPrisma } from '@/lib/prisma';
import { authPreHandler } from '@/plugins/auth';
import { proxyRoutes } from '@/modules/proxy/proxy.routes';
import { keysRoutes } from '@/modules/keys/keys.routes';
import { modelsRoutes } from '@/modules/models/models.routes';
import { startKeyMonitor } from '@/workers/keyMonitor';

const app = Fastify({
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
await app.register(keysRoutes, { prefix: '/api/v1' });
await app.register(modelsRoutes, { prefix: '/api/v1' });

// Start background worker
const stopMonitor = startKeyMonitor(env.KEY_MONITOR_INTERVAL_MS);

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
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`GroSwitch running on http://localhost:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
