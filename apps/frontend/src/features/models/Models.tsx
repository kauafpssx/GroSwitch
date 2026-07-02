import { useState, useEffect, useCallback } from 'react';
import { fetchModels, updateModel } from './api';
import { ModelRow } from './components/ModelRow';
import { UnauthorizedError } from '@/shared/lib/http';
import { handleUnauthorized } from '@/shared/lib/auth';
import type { ModelRateLimitPublic } from '@groswitch/common';

interface ModelsProps {
  onLogout: () => void;
}

export function Models({ onLogout }: ModelsProps) {
  const [models, setModels] = useState<ModelRateLimitPublic[]>([]);
  const [loading, setLoading] = useState(true);

  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchModels();
      setModels(data);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        handleUnauthorized(onLogout);
      }
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleSave = async (model: string, changes: { rpm: number; rpd: number; tpm: number }) => {
    const updated = await updateModel(model, changes);
    setModels((prev) => prev.map((m) => (m.model === model ? updated : m)));
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Models</h1>
          <p className="text-sm text-muted-foreground">
            Rate limits per model, loaded from <code className="font-mono">model-rate-limits.csv</code>. Edits are
            saved per model and override the CSV default.
          </p>
        </div>

        {loading && models.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-card border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground py-2 px-4">Model</th>
                  <th className="text-left text-xs font-medium text-muted-foreground py-2 px-4">Type</th>
                  <th className="text-left text-xs font-medium text-muted-foreground py-2 px-4">RPM</th>
                  <th className="text-left text-xs font-medium text-muted-foreground py-2 px-4">RPD</th>
                  <th className="text-left text-xs font-medium text-muted-foreground py-2 px-4">TPM</th>
                  <th className="text-right text-xs font-medium text-muted-foreground py-2 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <ModelRow key={model.model} model={model} onSave={handleSave} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
