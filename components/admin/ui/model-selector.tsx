'use client';

import { useState, useEffect } from 'react';
import type { ModelType } from '@/types';
import { apiGet } from '@/lib/api-client';

interface ModelOption {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
}

interface ModelSelectorProps {
  modelType: ModelType;
  value: string;
  onChange: (modelId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ModelSelector({
  modelType,
  value,
  onChange,
  placeholder = '选择模型...',
  disabled
}: ModelSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);

  useEffect(() => {
    const loadModels = async () => {
      setLoading(true);
      try {
        let endpoint = '';
        if (modelType === 'image') {
          endpoint = '/api/admin/image-models';
        } else if (modelType === 'video') {
          endpoint = '/api/admin/video-models';
        } else if (modelType === 'llm') {
          endpoint = '/api/admin/llm-models';
        }

        if (!endpoint) return;

        const data = await apiGet<ModelOption[]>(endpoint);
          const list = Array.isArray(data) ? data : [];
          setModels(list.map((m) => ({
            id: m.id || '',
            name: m.name || '',
            description: m.description,
            enabled: m.enabled
          })));
      } catch (error) {
        console.error('Failed to load models:', error);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [modelType]);

  const selectedModel = models.find(m => m.id === value);

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground appearance-none cursor-pointer focus:outline-none focus:border-white/[0.1] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">{loading ? '加载中...' : placeholder}</option>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
            {model.enabled === false ? ' (已禁用)' : ''}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          className="w-4 h-4 text-foreground/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      {selectedModel?.description && (
        <p className="mt-1 text-xs text-foreground/40">{selectedModel.description}</p>
      )}
    </div>
  );
}
