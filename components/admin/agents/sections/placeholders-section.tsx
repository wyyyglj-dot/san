'use client';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import type { AgentPlaceholder } from '@/types';

interface PlaceholdersSectionProps {
  placeholders: AgentPlaceholder[];
  onChange: (placeholders: AgentPlaceholder[]) => void;
}

export function PlaceholdersSection({
  placeholders,
  onChange,
}: PlaceholdersSectionProps) {
  const addPlaceholder = () => {
    onChange([
      ...placeholders,
      { id: crypto.randomUUID(), key: '', description: '', required: false },
    ]);
  };

  const removePlaceholder = (index: number) => {
    onChange(placeholders.filter((_, i) => i !== index));
  };

  const updatePlaceholder = (
    index: number,
    field: keyof AgentPlaceholder,
    val: string | boolean
  ) => {
    const updated = placeholders.map((p, i) =>
      i === index ? { ...p, [field]: val } : p
    );
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {placeholders.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_60px_32px] gap-2 text-xs text-foreground/40 px-1">
          <span>键名</span>
          <span>描述</span>
          <span>必填</span>
          <span />
        </div>
      )}
      {placeholders.map((ph, index) => (
        <div
          key={ph.id}
          className="grid grid-cols-[1fr_1fr_60px_32px] gap-2 items-center"
        >
          <Input
            value={ph.key}
            onChange={(e) => {
              const sanitized = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
              updatePlaceholder(index, 'key', sanitized);
            }}
            placeholder="PLACEHOLDER_KEY"
            aria-label={`占位符 ${index + 1} 键名`}
          />
          <Input
            value={ph.description}
            onChange={(e) =>
              updatePlaceholder(index, 'description', e.target.value)
            }
            placeholder="占位符说明"
            aria-label={`占位符 ${index + 1} 描述`}
          />
          <div className="flex justify-center">
            <Switch
              checked={ph.required}
              onCheckedChange={(checked) =>
                updatePlaceholder(index, 'required', checked)
              }
              aria-label={`占位符 ${ph.key || index + 1} 必填`}
            />
          </div>
          <button
            onClick={() => removePlaceholder(index)}
            aria-label={`删除占位符 ${ph.key || index + 1}`}
            className="p-1.5 rounded-lg text-foreground/40 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addPlaceholder}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-colors"
      >
        <Plus className="w-4 h-4" />
        添加占位符
      </button>
    </div>
  );
}
