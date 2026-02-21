'use client';

import { useState, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { FeatureConfigPanel } from '@/components/admin/ui/feature-config-panel';
import { PromptEditorCard } from '@/components/admin/prompts/prompt-editor-card';
import type { SafeLlmPrompt } from '@/types';

const FEATURES = [
  {
    featureKey: 'storyboard',
    name: 'AI 分镜',
    description: '将剧本/小说内容拆分为分镜画面描述',
    placeholders: [{ key: 'CONTENT', description: '剧集内容（自动填充）' }],
  },
  {
    featureKey: 'asset_analyze',
    name: '资产分析',
    description: '从剧本内容中提取角色、场景和道具',
    placeholders: [{ key: 'CONTENT', description: '剧集内容（自动填充）' }],
  },
  {
    featureKey: 'prompt_enhance',
    name: '提示词增强',
    description: '优化和扩展用户输入的图像/视频生成提示词',
    placeholders: [
      { key: 'PROMPT', description: '用户输入的原始提示词' },
      { key: 'EXPANSION_GUIDE', description: '扩展级别说明（自动生成）' },
      { key: 'DURATION_GUIDE', description: '视频时长说明（自动生成）' },
    ],
  },
];

export default function LlmPromptsPage() {
  const [loading, setLoading] = useState(true);
  const [prompts, setPrompts] = useState<Record<string, SafeLlmPrompt>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchPrompts = async () => {
    try {
      const res = await fetch('/api/admin/llm-prompts');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const list: SafeLlmPrompt[] = data.data || [];
      const map: Record<string, SafeLlmPrompt> = {};
      for (const p of list) map[p.featureKey] = p;
      setPrompts(map);
    } catch (error) {
      console.error(error);
      toast({ title: '加载提示词失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleSave = async (
    featureKey: string,
    systemPrompt: string,
    userPromptTemplate: string
  ) => {
    setSavingKey(featureKey);
    try {
      const res = await fetch('/api/admin/llm-prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureKey, systemPrompt, userPromptTemplate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');

      setPrompts((prev) => ({ ...prev, [featureKey]: data.data }));
      toast({ title: '配置已保存' });
    } catch (error) {
      console.error(error);
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleReset = async (featureKey: string) => {
    setSavingKey(featureKey);
    try {
      const res = await fetch('/api/admin/llm-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', featureKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '重置失败');

      setPrompts((prev) => ({ ...prev, [featureKey]: data.data }));
      toast({ title: '已重置为默认值' });
    } catch (error) {
      console.error(error);
      toast({ title: '重置失败', variant: 'destructive' });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
      </div>
    );
  }

  return (
    <FeatureConfigPanel
      title="LLM 提示词"
      description="管理各个 AI 功能使用的底层提示词模板"
      icon={FileText}
    >
      <div className="grid gap-6">
        {FEATURES.map((feature) => {
          const promptData = prompts[feature.featureKey];
          return (
            <PromptEditorCard
              key={feature.featureKey}
              featureKey={feature.featureKey}
              name={feature.name}
              description={feature.description}
              systemPrompt={promptData?.systemPrompt ?? ''}
              userPromptTemplate={promptData?.userPromptTemplate ?? ''}
              placeholders={feature.placeholders}
              onSave={(sys, user) => handleSave(feature.featureKey, sys, user)}
              onReset={() => handleReset(feature.featureKey)}
              saving={savingKey === feature.featureKey}
            />
          );
        })}
      </div>
    </FeatureConfigPanel>
  );
}
