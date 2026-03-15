'use client';

import { useState, useEffect } from 'react';
import { Bot, Plus, Pencil, Trash2, X, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { FeatureConfigPanel } from '@/components/admin/ui/feature-config-panel';
import { ConfigSection } from '@/components/admin/ui/config-section';
import { ConfigStatusBadge } from '@/components/admin/ui/config-status-badge';
import type { SafeLlmModel, LlmProvider } from '@/types';

interface EditingModel {
  id?: string;
  name: string;
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
}

const DEFAULT_MODEL: EditingModel = {
  name: '',
  provider: 'openai-compatible',
  baseUrl: '',
  apiKey: '',
  modelName: '',
  temperature: 0.7,
  maxTokens: 4096,
  enabled: true,
};

export default function LlmModelsPage() {
  const [models, setModels] = useState<SafeLlmModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<EditingModel>(DEFAULT_MODEL);
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/admin/llm-models');
      if (res.ok) {
        const data = await res.json();
        setModels(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      toast({ title: '加载失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (model?: SafeLlmModel) => {
    setEditingModel(model ? { ...model, apiKey: '' } : { ...DEFAULT_MODEL });
    setShowKey(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingModel(DEFAULT_MODEL);
  };

  const handleSave = async () => {
    if (!editingModel.name || !editingModel.baseUrl || !editingModel.modelName) {
      toast({ title: '请填写所有必填字段', variant: 'destructive' });
      return;
    }
    if (!editingModel.id && !editingModel.apiKey) {
      toast({ title: '请填写 API Key', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const isEdit = !!editingModel.id;
      const url = isEdit ? `/api/admin/llm-models/${editingModel.id}` : '/api/admin/llm-models';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = { ...editingModel };
      if (isEdit && !payload.apiKey) {
        delete (payload as Partial<EditingModel>).apiKey;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '保存失败');
      }

      toast({ title: isEdit ? '模型已更新' : '模型已创建' });
      fetchModels();
      handleCloseModal();
    } catch (error) {
      toast({
        title: '操作失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此模型吗？')) return;

    try {
      const res = await fetch(`/api/admin/llm-models/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');

      toast({ title: '模型已删除' });
      fetchModels();
    } catch {
      toast({ title: '删除失败', variant: 'destructive' });
    }
  };

  const handleToggleEnabled = async (model: SafeLlmModel) => {
    try {
      const res = await fetch(`/api/admin/llm-models/${model.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !model.enabled }),
      });
      if (!res.ok) throw new Error('更新失败');
      fetchModels();
    } catch {
      toast({ title: '更新失败', variant: 'destructive' });
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'gemini':
        return 'Google Gemini';
      case 'openai-compatible':
        return 'OpenAI 兼容';
      default:
        return provider;
    }
  };

  return (
    <FeatureConfigPanel
      title="LLM 模型管理"
      description="配置系统可用的底层大语言模型，供 Story 引擎和其他功能调用"
      icon={Bot}
    >
      <ConfigSection title="模型列表" description={`已配置 ${models.length} 个模型`}>
        <div className="flex justify-end mb-4">
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加模型
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
          </div>
        ) : (
          <div className="rounded-lg border border-white/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-card/80">
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left font-medium text-foreground/50">名称</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground/50">提供商</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground/50">模型 ID</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground/50">状态</th>
                    <th className="px-4 py-3 text-right font-medium text-foreground/50">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {models.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-foreground/50">
                        暂无已配置的模型
                      </td>
                    </tr>
                  ) : (
                    models.map((model) => (
                      <tr
                        key={model.id}
                        className="border-b border-white/[0.06] last:border-0 hover:bg-card/50"
                      >
                        <td className="px-4 py-3 font-medium">{model.name}</td>
                        <td className="px-4 py-3 text-foreground/60">
                          {getProviderLabel(model.provider)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{model.modelName}</td>
                        <td className="px-4 py-3">
                          <ConfigStatusBadge
                            configured={model.enabled}
                            label={model.enabled ? '启用' : '禁用'}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              className="p-2 text-foreground/50 hover:text-foreground rounded-lg hover:bg-card/80 transition-colors"
                              onClick={() => handleToggleEnabled(model)}
                              title={model.enabled ? '禁用' : '启用'}
                              aria-label={model.enabled ? '禁用模型' : '启用模型'}
                            >
                              <div
                                className={`w-2 h-2 rounded-full ${model.enabled ? 'bg-emerald-500' : 'bg-red-500'}`}
                              />
                            </button>
                            <button
                              className="p-2 text-foreground/50 hover:text-foreground rounded-lg hover:bg-card/80 transition-colors"
                              onClick={() => handleOpenModal(model)}
                              aria-label="编辑模型"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 text-foreground/50 hover:text-red-500 rounded-lg hover:bg-card/80 transition-colors"
                              onClick={() => handleDelete(model.id)}
                              aria-label="删除模型"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ConfigSection>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-xl border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">
                {editingModel.id ? '编辑模型' : '添加模型'}
              </h2>
              <button
                className="p-2 text-foreground/50 hover:text-foreground rounded-lg hover:bg-card/80 transition-colors"
                onClick={handleCloseModal}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-foreground/50">显示名称 *</label>
                  <input
                    type="text"
                    value={editingModel.name}
                    onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                    placeholder="如: Gemini Pro 1.5"
                    className="w-full px-4 py-3 bg-card/60 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-foreground/50">提供商 *</label>
                  <select
                    value={editingModel.provider}
                    onChange={(e) =>
                      setEditingModel({ ...editingModel, provider: e.target.value as LlmProvider })
                    }
                    className="w-full px-4 py-3 bg-card/60 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-border"
                  >
                    <option value="openai-compatible">OpenAI 兼容</option>
                    <option value="gemini">Google Gemini</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground/50">API 接口地址 *</label>
                <input
                  type="text"
                  value={editingModel.baseUrl}
                  onChange={(e) => setEditingModel({ ...editingModel, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-3 bg-card/60 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground/50">
                  API Key {editingModel.id ? '(留空保持不变)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={editingModel.apiKey}
                    onChange={(e) => setEditingModel({ ...editingModel, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 pr-10 bg-card/60 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground"
                    aria-label={showKey ? '隐藏密码' : '显示密码'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground/50">模型 ID *</label>
                <input
                  type="text"
                  value={editingModel.modelName}
                  onChange={(e) => setEditingModel({ ...editingModel, modelName: e.target.value })}
                  placeholder="如: gpt-4o"
                  className="w-full px-4 py-3 bg-card/60 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-foreground/50">
                    温度: {editingModel.temperature}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={editingModel.temperature}
                    onChange={(e) =>
                      setEditingModel({ ...editingModel, temperature: parseFloat(e.target.value) })
                    }
                    className="w-full px-4 py-3 bg-card/60 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-foreground/50">最大 Token 数</label>
                  <input
                    type="number"
                    value={editingModel.maxTokens}
                    onChange={(e) =>
                      setEditingModel({ ...editingModel, maxTokens: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-3 bg-card/60 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-border"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="text-sm text-foreground/50">启用此模型</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editingModel.enabled}
                  onClick={() => setEditingModel({ ...editingModel, enabled: !editingModel.enabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editingModel.enabled ? 'bg-emerald-500' : 'bg-foreground/20'}`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${editingModel.enabled ? 'translate-x-5' : ''}`}
                  />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-card/80 border-t border-border flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-foreground/70 hover:text-foreground rounded-lg hover:bg-card/80 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingModel.id ? '保存修改' : '立即创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeatureConfigPanel>
  );
}
