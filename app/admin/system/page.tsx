'use client';

import { Activity, AlertTriangle, RefreshCw, Server, Clock, ShieldAlert, RotateCcw } from 'lucide-react';
import { useAdminConfig } from '@/lib/hooks/use-admin-config';
import { AdminPageLayout } from '@/components/admin/ui/admin-page-layout';
import type { SystemConfig, RetryConfig } from '@/types';

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  http: {
    enabled: true,
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 4000,
  },
  rateLimit: {
    enabled: true,
    maxAttempts: 3,
    baseDelayMs: 1500,
    maxDelayMs: 10000,
  },
  soraPolling: {
    enabled: true,
    maxAttempts: 60,
    baseDelayMs: 2000,
    maxDelayMs: 10000,
    maxPollDurationMs: 2400000,
    stallThreshold: 60,
  },
  soraFailed: {
    enabled: true,
    maxAttempts: 3,
    baseDelayMs: 5000,
    maxDelayMs: 5000,
  },
};

export default function SystemConfigPage() {
  const { config, setConfig, loading, saving, save } = useAdminConfig<SystemConfig>({
    successMessage: '系统稳定性配置已保存',
  });

  const handleSave = async () => {
    if (!config) return;
    await save({ retryConfig: config.retryConfig } as Partial<SystemConfig>);
  };

  const restoreDefaults = () => {
    if (!config) return;
    if (confirm('确定要恢复默认重试配置吗？')) {
      setConfig({
        ...config,
        retryConfig: JSON.parse(JSON.stringify(DEFAULT_RETRY_CONFIG)),
      });
    }
  };

  const updateRetryConfig = <K extends keyof RetryConfig>(
    section: K,
    updates: Partial<RetryConfig[K]>
  ) => {
    if (!config) return;
    const currentRetry = config.retryConfig || DEFAULT_RETRY_CONFIG;
    setConfig({
      ...config,
      retryConfig: {
        ...currentRetry,
        [section]: { ...currentRetry[section], ...updates },
      },
    });
  };

  if (loading || !config) return null;

  const retryConfig = config.retryConfig || DEFAULT_RETRY_CONFIG;

  return (
    <AdminPageLayout
      title="系统稳定性"
      description="配置网络重试策略、超时控制与轮询机制"
      icon={Activity}
      saving={saving}
      onSave={handleSave}
      rightElement={
        <button
          onClick={restoreDefaults}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-white/[0.04] text-foreground/55 rounded-lg font-medium hover:bg-accent/50 transition-colors text-sm sm:text-base"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">恢复默认</span>
        </button>
      }
    >

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HTTP Retry Config */}
        <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Server className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="font-medium text-foreground">HTTP 通用重试</h2>
                <p className="text-xs text-foreground/40">适用于常规 API 请求失败 (5xx, 408)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/50">{retryConfig.http.enabled ? '已启用' : '已禁用'}</span>
              <button
                onClick={() => updateRetryConfig('http', { enabled: !retryConfig.http.enabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  retryConfig.http.enabled ? 'bg-blue-500' : 'bg-card/65 border border-border'
                }`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${
                  retryConfig.http.enabled ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </div>

          <div className={`p-4 space-y-4 ${!retryConfig.http.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm text-foreground/70">最大重试次数</label>
                <span className="text-xs text-foreground/40">建议 1-5 次</span>
              </div>
              <input
                type="number"
                min="1"
                max="10"
                value={retryConfig.http.maxAttempts}
                onChange={(e) => updateRetryConfig('http', { maxAttempts: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2.5 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">基础延迟 (ms)</label>
                <input
                  type="number"
                  min="100"
                  max="5000"
                  value={retryConfig.http.baseDelayMs}
                  onChange={(e) => updateRetryConfig('http', { baseDelayMs: parseInt(e.target.value) || 100 })}
                  className="w-full px-4 py-2.5 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">最大延迟 (ms)</label>
                <input
                  type="number"
                  min="1000"
                  max="60000"
                  value={retryConfig.http.maxDelayMs}
                  onChange={(e) => updateRetryConfig('http', { maxDelayMs: parseInt(e.target.value) || 1000 })}
                  className="w-full px-4 py-2.5 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rate Limit Retry Config */}
        <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="font-medium text-foreground">速率限制重试 (429)</h2>
                <p className="text-xs text-foreground/40">针对上游 API 频率限制的处理</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/50">{retryConfig.rateLimit.enabled ? '已启用' : '已禁用'}</span>
              <button
                onClick={() => updateRetryConfig('rateLimit', { enabled: !retryConfig.rateLimit.enabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  retryConfig.rateLimit.enabled ? 'bg-amber-500' : 'bg-card/65 border border-border'
                }`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${
                  retryConfig.rateLimit.enabled ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </div>

          <div className={`p-4 space-y-4 ${!retryConfig.rateLimit.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm text-foreground/70">最大重试次数</label>
                {retryConfig.rateLimit.maxAttempts > 3 && (
                  <span className="text-xs text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> 高频重试可能导致封禁
                  </span>
                )}
              </div>
              <input
                type="number"
                min="1"
                max="5"
                value={retryConfig.rateLimit.maxAttempts}
                onChange={(e) => updateRetryConfig('rateLimit', { maxAttempts: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2.5 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">基础延迟 (ms)</label>
                <input
                  type="number"
                  min="500"
                  max="10000"
                  value={retryConfig.rateLimit.baseDelayMs}
                  onChange={(e) => updateRetryConfig('rateLimit', { baseDelayMs: parseInt(e.target.value) || 500 })}
                  className="w-full px-4 py-2.5 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">最大延迟 (ms)</label>
                <input
                  type="number"
                  min="1000"
                  max="60000"
                  value={retryConfig.rateLimit.maxDelayMs}
                  onChange={(e) => updateRetryConfig('rateLimit', { maxDelayMs: parseInt(e.target.value) || 1000 })}
                  className="w-full px-4 py-2.5 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sora Polling Config */}
        <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h2 className="font-medium text-foreground">Sora 视频轮询</h2>
                <p className="text-xs text-foreground/40">视频生成任务的状态轮询策略</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/50">{retryConfig.soraPolling.enabled ? '已启用' : '已禁用'}</span>
              <button
                onClick={() => updateRetryConfig('soraPolling', { enabled: !retryConfig.soraPolling.enabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  retryConfig.soraPolling.enabled ? 'bg-purple-500' : 'bg-card/65 border border-border'
                }`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${
                  retryConfig.soraPolling.enabled ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </div>

          <div className={`p-4 space-y-4 ${!retryConfig.soraPolling.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">最大轮询时长 (分钟)</label>
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={Math.floor(retryConfig.soraPolling.maxPollDurationMs / 60000)}
                  onChange={(e) => updateRetryConfig('soraPolling', { maxPollDurationMs: (parseInt(e.target.value) || 10) * 60000 })}
                  className="w-full px-4 py-2.5 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">停滞阈值 (次)</label>
                <input
                  type="number"
                  min="10"
                  max="600"
                  value={retryConfig.soraPolling.stallThreshold}
                  onChange={(e) => updateRetryConfig('soraPolling', { stallThreshold: parseInt(e.target.value) || 10 })}
                  className="w-full px-4 py-2.5 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>
            <p className="text-xs text-foreground/30">进度无变化超过停滞阈值次数视为超时</p>
          </div>
        </div>

        {/* Failed Status Retry Config */}
        <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h2 className="font-medium text-foreground">失败状态重试</h2>
                <p className="text-xs text-foreground/40">任务明确失败后的挽救策略</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/50">{retryConfig.soraFailed.enabled ? '已启用' : '已禁用'}</span>
              <button
                onClick={() => updateRetryConfig('soraFailed', { enabled: !retryConfig.soraFailed.enabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  retryConfig.soraFailed.enabled ? 'bg-red-500' : 'bg-card/65 border border-border'
                }`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${
                  retryConfig.soraFailed.enabled ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </div>

          <div className={`p-4 space-y-4 ${!retryConfig.soraFailed.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="space-y-2">
              <label className="text-sm text-foreground/70">最大重试次数</label>
              <input
                type="number"
                min="1"
                max="5"
                value={retryConfig.soraFailed.maxAttempts}
                onChange={(e) => updateRetryConfig('soraFailed', { maxAttempts: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2.5 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-red-500/50"
              />
            </div>
            <p className="text-xs text-foreground/30">仅针对特定的可重试错误 (如超时)</p>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
