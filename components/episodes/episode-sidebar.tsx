'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  FileSearch,
  Clapperboard,
  Image as ImageIcon,
  Download,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';

export type SidebarView = 'overview' | 'script-parse' | 'storyboard' | 'assets' | 'export';

interface SidebarItem {
  id: SidebarView;
  label: string;
  icon: typeof LayoutDashboard;
}

const sidebarItems: SidebarItem[] = [
  { id: 'overview', label: '概览', icon: LayoutDashboard },
  { id: 'script-parse', label: '剧本解析', icon: FileSearch },
  { id: 'storyboard', label: 'AI 分镜', icon: Clapperboard },
  { id: 'assets', label: '生成素材', icon: ImageIcon },
  { id: 'export', label: '导出', icon: Download },
];

interface EpisodeSidebarProps {
  currentView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function EpisodeSidebar({
  currentView,
  onViewChange,
  collapsed,
  onToggleCollapse,
}: EpisodeSidebarProps) {
  return (
    <aside
      className={cn(
        'flex flex-col border-l border-white/[0.05] bg-card/55 backdrop-blur-md transition-all duration-300',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <div className="flex h-12 items-center justify-end border-b border-white/[0.04] px-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {sidebarItems.map((navItem) => {
            const Icon = navItem.icon;
            const isActive = currentView === navItem.id;

            return (
              <Button
                key={navItem.id}
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full transition-all',
                  collapsed ? 'justify-center px-0' : 'justify-start px-4',
                  isActive && 'bg-primary/10 text-primary hover:bg-primary/20',
                )}
                onClick={() => onViewChange(navItem.id)}
                title={collapsed ? navItem.label : undefined}
              >
                <Icon className={cn('h-5 w-5 flex-shrink-0', collapsed ? '' : 'mr-3')} />
                {!collapsed && <span className="text-sm">{navItem.label}</span>}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
