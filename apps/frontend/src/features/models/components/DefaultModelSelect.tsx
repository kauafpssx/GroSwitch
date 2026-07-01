import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import type { ModelRateLimitPublic } from '@groswitch/common';

interface DefaultModelSelectProps {
  models: ModelRateLimitPublic[];
  value: string;
  onChange: (model: string) => Promise<void>;
}

export function DefaultModelSelect({ models, value, onChange }: DefaultModelSelectProps) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (model: string) => {
    setSaving(true);
    try {
      await onChange(model);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select value={value} onValueChange={handleChange} disabled={saving || models.length === 0}>
      <SelectTrigger className="h-9 w-[280px] text-xs">
        <SelectValue placeholder="Default model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m.model} value={m.model} className="text-xs font-mono">
            {m.model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
