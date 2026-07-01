import { useState } from 'react';
import { setApiKey, clearApiKey } from '@/shared/lib/auth';
import { verifyApiKey } from '@/shared/lib/http';
import { toast } from '@/shared/lib/use-toast';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { KeyRound, Eclipse } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [apiKey, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!apiKey.trim()) {
      toast({ variant: 'destructive', title: 'Enter your Master API Key' });
      return;
    }

    setLoading(true);
    setApiKey(apiKey.trim());

    try {
      const valid = await verifyApiKey();
      if (!valid) {
        clearApiKey();
        toast({
          variant: 'destructive',
          title: 'Invalid API key',
          description: 'Check your Master API Key and try again.',
        });
        return;
      }
      onLogin();
    } catch {
      clearApiKey();
      toast({
        variant: 'destructive',
        title: 'Connection error',
        description: 'Could not reach the backend. Is it running?',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
            <Eclipse className="w-6 h-6" />
            GroSwitch
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Groq API Key Router</p>
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
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="MASTER_API_KEY"
                autoFocus
                disabled={loading}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Connect'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
