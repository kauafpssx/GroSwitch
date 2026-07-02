import { useState, useEffect } from 'react';
import { getApiKey } from '@/shared/lib/auth';
import { fetchModels } from '@/features/models/api';
import { ModelSelect } from '@/features/models/components/ModelSelect';
import { UnauthorizedError } from '@/shared/lib/http';
import { handleUnauthorized } from '@/shared/lib/auth';
import type { ModelRateLimitPublic } from '@groswitch/common';

interface GuardProps {
  onLogout: () => void;
}

export function Guard({ onLogout }: GuardProps) {
  const [models, setModels] = useState<ModelRateLimitPublic[]>([]);
  const [model, setModel] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchModels();
        setModels(data);
        const firstGuard = data.find((m) => m.type === 'guard');
        if (firstGuard) setModel(firstGuard.model);
      } catch (err) {
        if (err instanceof UnauthorizedError) handleUnauthorized(onLogout);
      }
    })();
  }, [onLogout]);

  const send = async () => {
    if (!input.trim() || !model || loading) return;
    const apiKey = getApiKey();
    if (!apiKey) return;

    setLoading(true);
    setError('');
    setResult('');

    try {
      const res = await fetch('/v1/chat/completions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: input }],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || res.statusText);
        return;
      }

      setResult(data?.choices?.[0]?.message?.content || '(empty response)');
    } catch {
      setError('Connection error. Is the proxy running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Guard</h1>
          <p className="text-sm text-muted-foreground">
            Test text against a moderation/classification model (Prompt Guard, Safeguard).
          </p>
        </div>

        <ModelSelect models={models} type="guard" value={model} onChange={setModel} placeholder="Guard model" />

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          placeholder="Text to classify..."
          className="w-full bg-card border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />

        <button
          onClick={send}
          disabled={loading || !input.trim() || !model}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Classifying...' : 'Classify'}
        </button>

        {error && <div className="text-sm text-destructive">{error}</div>}

        {result && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm whitespace-pre-wrap font-mono">{result}</div>
          </div>
        )}
      </div>
    </div>
  );
}
