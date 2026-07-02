import { useState } from 'react';
import type { ModelRateLimitPublic } from '@groswitch/common';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Pencil } from 'lucide-react';

interface ModelRowProps {
  model: ModelRateLimitPublic;
  onSave: (model: string, changes: { rpm: number; rpd: number; tpm: number }) => Promise<void>;
}

export function ModelRow({ model, onSave }: ModelRowProps) {
  const [editing, setEditing] = useState(false);
  const [rpm, setRpm] = useState(String(model.rpm));
  const [rpd, setRpd] = useState(String(model.rpd));
  const [tpm, setTpm] = useState(String(model.tpm));
  const [saving, setSaving] = useState(false);

  const dirty = editing && (Number(rpm) !== model.rpm || Number(rpd) !== model.rpd || Number(tpm) !== model.tpm);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(model.model, { rpm: Number(rpm), rpd: Number(rpd), tpm: Number(tpm) });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setRpm(String(model.rpm));
    setRpd(String(model.rpd));
    setTpm(String(model.tpm));
    setEditing(false);
  };

  return (
    <tr className="border-b border-border hover:bg-card/50 transition-colors">
      <td className="py-2 px-4">
        <span className="font-mono text-xs">{model.model}</span>
      </td>
      <td className="py-2 px-4">
        <Badge variant="secondary" className="text-[10px] font-normal">
          {model.type}
        </Badge>
      </td>
      <td className="py-2 px-4">
        {editing ? (
          <Input className="h-7 w-24 text-xs" type="number" value={rpm} onChange={(e) => setRpm(e.target.value)} />
        ) : (
          <span className="text-xs text-muted-foreground">{model.rpm}</span>
        )}
      </td>
      <td className="py-2 px-4">
        {editing ? (
          <Input className="h-7 w-24 text-xs" type="number" value={rpd} onChange={(e) => setRpd(e.target.value)} />
        ) : (
          <span className="text-xs text-muted-foreground">{model.rpd}</span>
        )}
      </td>
      <td className="py-2 px-4">
        {editing ? (
          <Input className="h-7 w-24 text-xs" type="number" value={tpm} onChange={(e) => setTpm(e.target.value)} />
        ) : (
          <span className="text-xs text-muted-foreground">{model.tpm}</span>
        )}
      </td>
      <td className="py-2 px-4 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
}
