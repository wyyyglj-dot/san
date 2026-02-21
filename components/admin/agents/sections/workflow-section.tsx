'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { AgentWorkflowStep } from '@/types';

interface WorkflowSectionProps {
  steps: AgentWorkflowStep[];
  onChange: (steps: AgentWorkflowStep[]) => void;
}

export function WorkflowSection({ steps, onChange }: WorkflowSectionProps) {
  const addStep = () => {
    onChange([...steps, { id: Date.now().toString(), title: '', content: '' }]);
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof AgentWorkflowStep, val: string) => {
    const updated = steps.map((s, i) => (i === index ? { ...s, [field]: val } : s));
    onChange(updated);
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const updated = [...steps];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-xl p-4 space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/[0.06] text-xs text-foreground/50 shrink-0">
              {index + 1}
            </span>
            <Input
              value={step.title}
              onChange={(e) => updateStep(index, 'title', e.target.value)}
              placeholder={`步骤 ${index + 1} 标题`}
              className="flex-1"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveStep(index, -1)}
                disabled={index === 0}
                className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => moveStep(index, 1)}
                disabled={index === steps.length - 1}
                className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => removeStep(index)}
                className="p-1.5 rounded-lg text-foreground/40 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <Textarea
            value={step.content}
            onChange={(e) => updateStep(index, 'content', e.target.value)}
            placeholder="步骤内容..."
            rows={2}
          />
        </div>
      ))}
      <button
        onClick={addStep}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-colors"
      >
        <Plus className="w-4 h-4" />
        添加步骤
      </button>
    </div>
  );
}
