import { useState } from 'react';
import { setApiKey, hasApiKey } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { KeyRound } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [apiKey, setApiKeyInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('Enter your Master API Key');
      return;
    }
    setApiKey(apiKey.trim());
    onLogin();
  };

  if (hasApiKey()) {
    onLogin();
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">GemRouter</h1>
          <p className="text-muted-foreground text-sm mt-1">Gemini API Key Router</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Authentication
            </CardTitle>
            <CardDescription>Enter your Master API Key</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKeyInput(e.target.value); setError(''); }}
                placeholder="MASTER_API_KEY"
                autoFocus
              />
              {error && <p className="text-destructive text-xs">{error}</p>}
              <Button type="submit" className="w-full">Connect</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
