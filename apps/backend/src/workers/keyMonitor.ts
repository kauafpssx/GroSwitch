import { keysRepository } from '@/modules/keys/keys.repository';

export function startKeyMonitor(intervalMs: number): () => void {
  const logger = {
    info: (msg: string) => console.log(`[KeyMonitor] ${msg}`),
    warn: (msg: string) => console.warn(`[KeyMonitor] ${msg}`),
  };

  const interval = setInterval(async () => {
    try {
      await keysRepository.resetMinuteWindows();
      await keysRepository.resetDailyCounts();
    } catch (err) {
      logger.warn(`Error in key monitor: ${err}`);
    }
  }, intervalMs);

  logger.info(`Key monitor started (interval: ${intervalMs}ms)`);

  return () => {
    clearInterval(interval);
    logger.info('Key monitor stopped');
  };
}
