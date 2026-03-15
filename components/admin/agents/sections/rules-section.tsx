'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { AgentRule } from '@/types';

interface RulesSectionProps {
  rules: AgentRule[];
  onChange: (rules: AgentRule[]) => void;
}

export function RulesSection({ rules, onChange }: RulesSectionProps) {
  const addRule = () => {
    onChange([...rules, { id: Date.now().toString(), title: '', content: '' }]);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: keyof AgentRule, val: string) => {
    const updated = rules.map((r, i) => (i === index ? { ...r, [field]: val } : r));
    onChange(updated);
  };

  const moveRule = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rules.length) return;
    const updated = [...rules];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {rules.map((rule, index) => (
        <div
          key={rule.id}
          className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-xl p-4 space-y-2"
        >
          <div className="flex items-center gap-2">
            <Input
              value={rule.title}
              onChange={(e) => updateRule(index, 'title', e.target.value)}
              placeholder={`规则 ${index + 1} 标题`}
              className="flex-1"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveRule(index, -1)}
                disabled={index === 0}
                className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={`上移规则 ${rule.title || index + 1}`}
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => moveRule(index, 1)}
                disabled={index === rules.length - 1}
                className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={`下移规则 ${rule.title || index + 1}`}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => removeRule(index)}
                className="p-1.5 rounded-lg text-foreground/40 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
                aria-label={`删除规则 ${rule.title || index + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <Textarea
            value={rule.content}
            onChange={(e) => updateRule(index, 'content', e.target.value)}
            placeholder="规则内容..."
            rows={2}
          />
        </div>
      ))}
      <button
        onClick={addRule}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-colors"
      >
        <Plus className="w-4 h-4" />
        添加规则
      </button>
    </div>
  );
}
