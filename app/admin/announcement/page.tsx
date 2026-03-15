'use client';

import { useState } from 'react';
import { Megaphone, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAdminConfig } from '@/lib/hooks/use-admin-config';
import { AdminPageLayout } from '@/components/admin/ui/admin-page-layout';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import type { SystemConfig } from '@/types';

export default function AnnouncementPage() {
  const { config, setConfig, loading, saving, save } = useAdminConfig<SystemConfig>();
  const [showPreview, setShowPreview] = useState(false);

  const saveConfig = async () => {
    if (!config) return;
    await save({ announcement: config.announcement });
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
      <div className="text-center text-foreground/50 py-12">
        加载配置失败
      </div>
    );
  }

  return (
    <AdminPageLayout
      title="公告管理"
      description="发布系统公告，支持 HTML 格式"
      icon={Megaphone}
      saving={saving}
      onSave={saveConfig}
      rightElement={
        <Button
          variant="outline"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
          {showPreview ? '编辑' : '预览'}
        </Button>
      }
    >
      <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-yellow-400" />
            </div>
            <h2 className="font-medium text-foreground">系统公告</h2>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-foreground/50">启用公告</span>
            <Switch
              checked={config.announcement.enabled}
              onCheckedChange={(val) => setConfig({
                ...config,
                announcement: { ...config.announcement, enabled: val }
              })}
            />
          </label>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-foreground/50">公告标题</label>
            <Input
              type="text"
              value={config.announcement.title}
              onChange={(e) => setConfig({
                ...config,
                announcement: { ...config.announcement, title: e.target.value }
              })}
              placeholder="输入公告标题"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-foreground/50">公告内容（支持 HTML）</label>
            {showPreview ? (
              <div
                className="w-full min-h-[200px] px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: config.announcement.content || '<p class="text-foreground/30">暂无内容</p>' }}
              />
            ) : (
              <textarea
                value={config.announcement.content}
                onChange={(e) => setConfig({
                  ...config,
                  announcement: { ...config.announcement, content: e.target.value }
                })}
                placeholder="输入公告内容，支持 HTML 标签"
                rows={8}
                className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-lg text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border font-mono text-sm resize-none"
              />
            )}
          </div>

          <div className="text-xs text-foreground/40 space-y-1">
            <p>支持的 HTML 标签：&lt;b&gt;、&lt;i&gt;、&lt;u&gt;、&lt;a&gt;、&lt;br&gt;、&lt;p&gt;、&lt;span&gt; 等</p>
            <p>示例：&lt;b&gt;重要通知&lt;/b&gt;：系统将于今晚 &lt;span style=&quot;color:#ef4444&quot;&gt;22:00&lt;/span&gt; 进行维护</p>
          </div>

          {config.announcement.updatedAt > 0 && (
            <div className="text-xs text-foreground/30 pt-2 border-t border-white/[0.06]">
              上次更新：{new Date(config.announcement.updatedAt).toLocaleString('zh-CN')}
            </div>
          )}
        </div>
      </div>
    </AdminPageLayout>
  );
}