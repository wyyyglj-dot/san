'use client';

import { Network, Globe, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useAdminConfig } from '@/lib/hooks/use-admin-config';
import { AdminPageLayout } from '@/components/admin/ui/admin-page-layout';
import { useState } from 'react';
import { toast } from '@/components/ui/toaster';
import { Switch } from '@/components/ui/switch';
import type { SystemConfig } from '@/types';

export default function ProxyConfigPage() {
  const { config, setConfig, loading, saving, save } = useAdminConfig<SystemConfig>({
    successMessage: '代理配置已保存',
  });
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!config) return;
    await save({
      proxyEnabled: !!config.proxyEnabled,
      proxyUrl: config.proxyUrl || '',
    } as Partial<SystemConfig>);
  };

  const testConnection = async () => {
    if (!config?.proxyUrl) {
      toast({ title: '请输入代理地址', variant: 'destructive' });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/admin/proxy/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxyUrl: config.proxyUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: `连接测试成功 (${data.latency}ms)`, description: '代理服务器响应正常' });
      } else {
        throw new Error(data.error || '连接失败');
      }
    } catch (err) {
      toast({
        title: '连接测试失败',
        description: err instanceof Error ? err.message : '请检查代理地址是否正确',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading || !config) return null;

  return (
    <AdminPageLayout
      title="代理设置"
      description="配置全局 outbound 代理，用于访问被限制的外部 API 服务"
      icon={Network}
      saving={saving}
      onSave={handleSave}
    >
      <div className="max-w-4xl space-y-6">
        {/* Global Proxy Settings */}
        <div className="bg-card/40 border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Globe className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">全局代理配置</h2>
                <p className="text-sm text-foreground/40">启用后，系统所有的外部 API 请求将默认通过此代理</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-foreground/55">{config.proxyEnabled ? '已启用' : '已禁用'}</span>
              <Switch
                checked={!!config.proxyEnabled}
                onCheckedChange={(checked) => setConfig({ ...config, proxyEnabled: checked })}
              />
            </div>
          </div>

          <div className={`p-6 space-y-6 ${!config.proxyEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/70">代理地址</label>
              <input
                type="text"
                value={config.proxyUrl || ''}
                onChange={(e) => setConfig({ ...config, proxyUrl: e.target.value })}
                placeholder="http://127.0.0.1:7890 或 socks5://127.0.0.1:1080"
                className="w-full px-4 py-2.5 bg-card/40 border border-white/[0.06] rounded-xl text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-2 text-xs text-foreground/40">
                <ShieldCheck className="w-4 h-4 text-emerald-500/60" />
                <span>支持带身份认证的 URL 格式: http://user:pass@host:port</span>
              </div>
              <button
                onClick={testConnection}
                disabled={testing || !config.proxyUrl}
                className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
                测试连接
              </button>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
          <div className="space-y-1">
            <h3 className="font-medium text-amber-500">关于渠道覆盖</h3>
            <p className="text-sm text-foreground/60 leading-relaxed">
              您可以在 <b>图像渠道</b> 或 <b>视频渠道</b> 的编辑页面为特定渠道配置独立的代理地址。
              如果渠道配置了代理，将优先使用渠道设置；否则将回退到此处配置的全局代理。
            </p>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
