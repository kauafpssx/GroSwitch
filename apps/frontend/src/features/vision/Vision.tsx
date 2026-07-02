import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiKey } from '@/shared/lib/auth';
import { fetchModels } from '@/features/models/api';
import { ModelSelect } from '@/features/models/components/ModelSelect';
import { UnauthorizedError } from '@/shared/lib/http';
import { handleUnauthorized } from '@/shared/lib/auth';
import { ImagePlus, X } from 'lucide-react';
import type { ModelRateLimitPublic } from '@groswitch/common';

interface VisionProps {
  onLogout: () => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Vision({ onLogout }: VisionProps) {
  const [models, setModels] = useState<ModelRateLimitPublic[]>([]);
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('What is in this image? If there is text, transcribe it (OCR).');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchModels();
        setModels(data);
        const firstVision = data.find((m) => m.type === 'vision');
        if (firstVision) setModel(firstVision.model);
      } catch (err) {
        if (err instanceof UnauthorizedError) handleUnauthorized(onLogout);
      }
    })();
  }, [onLogout]);

  const handleFile = useCallback(async (file: File) => {
    setImageName(file.name);
    setImageDataUrl(await readAsDataUrl(file));
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clearImage = () => {
    setImageDataUrl(null);
    setImageName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const send = async () => {
    if (!imageDataUrl || !model || loading) return;
    const apiKey = getApiKey();
    if (!apiKey) return;

    setLoading(true);
    setError('');
    setResult('');
    const start = performance.now();

    try {
      const res = await fetch('/v1/chat/completions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageDataUrl } },
              ],
            },
          ],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || res.statusText);
        return;
      }

      setResult(data?.choices?.[0]?.message?.content || '(empty response)');
      setElapsedMs(performance.now() - start);
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
          <h1 className="text-lg font-semibold">Vision / OCR</h1>
          <p className="text-sm text-muted-foreground">Upload an image and ask a vision model to describe or read it.</p>
        </div>

        <div className="flex items-center gap-3">
          <ModelSelect models={models} type="vision" value={model} onChange={setModel} placeholder="Vision model" />
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border border-dashed border-border rounded-lg p-6 text-center bg-card/50"
        >
          {imageDataUrl ? (
            <div className="relative inline-block">
              <img src={imageDataUrl} alt={imageName} className="max-h-64 rounded-lg mx-auto" />
              <button
                onClick={clearImage}
                className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground"
                title="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground mx-auto"
            >
              <ImagePlus className="w-8 h-8" />
              <span className="text-sm">Click or drag an image here</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="Prompt for the image..."
          className="w-full bg-card border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />

        <button
          onClick={send}
          disabled={loading || !imageDataUrl || !model}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>

        {error && <div className="text-sm text-destructive">{error}</div>}

        {result && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="text-sm whitespace-pre-wrap">{result}</div>
            {elapsedMs !== null && (
              <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/60">
                {(elapsedMs / 1000).toFixed(1)}s
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
