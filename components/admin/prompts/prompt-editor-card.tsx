'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { ConfigSection } from '@/components/admin/ui/config-section';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface PromptEditorCardProps {
  featureKey: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  placeholders: { key: string; description: string }[];
  onSave: (systemPrompt: string, userPromptTemplate: string) => Promise<void>;
  onReset: () => Promise<void>;
  saving?: boolean;
}

export function PromptEditorCard({
  featureKey,
  name,
  description,
  systemPrompt: initialSystemPrompt,
  userPromptTemplate: initialUserPrompt,
  placeholders,
  onSave,
  onReset,
  saving = false,
}: PromptEditorCardProps) {
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [userPrompt, setUserPrompt] = useState(initialUserPrompt);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setSystemPrompt(initialSystemPrompt);
    setUserPrompt(initialUserPrompt);
    setIsDirty(false);
  }, [initialSystemPrompt, initialUserPrompt]);

  const handleChange = (type: 'system' | 'user', value: string) => {
    if (type === 'system') setSystemPrompt(value);
    else setUserPrompt(value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    await onSave(systemPrompt, userPrompt);
    setIsDirty(false);
  };

  return (
    <ConfigSection title={name} description={description}>
      <div className="space-y-5">
        {/* System Prompt */}
        <div className="space-y-2">
          <label htmlFor={`sys-${featureKey}`} className="text-xs font-mono text-primary/80 tracking-wider">
            系统提示词
          </label>
          <textarea
            id={`sys-${featureKey}`}
            value={systemPrompt}
            onChange={(e) => handleChange('system', e.target.value)}
            className="w-full min-h-[120px] p-3 font-mono text-sm bg-black/20 border border-white/10 rounded-lg focus:border-primary/30 focus:outline-none resize-y text-foreground placeholder:text-foreground/30"
            placeholder="输入系统提示词..."
          />
        </div>

        {/* User Prompt Template */}
        <div className="space-y-2">
          <label htmlFor={`usr-${featureKey}`} className="text-xs font-mono text-primary/80 tracking-wider">
            用户提示词模板
          </label>
          <textarea
            id={`usr-${featureKey}`}
            value={userPrompt}
            onChange={(e) => handleChange('user', e.target.value)}
            className="w-full min-h-[120px] p-3 font-mono text-sm bg-black/20 border border-white/10 rounded-lg focus:border-primary/30 focus:outline-none resize-y text-foreground placeholder:text-foreground/30"
            placeholder="输入用户提示词模板..."
          />
          {placeholders.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {placeholders.map((p) => (
                <div
                  key={p.key}
                  className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded border border-white/5"
                >
                  <span className="text-primary font-mono">{`{{${p.key}}}`}</span>{' '}
                  : {p.description}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground/50 hover:text-foreground bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors border border-white/[0.06]">
                <RotateCcw className="w-3.5 h-3.5" />
                重置为默认
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>重置为默认值？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将丢弃当前的所有修改，恢复该功能的系统提示词和用户模板为初始默认状态。此操作无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onReset}>确认重置</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex items-center gap-3">
            {isDirty && (
              <span className="text-xs text-amber-400/70">未保存</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="flex items-center gap-2 px-4 py-1.5 text-sm bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </ConfigSection>
  );
}
