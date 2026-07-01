import { useState } from 'react';
import type { ApiKeyPublic } from '@groswitch/common';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Pencil, Eye, EyeOff } from 'lucide-react';
import { revealKey } from '../api';

interface EditKeyFormProps {
  apiKey: ApiKeyPublic;
  onSave: (id: string, changes: { name: string; key: string }) => Promise<void>;
}

export function EditKeyForm({ apiKey, onSave }: EditKeyFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(apiKey.name);
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loadingKey, setLoadingKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;

    setError('');
    setName(apiKey.name);
    setLoadingKey(true);
    try {
      setKey(await revealKey(apiKey.id));
    } catch {
      setError('Failed to load current key');
    } finally {
      setLoadingKey(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) {
      setError('Both fields required');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await onSave(apiKey.id, { name: name.trim(), key: key.trim() });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Edit"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Key name"
              disabled={saving}
            />
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={loadingKey ? 'Loading...' : 'Groq API Key'}
                disabled={loadingKey || saving}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || loadingKey}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
