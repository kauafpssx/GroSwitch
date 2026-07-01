import { useState, useEffect } from 'react';
import type { ApiKeyPublic } from '@groswitch/common';
import { Badge } from '@/shared/ui/badge';
import { Trash2, Copy, Check } from 'lucide-react';
import { revealKey } from '../api';
import { EditKeyForm } from './EditKeyForm';

interface KeyCardProps {
  apiKey: ApiKeyPublic;
  dailyLimit: number;
  minuteLimit: number;
  showCooldown: boolean;
  onUpdate: (id: string, changes: { name: string; key: string }) => Promise<void>;
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
    case 'rate_limit': return 'Limit';
    case 'invalid_key': return 'Invalid key';
    default: return '';
  }
}

function UsageBar({ count, limit }: { count: number; limit: number }) {
  const percent = Math.round((count / limit) * 100);
  return (
    <div className="flex-1 max-w-[140px]">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{count}/{limit}</span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            percent > 90 ? 'bg-red-500' :
            percent > 70 ? 'bg-yellow-500' :
            'bg-green-500'
          }`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function CopyKeyButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const key = await revealKey(id);
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="Copy API key"
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
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

export function KeyCard({ apiKey, dailyLimit, minuteLimit, showCooldown, onUpdate, onDelete }: KeyCardProps) {
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
          <UsageBar count={apiKey.dailyCount} limit={dailyLimit} />
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <UsageBar count={apiKey.minuteCount} limit={minuteLimit} />
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-muted-foreground">
          {formatTokens(apiKey.totalTokens)} tokens
        </span>
      </td>
      {showCooldown && (
        <td className="py-3 px-4">
          {isCoolingDown && apiKey.limitedUntil && (
            <CooldownTimer expiresAt={apiKey.limitedUntil} />
          )}
        </td>
      )}
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-3">
          <CopyKeyButton id={apiKey.id} />
          <EditKeyForm apiKey={apiKey} onSave={onUpdate} />
          <button
            onClick={() => onDelete(apiKey.id)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
