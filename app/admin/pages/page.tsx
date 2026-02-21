'use client';

import { useState, useEffect } from 'react';
import { Layout, Loader2, Save, Image, Video, Workflow, LayoutGrid, History, Settings, FileText } from 'lucide-react';
import { AdminPageLayout } from '@/components/admin/ui/admin-page-layout';
import { toast } from '@/components/ui/toaster';
import { PAGE_REGISTRY } from '@/lib/page-registry';

// 图标映射
const iconMap: Record<string, typeof Layout> = {
  Image,
  Video,
  Workflow,
  LayoutGrid,
  History,
  Settings,
};

export default function PageVisibilityPage() {
  const [disabledPages, setDisabledPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setDisabledPages(data.data?.disabledPages || []);
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabledPages }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast({ title: '配置已保存' });
    } catch (err) {
      toast({
        title: '保存失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePage = (href: string) => {
    setDisabledPages(prev =>
      prev.includes(href)
        ? prev.filter(p => p !== href)
        : [...prev, href]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
      </div>
    );
  }

  return (
    <AdminPageLayout
      title="页面可见性"
      description="控制普通用户可以访问的前端页面"
      icon={FileText}
      saving={saving}
      onSave={saveConfig}
    >
      {/* Page List Card */}
      <div className="bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Layout className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="font-medium text-foreground">路由管理</h2>
            <p className="text-xs text-foreground/40">关闭后普通用户将无法访问该页面</p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.05]">
          {PAGE_REGISTRY.map((page) => {
            const IconComponent = iconMap[page.icon] || Layout;
            const isEnabled = !disabledPages.includes(page.href);

            return (
              <div
                key={page.href}
                className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-card/65 border border-white/[0.05] flex items-center justify-center">
                    <IconComponent className="w-5 h-5 text-foreground/60" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{page.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-foreground/40 px-1.5 py-0.5 rounded bg-card/65 border border-white/[0.05]">
                        {page.href}
                      </code>
                      {page.matchType === 'prefix' && (
                        <span className="text-[10px] text-foreground/30 px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          含子路由
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => togglePage(page.href)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    isEnabled ? 'bg-green-500' : 'bg-card/65 border border-white/[0.05]'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-foreground transition-transform ${
                      isEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-card/40 border border-white/[0.06] rounded-xl p-4">
        <p className="text-sm text-foreground/50">
          <span className="text-foreground/55 font-medium">提示：</span>
          管理员和协管员始终可以访问所有页面，此设置仅对普通用户生效。
          禁用的页面将从导航菜单隐藏，且直接访问 URL 会被重定向。
        </p>
      </div>
    </AdminPageLayout>
  );
}
