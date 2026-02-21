'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  ArrowLeft,
  Menu,
  X,
  Megaphone,
  Sparkles,
  Network,
  MessageSquare,
  Globe,
  Image,
  Video,
  BarChart3,
  History,
  Ticket,
  UserPlus,
  Layout,
  Activity,
  Cpu,
  Wand2,
  Shield,
  UsersRound,
  FileText,
  Bot,
} from 'lucide-react';
import { useState, useEffect, useCallback, type ElementType } from 'react';
import { cn } from '@/lib/utils';
import { useSiteConfig } from '@/components/providers/site-config-provider';
import { useDebug } from '@/components/providers/debug-provider';
import { Switch } from '@/components/ui/switch';
import type { UserRole } from '@/types';
import { notify } from '@/lib/toast-utils';
import { apiPost, apiGet } from '@/lib/api-client';

interface NavItem {
  href: string;
  label: string;
  icon: ElementType;
  exact?: boolean;
  roles?: UserRole[];
}

interface NavGroup {
  label: string;
  roles?: UserRole[];
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: '仪表盘',
    items: [
      { href: '/admin', label: '概览', icon: LayoutDashboard, exact: true, roles: ['admin', 'moderator'] },
      { href: '/admin/stats', label: '数据统计', icon: BarChart3, roles: ['admin', 'moderator'] },
    ]
  },
  {
    label: '运营管理',
    items: [
      { href: '/admin/users', label: '用户管理', icon: Users, roles: ['admin', 'moderator'] },
      { href: '/admin/user-groups', label: '用户组', icon: UsersRound, roles: ['admin'] },
      { href: '/admin/redemption', label: '卡密管理', icon: Ticket, roles: ['admin', 'moderator'] },
      { href: '/admin/invites', label: '邀请码', icon: UserPlus, roles: ['admin'] },
      { href: '/admin/generations', label: '生成记录', icon: History, roles: ['admin'] },
      { href: '/admin/announcement', label: '公告管理', icon: Megaphone, roles: ['admin'] },
    ]
  },
  {
    label: '功能配置',
    items: [
      { href: '/admin/prompt-enhancement', label: '提示词增强', icon: Wand2, roles: ['admin'] },
      { href: '/admin/agents', label: 'Agent 管理', icon: Bot, roles: ['admin'] },
    ]
  },
  {
    label: '模型服务',
    items: [
      { href: '/admin/models', label: '聊天模型', icon: MessageSquare, roles: ['admin'] },
      { href: '/admin/image-channels', label: '图像渠道', icon: Image, roles: ['admin'] },
      { href: '/admin/video-channels', label: '视频渠道', icon: Video, roles: ['admin'] },
      { href: '/admin/llm-models', label: 'LLM 模型', icon: Cpu, roles: ['admin'] },
    ]
  },
  {
    label: '系统设置',
    items: [
      { href: '/admin/pages', label: '页面配置', icon: Layout, roles: ['admin'] },
      { href: '/admin/site', label: '网站配置', icon: Globe, roles: ['admin'] },
      { href: '/admin/security', label: '安全与限制', icon: Shield, roles: ['admin'] },
      { href: '/admin/proxy', label: '代理设置', icon: Network, roles: ['admin'] },
      { href: '/admin/system', label: '系统稳定性', icon: Activity, roles: ['admin'] },
    ]
  }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const siteConfig = useSiteConfig();
  const { isDebugMode, setDebugMode } = useDebug();
  const [isVerboseLog, setIsVerboseLog] = useState(false);
  const [isVerboseUpdating, setIsVerboseUpdating] = useState(false);

  useEffect(() => {
    if (session?.user?.role === 'admin') {
      apiGet<{ soraLogVerbose?: boolean }>('/api/admin/settings')
        .then(data => {
          if (data) setIsVerboseLog(!!data.soraLogVerbose);
        })
        .catch(() => {});
    }
  }, [session?.user?.role]);

  const handleVerboseToggle = useCallback(async (checked: boolean) => {
    const prev = isVerboseLog;
    setIsVerboseLog(checked);
    setIsVerboseUpdating(true);
    try {
      await apiPost('/api/admin/settings', { soraLogVerbose: checked });
      notify.success(checked ? '全量日志已开启' : '全量日志已关闭');
    } catch {
      setIsVerboseLog(prev);
      notify.error('更新配置失败');
    } finally {
      setIsVerboseUpdating(false);
    }
  }, [isVerboseLog]);

  const userRole = session?.user?.role || 'user';

  const filteredGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      const effectiveRoles = item.roles ?? group.roles;
      if (!effectiveRoles) return false;
      return effectiveRoles.includes(userRole);
    })
  })).filter(group => group.items.length > 0);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-white/[0.06]">
        <Link href="/image" className="flex items-center gap-2 text-foreground/45 hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span>返回首页</span>
        </Link>
        <div className="flex items-center gap-3 mt-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/25 to-emerald-500/25 border border-white/[0.06] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-foreground/65" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">管理后台</h1>
            <p className="text-xs text-muted-foreground">{siteConfig.siteName} Admin</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {filteredGroups.map((group) => (
          <div key={group.label}>
            <h3 className="mb-2 px-4 text-xs font-semibold text-foreground/40 uppercase tracking-wider select-none">
              {group.label}
            </h3>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 border border-transparent',
                        active
                          ? 'bg-white/[0.08] text-foreground border-white/[0.06]'
                          : 'text-foreground/55 hover:bg-white/[0.04] hover:text-foreground'
                      )}
                    >
                      <item.icon className={cn('w-4 h-4', active && 'text-foreground')} />
                      <span className="font-medium text-sm">{item.label}</span>
                      {active && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary/80" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.06]">
        <div className="px-4 py-3 rounded-xl bg-card/40 border border-white/[0.06]">
          {userRole === 'admin' ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label htmlFor="debug-mode" className="text-xs font-medium text-foreground/65 cursor-pointer select-none">Debug Mode</label>
                <Switch id="debug-mode" checked={isDebugMode} onCheckedChange={setDebugMode} className="scale-75 origin-right" aria-label="Toggle Debug Mode" />
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="verbose-log" className="text-xs font-medium text-foreground/65 cursor-pointer select-none">全量日志</label>
                <Switch
                  id="verbose-log"
                  checked={isVerboseLog}
                  onCheckedChange={handleVerboseToggle}
                  disabled={isVerboseUpdating}
                  className="scale-75 origin-right"
                  aria-label="Toggle Verbose Logging"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">v1.0.0</p>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-card/50 backdrop-blur-sm rounded-xl text-foreground border border-white/[0.06]"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-40 w-[var(--sidebar-width)] bg-card/85 backdrop-blur-xl border-r border-white/[0.06] flex flex-col transform transition-transform duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-[var(--sidebar-width)] bg-card/50 backdrop-blur-xl border-r border-white/[0.06] flex-col sticky top-0 h-screen">
        <NavContent />
      </aside>
    </>
  );
}
