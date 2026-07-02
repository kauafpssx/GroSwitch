import { useState, useEffect, useRef } from 'react';
import { getApiKey } from '@/shared/lib/auth';
import { fetchModels } from '@/features/models/api';
import { ModelSelect } from '@/features/models/components/ModelSelect';
import { UnauthorizedError } from '@/shared/lib/http';
import { handleUnauthorized } from '@/shared/lib/auth';
import { Mic, Square, Upload } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import type { ModelRateLimitPublic } from '@groswitch/common';

const VOICES_BY_MODEL: Record<string, string[]> = {
  'canopylabs/orpheus-arabic-saudi': ['abdullah', 'aisha', 'fahad', 'sultan', 'lulwa', 'noura'],
  'canopylabs/orpheus-v1-english': ['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy'],
};

interface AudioProps {
  onLogout: () => void;
}

function Transcribe({ models }: { models: ModelRateLimitPublic[] }) {
  const [model, setModel] = useState('');
  const [file, setFile] = useState<File | Blob | null>(null);
  const [fileName, setFileName] = useState('');
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const firstStt = models.find((m) => m.type === 'stt');
    if (firstStt && !model) setModel(firstStt.model);
  }, [models, model]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setFile(blob);
      setFileName('recording.webm');
      stream.getTracks().forEach((t) => t.stop());
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const send = async () => {
    if (!file || !model || loading) return;
    const apiKey = getApiKey();
    if (!apiKey) return;

    setLoading(true);
    setError('');
    setTranscript('');

    try {
      const formData = new FormData();
      formData.append('file', file, fileName || 'audio');
      formData.append('model', model);

      const res = await fetch('/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || res.statusText);
        return;
      }

      setTranscript(data?.text || '(empty transcript)');
    } catch {
      setError('Connection error. Is the proxy running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <ModelSelect models={models} type="stt" value={model} onChange={setModel} placeholder="Transcription model" />

      <div className="flex items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2 text-sm hover:bg-card/70"
        >
          <Upload className="w-4 h-4" /> Upload audio
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setFileName(f.name);
            }
          }}
        />

        {!recording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2 text-sm hover:bg-card/70"
          >
            <Mic className="w-4 h-4" /> Record
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 bg-destructive text-destructive-foreground rounded-lg px-4 py-2 text-sm"
          >
            <Square className="w-4 h-4" /> Stop
          </button>
        )}

        {fileName && <span className="text-xs text-muted-foreground font-mono">{fileName}</span>}
      </div>

      <button
        onClick={send}
        disabled={loading || !file || !model}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Transcribing...' : 'Transcribe'}
      </button>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {transcript && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm whitespace-pre-wrap">{transcript}</div>
        </div>
      )}
    </div>
  );
}

function Speech({ models }: { models: ModelRateLimitPublic[] }) {
  const [model, setModel] = useState('');
  const [input, setInput] = useState('Hello! This is a test of text to speech.');
  const [voice, setVoice] = useState('');
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const firstTts = models.find((m) => m.type === 'tts');
    if (firstTts && !model) setModel(firstTts.model);
  }, [models, model]);

  useEffect(() => {
    const voices = VOICES_BY_MODEL[model] ?? [];
    if (!voices.includes(voice)) setVoice(voices[0] ?? '');
  }, [model]);

  const send = async () => {
    if (!input.trim() || !model || !voice.trim() || loading) return;
    const apiKey = getApiKey();
    if (!apiKey) return;

    setLoading(true);
    setError('');
    setAudioUrl('');

    try {
      const res = await fetch('/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
        body: JSON.stringify({ model, input, voice }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message || res.statusText);
        return;
      }

      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch {
      setError('Connection error. Is the proxy running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ModelSelect models={models} type="tts" value={model} onChange={setModel} placeholder="Speech model" />
        <Select value={voice} onValueChange={setVoice} disabled={!(VOICES_BY_MODEL[model] ?? []).length}>
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue placeholder="Voice" />
          </SelectTrigger>
          <SelectContent>
            {(VOICES_BY_MODEL[model] ?? []).map((v) => (
              <SelectItem key={v} value={v} className="text-xs capitalize">
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={3}
        placeholder="Text to speak..."
        className="w-full bg-card border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
      />

      <button
        onClick={send}
        disabled={loading || !input.trim() || !model || !voice.trim()}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate speech'}
      </button>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {audioUrl && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <audio controls src={audioUrl} className="w-full" />
          <a href={audioUrl} download="speech.wav" className="text-xs text-muted-foreground hover:text-foreground underline">
            Download
          </a>
        </div>
      )}
    </div>
  );
}

export function Audio({ onLogout }: AudioProps) {
  const [models, setModels] = useState<ModelRateLimitPublic[]>([]);
  const [tab, setTab] = useState<'transcribe' | 'speech'>('transcribe');

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchModels();
        setModels(data);
      } catch (err) {
        if (err instanceof UnauthorizedError) handleUnauthorized(onLogout);
      }
    })();
  }, [onLogout]);

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Audio</h1>
          <p className="text-sm text-muted-foreground">Transcribe audio to text, or generate speech from text.</p>
        </div>

        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setTab('transcribe')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'transcribe' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Transcribe
          </button>
          <button
            onClick={() => setTab('speech')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'speech' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Speech
          </button>
        </div>

        {tab === 'transcribe' ? <Transcribe models={models} /> : <Speech models={models} />}
      </div>
    </div>
  );
}
