import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';
import type { ApiKey, ApiKeyStatus, DeadReason } from '@groswitch/common';

const DEFAULT_RPM = 30;

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

const MINUTE_MS = 60_000;

export function msUntilWindowExpires(windowStart: number): number {
  return Math.max(1000, windowStart + MINUTE_MS - Date.now());
}

export const keysRepository = {
  async create(name: string, rawKey: string): Promise<ApiKey> {
    const encryptedKey = encrypt(rawKey);
    const record = await prisma.apiKey.create({
      data: {
        name,
        key: encryptedKey,
        status: 'live',
        dailyCount: 0,
        dailyCountDate: getTodayString(),
        minuteCount: 0,
        minuteWindowStart: Date.now(),
      },
    });
    return this.toDomain(record);
  },

  async update(id: string, data: { name?: string; rawKey?: string }): Promise<ApiKey | null> {
    const updateData: { name?: string; key?: string; status?: string; deadReason?: string; limitedUntil?: null } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.rawKey !== undefined) {
      // Swapping in a new credential clears whatever rate-limit/invalid state
      // belonged to the old one.
      updateData.key = encrypt(data.rawKey);
      updateData.status = 'live';
      updateData.deadReason = '';
      updateData.limitedUntil = null;
    }

    try {
      const record = await prisma.apiKey.update({ where: { id }, data: updateData });
      return this.toDomain(record);
    } catch {
      return null;
    }
  },

  async findAll(): Promise<ApiKey[]> {
    const records = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
    return records.map(this.toDomain);
  },

  async findById(id: string): Promise<ApiKey | null> {
    const record = await prisma.apiKey.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  },

  async findLiveKeys(modelRpd?: number, modelRpm?: number): Promise<ApiKey[]> {
    const now = new Date();
    const today = getTodayString();
    const nowMs = Date.now();
    const windowCutoff = nowMs - MINUTE_MS;
    const dailyLimit = modelRpd ?? 0;
    const minuteLimit = modelRpm ?? DEFAULT_RPM;

    // Pre-emptively mark keys that are over the sliding-window limit as dead
    // so the dashboard reflects their state.
    await prisma.apiKey.updateMany({
      where: {
        status: 'live',
        minuteWindowStart: { gte: windowCutoff },
        minuteCount: { gte: minuteLimit },
      },
      data: {
        status: 'dead',
        deadReason: 'minute_limit',
        limitedUntil: new Date(nowMs + MINUTE_MS),
      },
    });

    const records = await prisma.apiKey.findMany({
      where: {
        AND: [
          {
            OR: [
              { status: 'live' },
              { AND: [{ status: 'dead' }, { limitedUntil: { lte: now } }] },
            ],
          },
          { dailyCountDate: today },
          { dailyCount: { lt: dailyLimit } },
          {
            OR: [
              { limitedUntil: null },
              { limitedUntil: { lte: now } },
            ],
          },
          {
            // Sliding window: window expired OR active but under limit
            OR: [
              { minuteWindowStart: { lt: windowCutoff } },
              { minuteCount: { lt: minuteLimit } },
            ],
          },
        ],
      },
      orderBy: { lastUsedAt: 'asc' },
    });
    return records.map(this.toDomain);
  },

  // Atomically reserves one RPM slot for this key using a sliding window.
  // Returns true if the slot was reserved (key is under the RPM limit).
  // Uses single conditional UPDATE statements to prevent over-admission
  // from concurrent requests (no read-then-write race).
  async tryReserveMinuteSlot(id: string, minuteLimit: number): Promise<boolean> {
    const nowMs = Date.now();
    const windowCutoff = nowMs - MINUTE_MS;

    // Window still active and under limit — just increment.
    const incremented = await prisma.apiKey.updateMany({
      where: {
        id,
        minuteWindowStart: { gte: windowCutoff },
        minuteCount: { lt: minuteLimit },
      },
      data: { minuteCount: { increment: 1 } },
    });
    if (incremented.count > 0) return true;

    // Window expired — start a new one with count=1.
    const reset = await prisma.apiKey.updateMany({
      where: {
        id,
        minuteWindowStart: { lt: windowCutoff },
      },
      data: { minuteCount: 1, minuteWindowStart: nowMs },
    });
    if (reset.count > 0) return true;

    // Another request just claimed the fresh window — retry increment.
    const retried = await prisma.apiKey.updateMany({
      where: {
        id,
        minuteWindowStart: { gte: windowCutoff },
        minuteCount: { lt: minuteLimit },
      },
      data: { minuteCount: { increment: 1 } },
    });
    return retried.count > 0;
  },

  async incrementDailyCount(id: string): Promise<void> {
    const today = getTodayString();

    const incremented = await prisma.apiKey.updateMany({
      where: { id, dailyCountDate: today },
      data: { dailyCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    if (incremented.count > 0) return;

    // First request of a new day for this key.
    await prisma.apiKey.updateMany({
      where: { id },
      data: { dailyCount: 1, dailyCountDate: today, lastUsedAt: new Date() },
    });
  },

  async addTokens(id: string, tokens: number): Promise<void> {
    await prisma.apiKey.update({
      where: { id },
      data: { totalTokens: { increment: tokens } },
    });
  },

  async resetAllTokens(): Promise<void> {
    await prisma.apiKey.updateMany({ data: { totalTokens: 0 } });
  },

  async markDead(id: string, reason: DeadReason, cooldownMs?: number): Promise<void> {
    const data: { status: string; deadReason: string; limitedUntil?: Date } = {
      status: 'dead',
      deadReason: reason,
    };
    if (cooldownMs) {
      data.limitedUntil = new Date(Date.now() + cooldownMs);
    }
    await prisma.apiKey.update({ where: { id }, data });
  },

  async markLive(id: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id },
      data: { status: 'live', limitedUntil: null, deadReason: '' },
    });
  },

  async markInvalid(id: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id },
      data: { status: 'invalid', limitedUntil: null, deadReason: 'invalid_key' },
    });
  },

  async resetMinuteWindows(): Promise<void> {
    const nowMs = Date.now();
    await prisma.apiKey.updateMany({
      where: {
        minuteWindowStart: { lt: nowMs - MINUTE_MS },
      },
      data: {
        minuteCount: 0,
        minuteWindowStart: nowMs,
      },
    });
  },

  async resetDailyCounts(): Promise<void> {
    const today = getTodayString();
    // Reset daily counters + revive expired dead keys
    await prisma.apiKey.updateMany({
      where: {
        dailyCountDate: { not: today },
        status: { not: 'invalid' },
      },
      data: {
        dailyCount: 0,
        dailyCountDate: today,
        status: 'live',
        limitedUntil: null,
        deadReason: '',
      },
    });
    // Revive keys whose cooldown expired
    await prisma.apiKey.updateMany({
      where: {
        status: 'dead',
        limitedUntil: { not: null, lte: new Date() },
      },
      data: {
        status: 'live',
        limitedUntil: null,
        deadReason: '',
      },
    });
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.apiKey.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  getDecryptedKey(encryptedKey: string): string {
    return decrypt(encryptedKey);
  },

  toDomain(record: {
    id: string;
    name: string;
    key: string;
    status: string;
    lastUsedAt: Date | null;
    limitedUntil: Date | null;
    deadReason: string;
    dailyCount: number;
    dailyCountDate: string;
    minuteCount: number;
    minuteWindowStart: number;
    totalTokens: number;
    createdAt: Date;
    updatedAt: Date;
  }): ApiKey {
    return {
      id: record.id,
      name: record.name,
      key: record.key,
      status: record.status as ApiKeyStatus,
      lastUsedAt: record.lastUsedAt,
      limitedUntil: record.limitedUntil,
      deadReason: record.deadReason as DeadReason,
      dailyCount: record.dailyCount,
      dailyCountDate: record.dailyCountDate,
      minuteCount: record.minuteCount,
      minuteWindowStart: record.minuteWindowStart,
      totalTokens: record.totalTokens ?? 0,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  },
};
