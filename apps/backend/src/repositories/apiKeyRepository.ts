import { prisma } from '../lib/prisma';
import { encrypt, decrypt } from '../lib/crypto';
import { env } from '../lib/env';
import type { ApiKey, ApiKeyStatus, DeadReason } from '@gemrouter/common';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getCurrentMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

export const apiKeyRepository = {
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

  async findAll(): Promise<ApiKey[]> {
    const records = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
    return records.map(this.toDomain);
  },

  async findById(id: string): Promise<ApiKey | null> {
    const record = await prisma.apiKey.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  },

  async findLiveKeys(modelRpd?: number): Promise<ApiKey[]> {
    const now = new Date();
    const today = getTodayString();
    const currentMinute = getCurrentMinute();
    const dailyLimit = modelRpd ?? env.DAILY_REQUEST_LIMIT;
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
              { minuteCount: { lt: 30 } },
            ],
          },
        ],
      },
      orderBy: { lastUsedAt: 'asc' },
    });
    return records.map(this.toDomain);
  },

  async incrementMinuteCount(id: string): Promise<{ count: number; minute: number }> {
    const currentMinute = getCurrentMinute();
    const record = await prisma.apiKey.findUnique({ where: { id } });
    if (!record) throw new Error('Key not found');

    if (record.minuteWindowStart !== currentMinute) {
      await prisma.apiKey.update({
        where: { id },
        data: { minuteCount: 1, minuteWindowStart: currentMinute },
      });
      return { count: 1, minute: currentMinute };
    }

    const newCount = record.minuteCount + 1;
    await prisma.apiKey.update({
      where: { id },
      data: { minuteCount: newCount },
    });

    return { count: newCount, minute: currentMinute };
  },

  async incrementDailyCount(id: string): Promise<{ count: number; date: string }> {
    const today = getTodayString();
    const record = await prisma.apiKey.findUnique({ where: { id } });
    if (!record) throw new Error('Key not found');

    if (record.dailyCountDate !== today) {
      await prisma.apiKey.update({
        where: { id },
        data: { dailyCount: 1, dailyCountDate: today, lastUsedAt: new Date() },
      });
      return { count: 1, date: today };
    }

    const newCount = record.dailyCount + 1;
    await prisma.apiKey.update({
      where: { id },
      data: { dailyCount: newCount, lastUsedAt: new Date() },
    });

    return { count: newCount, date: today };
  },

  async addTokens(id: string, tokens: number): Promise<void> {
    await prisma.apiKey.update({
      where: { id },
      data: { totalTokens: { increment: tokens } },
    });
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
