import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';
import type { ApiKey, ApiKeyStatus, DeadReason } from '@groswitch/common';

const DEFAULT_RPM = 30;

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getCurrentMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

export function msUntilNextMinute(): number {
  const now = Date.now();
  const nextMinute = (Math.floor(now / 60_000) + 1) * 60_000;
  return Math.max(1000, nextMinute - now);
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
        minuteWindowStart: getCurrentMinute(),
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
    const currentMinute = getCurrentMinute();
    const dailyLimit = modelRpd ?? 0;
    const minuteLimit = modelRpm ?? DEFAULT_RPM;

    // A key that already hit this model's RPM for the current window would
    // otherwise just be silently excluded below (status still "live"), so
    // the dashboard would never show it as rate-limited. Mark it dead with
    // a cooldown here instead, before it gets filtered out.
    await prisma.apiKey.updateMany({
      where: {
        status: 'live',
        minuteWindowStart: currentMinute,
        minuteCount: { gte: minuteLimit },
      },
      data: {
        status: 'dead',
        deadReason: 'minute_limit',
        limitedUntil: new Date(now.getTime() + msUntilNextMinute()),
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
            OR: [
              { minuteWindowStart: { not: currentMinute } },
              { minuteCount: { lt: minuteLimit } },
            ],
          },
        ],
      },
      orderBy: { lastUsedAt: 'asc' },
    });
    return records.map(this.toDomain);
  },

  // Atomically reserves one RPM slot for this key and returns whether it
  // succeeded. Must be called *before* the Groq call, not after — checking a
  // snapshot of minuteCount and incrementing only on success (the old
  // approach) lets concurrent requests all pass the "under limit" check at
  // once and over-admit past the RPM ceiling. Using single conditional
  // UPDATE statements (not read-then-write) also means concurrent callers
  // can't clobber each other's increments.
  async tryReserveMinuteSlot(id: string, minuteLimit: number): Promise<boolean> {
    const currentMinute = getCurrentMinute();

    const incremented = await prisma.apiKey.updateMany({
      where: { id, minuteWindowStart: currentMinute, minuteCount: { lt: minuteLimit } },
      data: { minuteCount: { increment: 1 } },
    });
    if (incremented.count > 0) return true;

    // First request of a new minute window for this key.
    const reset = await prisma.apiKey.updateMany({
      where: { id, minuteWindowStart: { not: currentMinute } },
      data: { minuteCount: 1, minuteWindowStart: currentMinute },
    });
    if (reset.count > 0) return true;

    // Another concurrent request just claimed the fresh window — retry the
    // conditional increment now that minuteWindowStart should be current.
    const retried = await prisma.apiKey.updateMany({
      where: { id, minuteWindowStart: currentMinute, minuteCount: { lt: minuteLimit } },
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
    const currentMinute = getCurrentMinute();
    await prisma.apiKey.updateMany({
      where: {
        minuteWindowStart: { lt: currentMinute },
      },
      data: {
        minuteCount: 0,
        minuteWindowStart: currentMinute,
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
