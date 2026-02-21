'use client';

import { Shield, Loader2 } from 'lucide-react';
import { FeatureConfigPanel } from '@/components/admin/ui/feature-config-panel';
import { ConfigSection } from '@/components/admin/ui/config-section';
import { useAdminConfig } from '@/lib/hooks/use-admin-config';
import type { SystemConfig } from '@/types';

const RATE_LIMIT_ENDPOINTS = [
  { key: 'api' as const, label: 'API 通用', defaultVal: 60, desc: '通用 API 接口' },
  { key: 'generate' as const, label: '生成', defaultVal: 20, desc: '图像/视频生成' },
  { key: 'chat' as const, label: '聊天', defaultVal: 30, desc: 'AI 对话接口' },
  { key: 'auth' as const, label: '登录', defaultVal: 5, desc: '认证相关接口' },
];

export default function SecurityPage() {
  const { config, setConfig, loading, saving, save } = useAdminConfig<SystemConfig>();

  const saveConfig = async () => {
    if (!config) return;
    await save({
      rateLimit: config.rateLimit,
      defaultConcurrencyLimit: config.defaultConcurrencyLimit,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center text-foreground/50 py-12">加载配置失败</div>
    );
  }

  return (
    <FeatureConfigPanel
      title="安全与限制"
      description="配置速率限制、并发控制等安全相关设置"
      icon={Shield}
      onSave={saveConfig}
      saving={saving}
    >
      <ConfigSection title="并发限制" description="控制用户同时进行的生成任务数量">
        <div className="space-y-2">
          <label className="text-sm text-foreground/50">默认并发限制</label>
          <input
            type="number"
            min="0"
            value={config.defaultConcurrencyLimit}
            onChange={(e) =>
              setConfig({ ...config, defaultConcurrencyLimit: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-border"
          />
          <p className="text-xs text-foreground/30">
            0 表示不限制，建议设置为 2-5
          </p>
        </div>
      </ConfigSection>

      <ConfigSection title="速率限制" description="控制各 API 端点的请求频率">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">时间窗口 (秒)</label>
            <input
              type="number"
              min="1"
              value={config.rateLimit?.windowSeconds || 60}
              onChange={(e) =>
                setConfig({
                  ...config,
                  rateLimit: {
                    ...config.rateLimit,
                    windowSeconds: parseInt(e.target.value) || 60,
                  },
                })
              }
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-border"
            />
            <p className="text-xs text-foreground/30">
              所有端点共用的限流时间窗口，默认 60 秒
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {RATE_LIMIT_ENDPOINTS.map(({ key, label, defaultVal, desc }) => (
              <div key={key} className="space-y-2">
                <label className="text-sm text-foreground/50">
                  {label} (最大请求数)
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.rateLimit?.[key] ?? defaultVal}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      rateLimit: {
                        ...config.rateLimit,
                        [key]: parseInt(e.target.value) || defaultVal,
                      },
                    })
                  }
                  className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-border"
                />
                <p className="text-xs text-foreground/30">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </ConfigSection>
    </FeatureConfigPanel>
  );
}
