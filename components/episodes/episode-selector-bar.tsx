'use client';

import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid } from 'lucide-react';
import type { Episode } from '@/components/episodes/types';

interface EpisodeSelectorBarProps {
  episodes: Episode[];
  selectedEpisodeId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
}

export function EpisodeSelectorBar({
  episodes,
  selectedEpisodeId,
  onSelect,
  onAdd,
}: EpisodeSelectorBarProps) {
  return (
    <div className="h-24 border-t border-white/[0.05] bg-card/40 backdrop-blur-md flex items-center px-4 gap-4 shrink-0">
      <Button
        variant={selectedEpisodeId === null ? 'secondary' : 'outline'}
        className={cn(
          'h-16 w-16 flex flex-col gap-1 rounded-xl border-2 transition-all flex-shrink-0',
          selectedEpisodeId === null
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-white/[0.04] text-muted-foreground hover:bg-card/40'
        )}
        onClick={() => onSelect(null)}
      >
        <LayoutGrid className="h-6 w-6" />
        <span className="text-[10px]">全部</span>
      </Button>

      <div className="w-px h-12 bg-border/50 flex-shrink-0" />

      <ScrollArea className="flex-1">
        <div className="flex gap-3 pb-4 pt-1 px-1">
          {episodes.map((ep) => (
            <button
              key={ep.id}
              type="button"
              className={cn(
                'relative cursor-pointer transition-all duration-200 select-none',
                'flex flex-col items-center justify-center gap-1',
                'h-16 w-28 rounded-xl border-2 bg-card/40 hover:bg-card/65 flex-shrink-0',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                selectedEpisodeId === ep.id
                  ? 'border-primary shadow-md bg-primary/5'
                  : 'border-white/[0.04] hover:border-white/[0.1]'
              )}
              onClick={() => onSelect(ep.id)}
            >
              <span
                className={cn(
                  'text-lg font-bold',
                  selectedEpisodeId === ep.id ? 'text-primary' : 'text-foreground'
                )}
              >
                EP {ep.orderNum}
              </span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[90%] px-2">
                {ep.title || '未命名'}
              </span>
            </button>
          ))}

          <Button
            variant="outline"
            className="h-16 w-16 rounded-xl border-dashed border-2 hover:border-primary/50 hover:text-primary flex-shrink-0"
            onClick={onAdd}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
