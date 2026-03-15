'use client';

import { useState, useEffect } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { FeatureConfigPanel } from '@/components/admin/ui/feature-config-panel';
import { ConfigSection } from '@/components/admin/ui/config-section';
import { ModelSelector } from '@/components/admin/ui/model-selector';
import type { FeatureBinding } from '@/types';

export default function PromptEnhancementPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promptLlm, setPromptLlm] = useState('');

  useEffect(() => {
    fetchBindings();
  }, []);

  const fetchBindings = async () => {
    try {
      const res = await fetch('/api/admin/feature-bindings');
      if (res.ok) {
        const data = await res.json();
        const list = data.data || [];
        const llm = list.find((b: FeatureBinding) => b.featureKey === 'prompt_enhance.llm');
        if (llm) setPromptLlm(llm.modelId);
      }
    } catch (error) {
      console.error('Failed to fetch bindings:', error);
      toast({ title: '加载失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (promptLlm) {
        await fetch('/api/admin/feature-bindings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            featureKey: 'prompt_enhance.llm',
            modelType: 'llm',
            modelId: promptLlm,
            enabled: true,
          }),
        });
      }

      toast({ title: '配置已保存' });
      fetchBindings();
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
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
      title="提示词增强"
      description="配置提示词增强功能使用的 LLM 模型"
      icon={Wand2}
      onSave={handleSave}
      saving={saving}
      status={promptLlm ? 'healthy' : 'warning'}
    >
      <ConfigSection title="LLM 模型" description="用于优化和扩展用户输入的提示词">
        <div className="space-y-2">
          <label className="text-sm text-foreground/50">选择 LLM 模型</label>
          <ModelSelector
            modelType="llm"
            value={promptLlm}
            onChange={setPromptLlm}
            placeholder="选择用于提示词增强的 LLM 模型..."
          />
          <p className="text-xs text-foreground/30">
            如未配置，将使用 Sora API 的默认配置
          </p>
        </div>
      </ConfigSection>
    </FeatureConfigPanel>
  );
}
