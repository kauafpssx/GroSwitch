import { useState, useEffect } from 'react';
import type { ApiKeyPublic } from '@gemrouter/common';
import { Badge } from '@/components/ui/badge';

interface KeyCardProps {
  apiKey: ApiKeyPublic;
  dailyLimit: number;
  minuteLimit: number;
  onDelete: (id: string) => void;
}

function formatTokens(n: number | undefined | null): string {
  const val = n ?? 0;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return String(val);
}

function formatCooldown(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function deadReasonLabel(reason: string): string {
  switch (reason) {
    case 'minute_limit': return 'RPM limit';
    case 'daily_limit': return 'RPD limit';
    case 'rate_limit': return 'Google 429';
    case 'invalid_key': return 'Invalid key';
    default: return '';
  }
}

function CooldownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(ms);
      if (ms <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remaining <= 0) return <span className="text-xs text-green-500">Ready</span>;
  return <span className="text-xs text-destructive font-mono">{formatCooldown(remaining)}</span>;
}

export function KeyCard({ apiKey, dailyLimit, minuteLimit, onDelete }: KeyCardProps) {
  const dailyPercent = Math.round((apiKey.dailyCount / dailyLimit) * 100);
  const isCoolingDown = apiKey.cooldownRemainingMs !== null && apiKey.cooldownRemainingMs > 0 && apiKey.limitedUntil;

  return (
    <tr className="border-b border-border hover:bg-card/50 transition-colors">
      <td className="py-3 px-4">
        <span className="font-medium text-sm">{apiKey.name}</span>
      </td>
      <td className="py-3 px-4">
        <Badge variant={apiKey.status === 'live' ? 'default' : apiKey.status === 'dead' ? 'destructive' : 'secondary'}>
          {apiKey.status === 'live' ? 'Active' : apiKey.status === 'dead' ? (deadReasonLabel(apiKey.deadReason) || 'Limited') : 'Invalid'}
        </Badge>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-[140px]">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{apiKey.dailyCount}/{dailyLimit}</span>
              <span className="text-muted-foreground">{dailyPercent}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  dailyPercent > 90 ? 'bg-red-500' :
                  dailyPercent > 70 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(dailyPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-muted-foreground">
          {apiKey.minuteCount}/{minuteLimit} rpm
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-muted-foreground">
          {formatTokens(apiKey.totalTokens)} tokens
        </span>
      </td>
      <td className="py-3 px-4">
        {isCoolingDown && apiKey.limitedUntil && (
          <CooldownTimer expiresAt={apiKey.limitedUntil} />
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <button
          onClick={() => onDelete(apiKey.id)}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
