'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import type { AgentExample } from '@/types';

interface ExamplesSectionProps {
  examples: AgentExample[];
  onChange: (examples: AgentExample[]) => void;
}

export function ExamplesSection({ examples, onChange }: ExamplesSectionProps) {
  const addExample = () => {
    onChange([
      ...examples,
      { id: Date.now().toString(), title: '', input: '', output: '' },
    ]);
  };

  const removeExample = (index: number) => {
    onChange(examples.filter((_, i) => i !== index));
  };

  const updateExample = (
    index: number,
    field: keyof AgentExample,
    val: string
  ) => {
    const updated = examples.map((e, i) =>
      i === index ? { ...e, [field]: val } : e
    );
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {examples.map((example, index) => (
        <div
          key={example.id}
          className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Input
              value={example.title}
              onChange={(e) =>
                updateExample(index, 'title', e.target.value)
              }
              placeholder={`示例 ${index + 1} 标题`}
              className="flex-1"
            />
            <button
              onClick={() => removeExample(index)}
              className="p-1.5 rounded-lg text-foreground/40 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <Textarea
            value={example.input}
            onChange={(e) =>
              updateExample(index, 'input', e.target.value)
            }
            placeholder="输入示例..."
            rows={2}
          />
          <Textarea
            value={example.output}
            onChange={(e) =>
              updateExample(index, 'output', e.target.value)
            }
            placeholder="输出示例..."
            rows={2}
          />
        </div>
      ))}
      <button
        onClick={addExample}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-colors"
      >
        <Plus className="w-4 h-4" />
        添加示例
      </button>
    </div>
  );
}
