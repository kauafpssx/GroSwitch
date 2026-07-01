import { useState } from 'react';
import { Copy, Check, Clock, Zap, Hash } from 'lucide-react';

export interface MessageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  elapsedMs: number;
  tokensPerSecond: number;
  // From Groq's x_groq.usage (actual server-side compute time, in ms) — more
  // accurate than elapsedMs, which also includes network + queue jitter.
  queueTimeMs?: number;
  promptTimeMs?: number;
  completionTimeMs?: number;
  serverTotalTimeMs?: number;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  metrics?: MessageMetrics;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ChatMessage({ role, content, metrics }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap">{content}</div>

        {role === 'assistant' && content && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
            {metrics && (
              <>
                <span className="flex items-center gap-1" title="Tokens per second (Groq completion time)">
                  <Zap className="w-3 h-3" />
                  {metrics.tokensPerSecond.toFixed(1)} tok/s
                </span>
                <span
                  className="flex items-center gap-1"
                  title={
                    metrics.queueTimeMs !== undefined
                      ? `Queue: ${formatDuration(metrics.queueTimeMs)} · Prompt: ${formatDuration(metrics.promptTimeMs ?? 0)} · Completion: ${formatDuration(metrics.completionTimeMs ?? 0)}`
                      : 'Round-trip time'
                  }
                >
                  <Clock className="w-3 h-3" />
                  {formatDuration(metrics.serverTotalTimeMs ?? metrics.elapsedMs)}
                </span>
                <span className="flex items-center gap-1" title="Total tokens">
                  <Hash className="w-3 h-3" />
                  {metrics.totalTokens}
                </span>
              </>
            )}
            <button
              onClick={handleCopy}
              className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors"
              title="Copy message"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
