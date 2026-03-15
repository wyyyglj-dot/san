'use client';

import { Globe, Upload, UserPlus, Coins, Activity, Shield, Cloud, Mail, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAdminConfig } from '@/lib/hooks/use-admin-config';
import { AdminPageLayout } from '@/components/admin/ui/admin-page-layout';
import { useSiteConfigRefresh } from '@/components/providers/site-config-provider';
import { toast } from '@/components/ui/toaster';
import type { SystemConfig, RateLimitConfigSettings } from '@/types';

export default function SiteConfigPage() {
  const { config, setConfig, loading, saving, save } = useAdminConfig<SystemConfig>({
    successMessage: '配置已保存',
  });
  const refreshSiteConfig = useSiteConfigRefresh();
  const [testingSmtp, setTestingSmtp] = useState(false);

  const handleSave = async () => {
    if (!config) return;
    const ok = await save({
      siteConfig: config.siteConfig,
      picuiApiKey: config.picuiApiKey,
      picuiBaseUrl: config.picuiBaseUrl,
      registerEnabled: config.registerEnabled,
      defaultBalance: config.defaultBalance,
      defaultConcurrencyLimit: config.defaultConcurrencyLimit,
      rateLimit: config.rateLimit,
      imgbedEnabled: config.imgbedEnabled,
      imgbedBaseUrl: config.imgbedBaseUrl,
      imgbedApiToken: config.imgbedApiToken,
      imgbedAuthCode: config.imgbedAuthCode,
      imgbedUploadChannel: config.imgbedUploadChannel,
      imgbedBackupEnabled: config.imgbedBackupEnabled,
      imgbedBackupBaseUrl: config.imgbedBackupBaseUrl,
      imgbedBackupApiToken: config.imgbedBackupApiToken,
      imgbedBackupAuthCode: config.imgbedBackupAuthCode,
      imgbedBackupUploadChannel: config.imgbedBackupUploadChannel,
      imgbedMaxFileSize: config.imgbedMaxFileSize,
      imgbedAllowedTypes: config.imgbedAllowedTypes,
      imgbedUploadFolder: config.imgbedUploadFolder,
      smtp: config.smtp,
    } as Partial<SystemConfig>);
    if (ok) await refreshSiteConfig();
  };

  if (loading || !config) return null;

  const updateSiteConfig = (key: keyof typeof config.siteConfig, value: string) => {
    setConfig({
      ...config,
      siteConfig: { ...config.siteConfig, [key]: value }
    });
  };

  const updateRateLimit = (key: keyof RateLimitConfigSettings, value: string) => {
    if (!config) return;
    const numValue = Math.max(1, parseInt(value) || 1);
    const currentRateLimit = config.rateLimit || { api: 60, generate: 20, chat: 30, auth: 5 };
    setConfig({
      ...config,
      rateLimit: { ...currentRateLimit, [key]: numValue }
    });
  };

  const updateSmtp = (key: string, value: string | number | boolean) => {
    if (!config) return;
    const currentSmtp = config.smtp || { host: '', port: 465, secure: true, user: '', pass: '', from: '' };
    setConfig({
      ...config,
      smtp: { ...currentSmtp, [key]: value }
    });
  };

  const testSmtp = async () => {
    if (!config?.smtp?.host) {
      toast({ title: '请先填写 SMTP 服务器地址', variant: 'destructive' });
      return;
    }
    setTestingSmtp(true);
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtp: config.smtp }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: '测试邮件发送成功', description: data.message });
      } else {
        throw new Error(data.error || '发送失败');
      }
    } catch (err) {
      toast({
        title: 'SMTP 测试失败',
        description: err instanceof Error ? err.message : '请检查 SMTP 配置',
        variant: 'destructive',
      });
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <AdminPageLayout
      title="网站配置"
      description="自定义网站名称、标语、版权等信息"
      icon={Globe}
      saving={saving}
      onSave={handleSave}
    >

      <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <h2 className="font-medium text-foreground">基本信息</h2>
        </div>

        <div className="p-4 space-y-4">
          {/* 网站名称 */}
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">网站名称</label>
            <input
              type="text"
              value={config.siteConfig.siteName}
              onChange={(e) => updateSiteConfig('siteName', e.target.value)}
              placeholder="SANHUB"
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
            <p className="text-xs text-foreground/30">显示在页面标题、Logo 等位置</p>
          </div>

          {/* 英文标语 */}
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">英文标语</label>
            <input
              type="text"
              value={config.siteConfig.siteTagline}
              onChange={(e) => updateSiteConfig('siteTagline', e.target.value)}
              placeholder="让想象力迸发"
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
            <p className="text-xs text-foreground/30">首页大标题</p>
          </div>

          {/* 中文描述 */}
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">中文描述</label>
            <input
              type="text"
              value={config.siteConfig.siteDescription}
              onChange={(e) => updateSiteConfig('siteDescription', e.target.value)}
              placeholder="「SANHUB」是专为 AI 创作打造的一站式平台"
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
          </div>

          {/* 中文副描述 */}
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">中文副描述</label>
            <textarea
              value={config.siteConfig.siteSubDescription}
              onChange={(e) => updateSiteConfig('siteSubDescription', e.target.value)}
              placeholder="我们融合了 Sora 视频生成、Gemini 图像创作与多模型 AI 对话..."
              rows={3}
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border resize-none"
            />
          </div>

          {/* 联系邮箱 */}
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">联系邮箱</label>
            <input
              type="email"
              value={config.siteConfig.contactEmail}
              onChange={(e) => updateSiteConfig('contactEmail', e.target.value)}
              placeholder="support@sanhub.com"
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
          </div>

          {/* 版权信息 */}
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">版权信息</label>
            <input
              type="text"
              value={config.siteConfig.copyright}
              onChange={(e) => updateSiteConfig('copyright', e.target.value)}
              placeholder="版权所有 © 2025 SANHUB"
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
          </div>

          {/* 技术支持信息 */}
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">技术支持信息</label>
            <input
              type="text"
              value={config.siteConfig.poweredBy}
              onChange={(e) => updateSiteConfig('poweredBy', e.target.value)}
              placeholder="由 OpenAI Sora 和 Google Gemini 驱动"
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
          </div>
        </div>
      </div>

      {/* 图床配置 */}
      <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
            <Upload className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h2 className="font-medium text-foreground">图床配置</h2>
            <p className="text-xs text-foreground/40">用于上传和存储生成的图片</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* PicUI Base URL */}
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">PicUI 接口地址</label>
            <input
              type="text"
              value={config.picuiBaseUrl}
              onChange={(e) => setConfig({ ...config, picuiBaseUrl: e.target.value })}
              placeholder="https://picui.cn/api/v1"
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
            <p className="text-xs text-foreground/30">默认为 https://picui.cn/api/v1</p>
          </div>

          {/* PicUI API Key */}
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">PicUI API 密钥</label>
            <input
              type="password"
              value={config.picuiApiKey}
              onChange={(e) => setConfig({ ...config, picuiApiKey: e.target.value })}
              placeholder="输入 PicUI API Key"
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
            <p className="text-xs text-foreground/30">
              从 <a href="https://picui.cn" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">picui.cn</a> 获取 API Key
            </p>
          </div>
        </div>
      </div>

      {/* CloudFlare-ImgBed 文件床配置 */}
      <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <Cloud className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="font-medium text-foreground">CloudFlare 图床配置</h2>
            <p className="text-xs text-foreground/40">用于角色卡视频上传（自建文件床服务）</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-foreground">启用文件床</label>
              <p className="text-xs text-foreground/30 mt-1">开启后，角色卡页面可上传视频到文件床</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, imgbedEnabled: !config.imgbedEnabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config.imgbedEnabled ? 'bg-green-500' : 'bg-card/65 border border-white/[0.06]'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-foreground transition-transform ${
                config.imgbedEnabled ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>

          {config.imgbedEnabled && (
            <>
              {/* 主文件床配置 */}
              <div className="border-t border-white/[0.05] pt-4 mt-2">
                <h3 className="text-sm font-medium text-foreground mb-3">主文件床</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-foreground/50">文件床域名 *</label>
                    <input
                      type="text"
                      value={config.imgbedBaseUrl || ''}
                      onChange={(e) => setConfig({ ...config, imgbedBaseUrl: e.target.value })}
                      placeholder="https://img.example.com"
                      className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-foreground/50">上传渠道</label>
                    <select
                      value={config.imgbedUploadChannel || 'telegram'}
                      onChange={(e) => setConfig({ ...config, imgbedUploadChannel: e.target.value })}
                      className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-border"
                    >
                      {['telegram', 'cfr2', 's3', 'discord', 'huggingface'].map(c => (
                        <option key={c} value={c}>{c.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-foreground/50">API 令牌（推荐）</label>
                    <input
                      type="password"
                      value={config.imgbedApiToken || ''}
                      onChange={(e) => setConfig({ ...config, imgbedApiToken: e.target.value })}
                      placeholder="文件床 API Token"
                      className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-foreground/50">AuthCode（备选）</label>
                    <input
                      type="password"
                      value={config.imgbedAuthCode || ''}
                      onChange={(e) => setConfig({ ...config, imgbedAuthCode: e.target.value })}
                      placeholder="文件床访问密码"
                      className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                    />
                  </div>
                </div>
              </div>

              {/* 文件限制配置 */}
              <div className="border-t border-white/[0.05] pt-4 mt-2">
                <h3 className="text-sm font-medium text-foreground mb-3">文件限制</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-foreground/50">最大文件大小 (MB)</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={config.imgbedMaxFileSize || 50}
                      onChange={(e) => setConfig({ ...config, imgbedMaxFileSize: parseInt(e.target.value) || 50 })}
                      className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-foreground/50">允许的文件类型</label>
                    <input
                      type="text"
                      value={config.imgbedAllowedTypes || 'mp4,webm,mov'}
                      onChange={(e) => setConfig({ ...config, imgbedAllowedTypes: e.target.value })}
                      placeholder="mp4,webm,mov"
                      className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-foreground/50">上传文件夹</label>
                    <input
                      type="text"
                      value={config.imgbedUploadFolder || 'character-cards'}
                      onChange={(e) => setConfig({ ...config, imgbedUploadFolder: e.target.value })}
                      placeholder="character-cards"
                      className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                    />
                  </div>
                </div>
              </div>

              {/* 备用文件床配置 */}
              <div className="border-t border-white/[0.05] pt-4 mt-2">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">备用文件床</h3>
                    <p className="text-xs text-foreground/30 mt-1">主文件床不可用时自动切换</p>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, imgbedBackupEnabled: !config.imgbedBackupEnabled })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      config.imgbedBackupEnabled ? 'bg-green-500' : 'bg-card/65 border border-white/[0.06]'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${
                      config.imgbedBackupEnabled ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                {config.imgbedBackupEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-foreground/50">备用域名</label>
                      <input
                        type="text"
                        value={config.imgbedBackupBaseUrl || ''}
                        onChange={(e) => setConfig({ ...config, imgbedBackupBaseUrl: e.target.value })}
                        placeholder="https://backup-img.example.com"
                        className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-foreground/50">备用上传渠道</label>
                      <select
                        value={config.imgbedBackupUploadChannel || 'telegram'}
                        onChange={(e) => setConfig({ ...config, imgbedBackupUploadChannel: e.target.value })}
                        className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-border"
                      >
                        {['telegram', 'cfr2', 's3', 'discord', 'huggingface'].map(c => (
                          <option key={c} value={c}>{c.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-foreground/50">备用 API 令牌</label>
                      <input
                        type="password"
                        value={config.imgbedBackupApiToken || ''}
                        onChange={(e) => setConfig({ ...config, imgbedBackupApiToken: e.target.value })}
                        placeholder="备用文件床 API Token"
                        className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-foreground/50">备用 AuthCode</label>
                      <input
                        type="password"
                        value={config.imgbedBackupAuthCode || ''}
                        onChange={(e) => setConfig({ ...config, imgbedBackupAuthCode: e.target.value })}
                        placeholder="备用文件床访问密码"
                        className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 注册设置 */}
      <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-500/20 rounded-lg flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h2 className="font-medium text-foreground">注册设置</h2>
            <p className="text-xs text-foreground/40">控制用户注册和初始积分</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 开放注册开关 */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-foreground">开放注册</label>
              <p className="text-xs text-foreground/30 mt-1">关闭后新用户将无法注册</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, registerEnabled: !config.registerEnabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config.registerEnabled ? 'bg-green-500' : 'bg-card/65'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-foreground transition-transform ${
                  config.registerEnabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* 注册送积分 */}
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">注册送积分</label>
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-400" />
              <input
                type="number"
                min="0"
                value={config.defaultBalance}
                onChange={(e) => setConfig({ ...config, defaultBalance: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-32 px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
              />
              <span className="text-foreground/50 text-sm">积分</span>
            </div>
            <p className="text-xs text-foreground/30">新用户注册时自动获得的积分数量</p>
          </div>
        </div>
      </div>

      {/* SMTP 邮件配置 */}
      <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
            <Mail className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h2 className="font-medium text-foreground">邮件服务 (SMTP)</h2>
            <p className="text-xs text-foreground/40">用于注册验证码和密码找回，配置后注册需邮箱验证</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-foreground/50">SMTP 服务器</label>
              <input
                type="text"
                value={config.smtp?.host || ''}
                onChange={(e) => updateSmtp('host', e.target.value)}
                placeholder="smtp.qq.com"
                className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground/50">端口</label>
              <input
                type="number"
                value={config.smtp?.port || 465}
                onChange={(e) => updateSmtp('port', parseInt(e.target.value) || 465)}
                placeholder="465"
                className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground/50">用户名（邮箱地址）</label>
              <input
                type="text"
                value={config.smtp?.user || ''}
                onChange={(e) => updateSmtp('user', e.target.value)}
                placeholder="noreply@example.com"
                className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground/50">密码 / 授权码</label>
              <input
                type="password"
                value={config.smtp?.pass || ''}
                onChange={(e) => updateSmtp('pass', e.target.value)}
                placeholder="SMTP 授权码"
                className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground/50">发件人地址</label>
              <input
                type="text"
                value={config.smtp?.from || ''}
                onChange={(e) => updateSmtp('from', e.target.value)}
                placeholder="SanHub <noreply@example.com>"
                className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
              />
              <p className="text-xs text-foreground/30">格式: 名称 &lt;邮箱&gt; 或直接填邮箱</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground/50">SSL/TLS</label>
              <div className="flex items-center gap-3 h-[50px]">
                <button
                  onClick={() => updateSmtp('secure', !config.smtp?.secure)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    config.smtp?.secure !== false ? 'bg-green-500' : 'bg-card/65 border border-white/[0.06]'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-foreground transition-transform ${
                    config.smtp?.secure !== false ? 'left-7' : 'left-1'
                  }`} />
                </button>
                <span className="text-sm text-foreground/50">{config.smtp?.secure !== false ? '已启用' : '已禁用'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
            <p className="text-xs text-foreground/30">
              QQ 邮箱: smtp.qq.com:465 | 163 邮箱: smtp.163.com:465 | Gmail: smtp.gmail.com:587
            </p>
            <button
              onClick={testSmtp}
              disabled={testingSmtp || !config.smtp?.host}
              className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {testingSmtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              测试发送
            </button>
          </div>
        </div>
      </div>

      {/* 并发限制配置 */}
      <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="font-medium text-foreground">并发限制</h2>
            <p className="text-xs text-foreground/40">控制用户同时运行的任务数量</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">默认最大并发任务数</label>
            <input
              type="number"
              min="0"
              value={config.defaultConcurrencyLimit}
              onChange={(e) => setConfig({ ...config, defaultConcurrencyLimit: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
              placeholder="2"
            />
            <p className="text-xs text-foreground/30">
              设置为 0 表示不限制。建议设置为 2-5 以保护服务器资源。
            </p>
          </div>
        </div>
      </div>

      {/* 速率限制配置 */}
      <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h2 className="font-medium text-foreground">速率限制</h2>
            <p className="text-xs text-foreground/40">控制 API 请求频率（次/分钟）</p>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">API 通用限流</label>
            <input
              type="number"
              min="1"
              value={config.rateLimit?.api ?? 60}
              onChange={(e) => updateRateLimit('api', e.target.value)}
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
            <p className="text-xs text-foreground/30">默认所有 API 接口的频率限制</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-foreground/50">生成 API 限流</label>
            <input
              type="number"
              min="1"
              value={config.rateLimit?.generate ?? 20}
              onChange={(e) => updateRateLimit('generate', e.target.value)}
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
            <p className="text-xs text-foreground/30">图像/视频生成接口限制</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-foreground/50">聊天 API 限流</label>
            <input
              type="number"
              min="1"
              value={config.rateLimit?.chat ?? 30}
              onChange={(e) => updateRateLimit('chat', e.target.value)}
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
            <p className="text-xs text-foreground/30">AI 对话接口限制</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-foreground/50">登录 API 限流</label>
            <input
              type="number"
              min="1"
              value={config.rateLimit?.auth ?? 5}
              onChange={(e) => updateRateLimit('auth', e.target.value)}
              className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
            />
            <p className="text-xs text-foreground/30">登录/注册接口限制</p>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}

