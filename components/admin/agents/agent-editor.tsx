'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { RoleSection } from './sections/role-section';
import { RulesSection } from './sections/rules-section';
import { WorkflowSection } from './sections/workflow-section';
import { ExamplesSection } from './sections/examples-section';
import { FormatSection } from './sections/format-section';
import { PlaceholdersSection } from './sections/placeholders-section';
import { SchemaDisplay } from './sections/schema-display';
import { PromptPreview } from './prompt-preview';
import type { SafeLlmAgent, AgentConfig } from '@/types';

interface AgentEditorProps {
  initialData?: SafeLlmAgent;
  onSave: (data: {
    featureKey: string;
    name: string;
    description: string;
    config: AgentConfig;
    enabled: boolean;
    changeSummary?: string;
  }) => Promise<void>;
  saving: boolean;
}

const emptyConfig: AgentConfig = {
  role: '',
  rules: [],
  workflow: [],
  examples: [],
  returnFormat: '',
  placeholders: [],
};

export function AgentEditor({
  initialData,
  onSave,
  saving,
}: AgentEditorProps) {
  const isEdit = !!initialData;

  const [featureKey, setFeatureKey] = useState(initialData?.featureKey ?? '');
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(
    initialData?.description ?? ''
  );
  const [config, setConfig] = useState<AgentConfig>(initialData?.config ?? emptyConfig);
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [changeSummary, setChangeSummary] = useState('');
  const [mobileTab, setMobileTab] = useState<'config' | 'preview'>('config');

  const isKeyValid = !featureKey || /^[a-z0-9_]+$/.test(featureKey);

  const updateConfig = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    await onSave({
      featureKey,
      name,
      description,
      config,
      enabled,
      ...(isEdit && changeSummary ? { changeSummary } : {}),
    });
    if (isEdit) setChangeSummary('');
  };

  // Mobile tab switcher with ARIA roles
  const tabBar = (
    <div role="tablist" aria-label="编辑器视图" className="flex lg:hidden mb-4 bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-xl p-1">
      <button
        role="tab"
        aria-selected={mobileTab === 'config'}
        aria-controls="panel-config"
        onClick={() => setMobileTab('config')}
        className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
          mobileTab === 'config'
            ? 'bg-white/[0.08] text-foreground'
            : 'text-foreground/50'
        }`}
      >
        配置
      </button>
      <button
        role="tab"
        aria-selected={mobileTab === 'preview'}
        aria-controls="panel-preview"
        onClick={() => setMobileTab('preview')}
        className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
          mobileTab === 'preview'
            ? 'bg-white/[0.08] text-foreground'
            : 'text-foreground/50'
        }`}
      >
        预览
      </button>
    </div>
  );

  const formContent = (
    <div className="space-y-6">
      {/* 基础信息 */}
      <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground/70">基础信息</h3>
        <div className="space-y-2">
          <Label htmlFor="agent-feature-key" className="text-sm text-foreground/70">功能标识</Label>
          <Input
            id="agent-feature-key"
            value={featureKey}
            onChange={(e) => setFeatureKey(e.target.value)}
            placeholder="小写字母、数字和下划线"
            disabled={isEdit}
            className={!isKeyValid ? 'border-red-500/50' : ''}
          />
          {!isKeyValid && (
            <p className="text-xs text-red-400">仅允许小写字母、数字和下划线</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-name" className="text-sm text-foreground/70">名称</Label>
          <Input
            id="agent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Agent 名称"
            className={!name && featureKey ? 'border-red-500/50' : ''}
          />
          {!name && featureKey && (
            <p className="text-xs text-red-400">名称为必填项</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-description" className="text-sm text-foreground/70">描述</Label>
          <Textarea
            id="agent-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Agent 功能描述..."
            rows={2}
          />
        </div>
      </div>

      {/* Role */}
      <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-sm font-medium text-foreground/70 mb-3">角色定义</h3>
        <RoleSection value={config.role} onChange={(v) => updateConfig('role', v)} />
      </div>

      {/* Rules */}
      <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-sm font-medium text-foreground/70 mb-3">规则</h3>
        <RulesSection rules={config.rules} onChange={(v) => updateConfig('rules', v)} />
      </div>

      {/* Workflow */}
      <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-sm font-medium text-foreground/70 mb-3">工作流</h3>
        <WorkflowSection steps={config.workflow} onChange={(v) => updateConfig('workflow', v)} />
      </div>

      {/* Examples */}
      <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-sm font-medium text-foreground/70 mb-3">示例</h3>
        <ExamplesSection examples={config.examples} onChange={(v) => updateConfig('examples', v)} />
      </div>

      {/* Output Format */}
      <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-sm font-medium text-foreground/70 mb-3">输出格式</h3>
        <FormatSection value={config.returnFormat} onChange={(v) => updateConfig('returnFormat', v)} />
        <SchemaDisplay schema={initialData?.jsonSchema} />
      </div>

      {/* Placeholders */}
      <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-sm font-medium text-foreground/70 mb-3">占位符</h3>
        <PlaceholdersSection placeholders={config.placeholders} onChange={(v) => updateConfig('placeholders', v)} />
      </div>

      {/* Enabled + Change Summary + Save */}
      <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="agent-enabled" className="text-sm text-foreground/70">启用</Label>
          <Switch id="agent-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
        {isEdit && (
          <div className="space-y-2">
            <Label htmlFor="agent-change-summary" className="text-sm text-foreground/70">变更说明</Label>
            <Input
              id="agent-change-summary"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="本次修改的简要说明..."
            />
          </div>
        )}
        <Button
          onClick={handleSubmit}
          disabled={saving || !featureKey || !name || !isKeyValid}
          className="w-full"
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEdit ? '保存修改' : '创建 Agent'}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {tabBar}
      <div className="flex flex-col lg:flex-row gap-6">
        <div id="panel-config" role="tabpanel" className={`flex-1 lg:w-[60%] ${mobileTab === 'preview' ? 'hidden lg:block' : ''}`}>
          {formContent}
        </div>
        <div id="panel-preview" role="tabpanel" className={`lg:w-[40%] ${mobileTab === 'config' ? 'hidden lg:block' : ''}`}>
          <PromptPreview config={config} />
        </div>
      </div>
    </>
  );
}
