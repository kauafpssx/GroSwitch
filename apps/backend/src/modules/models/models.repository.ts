import { readFileSync } from 'fs';
import { resolve } from 'path';
import { prisma } from '@/lib/prisma';
import { ROOT_DIR } from '@/lib/paths';
import type { ModelRateLimit } from '@groswitch/common';

interface RateLimit {
  rpm: number;
  rpd: number;
  tpm: number;
}

const FALLBACK_RATE_LIMIT: RateLimit = { rpm: 30, rpd: 1000, tpm: 8000 };

function loadCsvRateLimits(): Record<string, RateLimit> {
  // Resolve from the repo root, not import.meta.dir, so this works both
  // from source (apps/backend/src/modules/models/) and from the bundled
  // output (apps/backend/dist/) where import.meta.dir differs.
  const csvPath = resolve(ROOT_DIR, 'apps/backend/src/modules/models/model-rate-limits.csv');
  const content = readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n').slice(1); // skip header
  const limits: Record<string, RateLimit> = {};

  for (const line of lines) {
    const [model, rpm, rpd, tpm] = line.split(',');
    if (model) {
      limits[model.trim()] = {
        rpm: parseInt(rpm, 10) || FALLBACK_RATE_LIMIT.rpm,
        rpd: parseInt(rpd, 10) || FALLBACK_RATE_LIMIT.rpd,
        tpm: parseInt(tpm, 10) || FALLBACK_RATE_LIMIT.tpm,
      };
    }
  }
  return limits;
}

const RATE_LIMITS = loadCsvRateLimits();

export const modelsRepository = {
  async findOrCreate(model: string): Promise<ModelRateLimit> {
    const existing = await prisma.modelRateLimit.findUnique({ where: { model } });
    if (existing) return this.toDomain(existing);

    const defaults = RATE_LIMITS[model] || FALLBACK_RATE_LIMIT;

    const record = await prisma.modelRateLimit.create({
      data: { model, rpm: defaults.rpm, rpd: defaults.rpd, tpm: defaults.tpm },
    });
    return this.toDomain(record);
  },

  async findAll(): Promise<ModelRateLimit[]> {
    const records = await prisma.modelRateLimit.findMany({ orderBy: { model: 'asc' } });
    const byModel = new Map(records.map((r) => [r.model, r]));

    // Every model from the CSV shows up even if it has never been used yet
    // (and thus has no row in the DB); DB overrides win when present.
    const merged: ModelRateLimit[] = Object.entries(RATE_LIMITS).map(([model, defaults]) => {
      const record = byModel.get(model);
      if (record) return this.toDomain(record);
      return {
        id: model,
        model,
        rpm: defaults.rpm,
        rpd: defaults.rpd,
        tpm: defaults.tpm,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
    });

    for (const record of records) {
      if (!(record.model in RATE_LIMITS)) merged.push(this.toDomain(record));
    }

    return merged.sort((a, b) => a.model.localeCompare(b.model));
  },

  async update(model: string, data: { rpm?: number; rpd?: number; tpm?: number }): Promise<ModelRateLimit> {
    const defaults = RATE_LIMITS[model] || FALLBACK_RATE_LIMIT;
    const record = await prisma.modelRateLimit.upsert({
      where: { model },
      create: {
        model,
        rpm: data.rpm ?? defaults.rpm,
        rpd: data.rpd ?? defaults.rpd,
        tpm: data.tpm ?? defaults.tpm,
      },
      update: data,
    });
    return this.toDomain(record);
  },

  async delete(model: string): Promise<boolean> {
    try {
      await prisma.modelRateLimit.delete({ where: { model } });
      return true;
    } catch {
      return false;
    }
  },

  getDefaults(): Record<string, RateLimit> {
    return { ...RATE_LIMITS };
  },

  toDomain(record: {
    id: string;
    model: string;
    rpm: number;
    rpd: number;
    tpm: number;
    createdAt: Date;
    updatedAt: Date;
  }): ModelRateLimit {
    return {
      id: record.id,
      model: record.model,
      rpm: record.rpm,
      rpd: record.rpd,
      tpm: record.tpm,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  },
};
