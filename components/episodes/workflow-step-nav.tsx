'use client';

import { cn } from '@/lib/utils';
import { Film, Boxes, Clapperboard } from 'lucide-react';
import { useWorkspaceStore, type WorkspaceTab } from '@/lib/stores/workspace-store';

const steps = [
  { key: 'episodes' as const, label: '剧集管理', icon: Film },
  { key: 'assets' as const, label: '资产管理', icon: Boxes },
  { key: 'production' as const, label: '制作', icon: Clapperboard },
];

export function WorkflowStepNav() {
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);

  return (
    <nav
      className={cn(
        'flex items-center justify-center',
        'px-2 py-1 rounded-full',
        'bg-gradient-to-r from-purple-900/60 via-purple-800/40 to-pink-900/60',
        'backdrop-blur-xl',
        'border border-white/[0.08]',
        'shadow-[0_4px_24px_rgba(0,0,0,0.3)]',
        'supports-[backdrop-filter]:bg-gradient-to-r',
      )}
      aria-label="工作流步骤"
    >
      {steps.map((step) => {
        const Icon = step.icon;
        const isCurrent = step.key === activeTab;
        const isDisabled = step.key === 'production';

        if (isDisabled) {
          return (
            <span
              key={step.key}
              className="flex items-center gap-1.5 px-5 py-1.5 rounded-full text-sm text-white/30 cursor-not-allowed"
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{step.label}</span>
            </span>
          );
        }

        return (
          <button
            key={step.key}
            type="button"
            onClick={() => setActiveTab(step.key as WorkspaceTab)}
            className={cn(
              'flex items-center gap-1.5 px-5 py-1.5 rounded-full text-sm font-medium transition-all',
              isCurrent
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-white/60 hover:text-white/80 hover:bg-white/5',
            )}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
