export type ApiKeyStatus = 'live' | 'dead' | 'invalid';
export type DeadReason = '' | 'minute_limit' | 'daily_limit' | 'rate_limit' | 'invalid_key';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  status: ApiKeyStatus;
  lastUsedAt: Date | null;
  limitedUntil: Date | null;
  deadReason: DeadReason;
  dailyCount: number;
  dailyCountDate: string;
  minuteCount: number;
  minuteWindowStart: number;
  totalTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyPublic {
  id: string;
  name: string;
  status: ApiKeyStatus;
  lastUsedAt: string | null;
  limitedUntil: string | null;
  cooldownRemainingMs: number | null;
  deadReason: DeadReason;
  dailyCount: number;
  minuteCount: number;
  totalTokens: number;
  createdAt: string;
}

export interface ModelRateLimit {
  id: string;
  model: string;
  rpm: number;
  rpd: number;
  tpm: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelRateLimitPublic {
  id: string;
  model: string;
  rpm: number;
  rpd: number;
  tpm: number;
}

export interface KeyStats {
  total: number;
  live: number;
  dead: number;
  invalid: number;
  deadByReason: {
    minute_limit: number;
    daily_limit: number;
    rate_limit: number;
  };
  dailyLimit: number;
  minuteLimit: number;
  defaultModel: string;
}

export interface ManagementResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
