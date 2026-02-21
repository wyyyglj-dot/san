'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Wand2, LayoutTemplate } from 'lucide-react';

interface CreationModeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CreationModeSelector({
  value,
  onChange,
  className,
}: CreationModeSelectorProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-4', className)}>
      <button
        type="button"
        onClick={() => onChange('ai_merge')}
        className={cn(
          'border p-4 rounded-lg text-left transition-all relative overflow-hidden group hover:shadow-sm',
          value === 'ai_merge'
            ? 'border-brand/50 bg-brand/5 ring-1 ring-brand/20'
            : 'border-white/[0.06] hover:bg-muted/30 hover:border-white/[0.1]'
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className={cn(
              'p-1.5 rounded-md',
              value === 'ai_merge'
                ? 'bg-brand/10 text-brand'
                : 'bg-muted text-muted-foreground group-hover:text-foreground'
            )}
          >
            <Wand2 className="w-4 h-4" />
          </div>
          <div
            className={cn(
              'font-medium transition-colors',
              value === 'ai_merge' ? 'text-brand' : 'text-foreground'
            )}
          >
            AI 合并模式
          </div>
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed pl-1">
          自动生成分镜并合并视频，适合快速创作
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange('default')}
        className={cn(
          'border p-4 rounded-lg text-left transition-all relative overflow-hidden group hover:shadow-sm',
          value === 'default'
            ? 'border-brand/50 bg-brand/5 ring-1 ring-brand/20'
            : 'border-white/[0.06] hover:bg-muted/30 hover:border-white/[0.1]'
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className={cn(
              'p-1.5 rounded-md',
              value === 'default'
                ? 'bg-brand/10 text-brand'
                : 'bg-muted text-muted-foreground group-hover:text-foreground'
            )}
          >
            <LayoutTemplate className="w-4 h-4" />
          </div>
          <div
            className={cn(
              'font-medium transition-colors',
              value === 'default' ? 'text-brand' : 'text-foreground'
            )}
          >
            默认分镜模式
          </div>
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed pl-1">
          手动控制每个分镜细节，适合精细化创作
        </div>
      </button>
    </div>
  );
}
