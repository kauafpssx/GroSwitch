import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import type { ModelRateLimitPublic, ModelType } from '@groswitch/common';

interface ModelSelectProps {
  models: ModelRateLimitPublic[];
  type: ModelType;
  value: string;
  onChange: (model: string) => void;
  placeholder?: string;
}

export function ModelSelect({ models, type, value, onChange, placeholder = 'Select model' }: ModelSelectProps) {
  const filtered = models.filter((m) => m.type === type);

  return (
    <Select value={value} onValueChange={onChange} disabled={filtered.length === 0}>
      <SelectTrigger className="h-9 w-[280px] text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {filtered.map((m) => (
          <SelectItem key={m.model} value={m.model} className="text-xs font-mono">
            {m.model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
