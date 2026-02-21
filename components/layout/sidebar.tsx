'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Video,
  History,
  Settings,
  Shield,
  Image,
  User,
  FolderKanban,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isPageDisabled } from '@/lib/page-registry';
import type { SafeUser } from '@/types';
import { useSiteConfig } from '@/components/providers/site-config-provider';
import { apiGet } from '@/lib/api-client';

interface SidebarProps {
  user: SafeUser;
}

type GenerationStatus = 'queued' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

interface VideoTaskStatus {
  id: string;
  status: GenerationStatus;
  createdAt: number;
  updatedAt: number;
  durationMs?: number;
  elapsedMs?: number;
  queuePosition?: number;
}

const STATUS_POLL_MS = 5_000;
const VIDEO_POLL_MS = 5_000;
const VIDEO_DISPLAY_LIMIT = 3;

const statusLabelMap: Record<GenerationStatus, string> = {
  queued: '队列中',
  pending: '排队中',
  processing: '生成中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const statusColorMap: Record<GenerationStatus, string> = {
  queued: 'bg-violet-400',
  pending: 'bg-amber-400',
  processing: 'bg-sky-400',
  completed: 'bg-emerald-400',
  failed: 'bg-rose-400',
  cancelled: 'bg-zinc-400',
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}分钟`);
  parts.push(`${seconds}秒`);
  return parts.join(' ');
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return '未更新';
  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 60_000) return '刚刚';
  if (deltaMs < 60 * 60_000) return `${Math.floor(deltaMs / 60_000)}分钟前`;
  if (deltaMs < 24 * 60 * 60_000) return `${Math.floor(deltaMs / (60 * 60_000))}小时前`;
  return `${Math.floor(deltaMs / (24 * 60 * 60_000))}天前`;
}

const navItems = [
  { href: '/create', icon: Sparkles, label: 'AI 创作', description: '图片 / 视频生成', badge: 'AI', isAI: true },
  { href: '/projects', icon: FolderKanban, label: '项目管理', description: '漫剧作品管理', badge: 'NEW', isAI: false },
  { href: '/video/character-card', icon: User, label: '角色卡生成', description: '从视频提取角色', badge: 'NEW', isAI: true },
  { href: '/history', icon: History, label: '历史', description: '作品记录', badge: null, isAI: false },
  { href: '/settings', icon: Settings, label: '设置', description: '账号管理', badge: null, isAI: false },
];

const adminItems = [
  { href: '/admin', icon: Shield, label: '控制台', description: '系统管理' },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const siteConfig = useSiteConfig();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingUpdatedAt, setPendingUpdatedAt] = useState<number | null>(null);
  const [videoTasks, setVideoTasks] = useState<VideoTaskStatus[]>([]);
  const [videoUpdatedAt, setVideoUpdatedAt] = useState<number | null>(null);

  const fetchPendingTasks = useCallback(async () => {
    try {
      const data = await apiGet<{ count: number }>('/api/status/pending', { cache: 'no-store' });
      const count = Number(data?.count);
      setPendingCount(Number.isFinite(count) ? count : 0);
      setPendingUpdatedAt(Date.now());
    } catch (error) {
      console.error('[Status Panel] Failed to fetch pending tasks:', error);
    }
  }, []);

  const fetchVideoTasks = useCallback(async () => {
    try {
      const payload = await apiGet<{ tasks: VideoTaskStatus[]; updatedAt?: number }>('/api/status/video', { cache: 'no-store' });
      const rows = Array.isArray(payload?.tasks) ? payload.tasks : [];
      const mapped = rows.map((item: VideoTaskStatus) => ({
        id: String(item.id),
        status: item.status,
        createdAt: Number(item.createdAt) || 0,
        updatedAt: Number(item.updatedAt) || Number(item.createdAt) || 0,
        durationMs: typeof item.durationMs === 'number' ? item.durationMs : undefined,
        elapsedMs: typeof item.elapsedMs === 'number' ? item.elapsedMs : undefined,
      }));

      setVideoTasks(mapped.slice(0, VIDEO_DISPLAY_LIMIT));
      setVideoUpdatedAt(typeof payload?.updatedAt === 'number' ? payload.updatedAt : Date.now());
    } catch (error) {
      console.error('[Status Panel] Failed to fetch video tasks:', error);
    }
  }, []);

  useEffect(() => {
    void fetchPendingTasks();
    const interval = setInterval(fetchPendingTasks, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchPendingTasks]);

  useEffect(() => {
    void fetchVideoTasks();
    const interval = setInterval(fetchVideoTasks, VIDEO_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchVideoTasks]);

  return (
    <>
    <aside className="fixed left-0 top-14 bottom-0 w-[var(--sidebar-width)] bg-card/50 backdrop-blur-xl border-r border-white/[0.06] hidden lg:flex flex-col">
      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.2em] px-3 py-2">
          创作工具
        </p>
        {navItems
          .filter(item => {
            // 管理员和协管员可以看到所有页面
            if (user.role === 'admin' || user.role === 'moderator') return true;
            // 普通用户过滤禁用的页面
            return !isPageDisabled(item.href, siteConfig.disabledPages || []);
          })
          .map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 border border-transparent',
                isActive
                  ? 'bg-white/[0.08] text-foreground border-white/[0.06]'
                  : 'hover:bg-white/[0.04] text-foreground/60'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                isActive ? 'bg-foreground/5' : 'bg-white/[0.04] group-hover:bg-white/[0.06]'
              )}>
                <item.icon className={cn('w-3.5 h-3.5', isActive ? 'text-foreground' : 'text-foreground/45')} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    'text-sm font-medium',
                    isActive ? 'text-foreground' : 'text-foreground/65'
                  )}>{item.label}</p>
                  {item.badge && (
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded border border-white/[0.05]',
                      isActive ? 'bg-white/[0.06] text-foreground/60' : 'bg-white/[0.04] text-foreground/40'
                    )}>{item.badge}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Admin Navigation */}
      {user.role === 'admin' && (
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.2em] px-3 py-2">
            管理
          </p>
          {adminItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 border border-transparent',
                  isActive
                    ? 'bg-white/[0.08] text-foreground border-white/[0.06]'
                    : 'hover:bg-white/[0.04] text-foreground/60'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                  isActive ? 'bg-foreground/5' : 'bg-white/[0.04] group-hover:bg-white/[0.06]'
                )}>
                  <item.icon className={cn('w-3.5 h-3.5', isActive ? 'text-foreground' : 'text-foreground/45')} />
                </div>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    isActive ? 'text-foreground' : 'text-foreground/65'
                  )}>{item.label}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Status Panel */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.2em] px-3 py-2">
          状态面板
        </p>
        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.06] bg-card/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/55">进行中任务</span>
              <span className="text-sm font-semibold text-foreground">
                {pendingCount ?? '--'}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-foreground/40">
              更新于 {formatRelativeTime(pendingUpdatedAt)}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-card/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/55">Sora 视频</span>
              <span className="text-[10px] text-foreground/40">
                更新于 {formatRelativeTime(videoUpdatedAt)}
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {videoTasks.length === 0 ? (
                <p className="text-[10px] text-foreground/40">暂无任务</p>
              ) : (
                videoTasks.map((task) => {
                  const statusLabel = statusLabelMap[task.status] ?? '未知';
                  const statusColor = statusColorMap[task.status] ?? 'bg-zinc-400';
                  const durationMs = typeof task.durationMs === 'number' ? task.durationMs : task.elapsedMs;
                  return (
                    <div key={task.id} className="flex items-center justify-between text-[11px] text-foreground/55">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusColor)} />
                        <span className="text-[10px] uppercase tracking-wide">
                          {statusLabel}
                          {task.status === 'queued' && task.queuePosition ? ` #${task.queuePosition}` : ''}
                        </span>
                      </div>
                      <span className="text-foreground/40">
                        {typeof durationMs === 'number' ? formatDuration(durationMs) : '--'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-center gap-3">
          <p className="text-[10px] text-foreground/40">{siteConfig.siteName} © {new Date().getFullYear()}</p>
        </div>
      </div>
    </aside>
    </>
  );
}
