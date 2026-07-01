import { useState, useRef, useEffect } from 'react';
import { getApiKey } from '@/shared/lib/auth';
import { ChatMessage, type MessageMetrics } from './components/ChatMessage';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  metrics?: MessageMetrics;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface GroqTiming {
  queueTimeMs: number;
  promptTimeMs: number;
  completionTimeMs: number;
  serverTotalTimeMs: number;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<TokenUsage>({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    const apiKey = getApiKey();
    if (!apiKey) return;

    const startTime = performance.now();
    let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let timing: GroqTiming | undefined;

    try {
      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({
          messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: userMessage }],
        }),
      });

      if (!res.ok || !res.body) {
        const error = await res.json().catch(() => ({}));
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error?.error?.message || res.statusText}` }]);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const json = JSON.parse(data);
            const text = json.choices?.[0]?.delta?.content;
            if (text) {
              fullText += text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: fullText };
                return updated;
              });
            }
            if (json.usage) {
              usage = {
                promptTokens: json.usage.prompt_tokens || 0,
                completionTokens: json.usage.completion_tokens || 0,
                totalTokens: json.usage.total_tokens || 0,
              };
              setTokens(usage);
            }
            const groqUsage = json.x_groq?.usage;
            if (groqUsage) {
              timing = {
                queueTimeMs: (groqUsage.queue_time || 0) * 1000,
                promptTimeMs: (groqUsage.prompt_time || 0) * 1000,
                completionTimeMs: (groqUsage.completion_time || 0) * 1000,
                serverTotalTimeMs: (groqUsage.total_time || 0) * 1000,
              };
            }
          } catch {}
        }
      }

      const elapsedMs = performance.now() - startTime;
      const tokensPerSecond =
        usage.completionTokens > 0 && timing?.completionTimeMs
          ? usage.completionTokens / (timing.completionTimeMs / 1000)
          : usage.completionTokens > 0
            ? usage.completionTokens / (elapsedMs / 1000)
            : 0;
      const metrics: MessageMetrics = {
        ...usage,
        elapsedMs,
        tokensPerSecond,
        queueTimeMs: timing?.queueTimeMs,
        promptTimeMs: timing?.promptTimeMs,
        completionTimeMs: timing?.completionTimeMs,
        serverTotalTimeMs: timing?.serverTotalTimeMs,
      };
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: fullText, metrics };
        return updated;
      });
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Is the proxy running?' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-20">
            <p className="text-lg">Groq Chat</p>
            <p className="text-sm">Context is preserved across messages</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} metrics={msg.metrics} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {messages.length > 0 && tokens.totalTokens > 0 && (
        <div className="px-4 py-1 text-xs text-muted-foreground border-t border-border">
          Context: {tokens.promptTokens.toLocaleString()} prompt / {tokens.completionTokens.toLocaleString()} completion / {tokens.totalTokens.toLocaleString()} total
        </div>
      )}

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send)"
            disabled={loading}
            className="flex-1 bg-card border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
