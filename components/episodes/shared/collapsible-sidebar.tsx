'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, PanelLeft, PanelRight } from 'lucide-react';

interface CollapsibleSidebarProps {
  side: 'left' | 'right';
  isOpen: boolean;
  onToggle: () => void;
  width?: string;
  collapsedWidth?: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  headerActions?: React.ReactNode;
}

export function CollapsibleSidebar({
  side,
  isOpen,
  onToggle,
  width = '250px',
  collapsedWidth = '60px',
  children,
  className,
  title,
  headerActions,
}: CollapsibleSidebarProps) {
  const isLeft = side === 'left';

  return (
    <aside
      className={cn(
        'relative flex flex-col border-white/[0.05] bg-card/55 backdrop-blur-md transition-[width] duration-300 ease-in-out shrink-0 overflow-hidden h-full',
        isLeft ? 'border-r' : 'border-l',
        className
      )}
      style={{ width: isOpen ? width : collapsedWidth }}
    >
      <div className="flex h-12 items-center justify-between px-2 border-b border-white/[0.04] shrink-0">
        {isOpen ? (
          <>
            <div className="flex items-center gap-2 overflow-hidden px-2">
              <span className="font-semibold text-sm truncate">{title}</span>
            </div>
            <div className="flex items-center gap-1">
              {headerActions}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={onToggle}
                aria-expanded={true}
                aria-label={isLeft ? '收起左侧栏' : '收起右侧栏'}
              >
                {isLeft ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex w-full flex-col items-center gap-4 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onToggle}
              title={title}
              aria-expanded={false}
              aria-label={isLeft ? '展开左侧栏' : '展开右侧栏'}
            >
              {isLeft ? <PanelLeft className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      <div className={cn('flex-1 overflow-hidden', !isOpen && 'invisible')}>
        {children}
      </div>
    </aside>
  );
}
