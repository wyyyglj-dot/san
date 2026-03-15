'use client';
/* eslint-disable @next/next/no-img-element */

import { Palette, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VIDEO_STYLES } from './types';

export interface VideoStyleSelectorProps {
  selectedStyle: string | null;
  onStyleChange: (style: string | null) => void;
  showStylePanel: boolean;
  onShowStylePanelChange: (show: boolean) => void;
}

export function VideoStyleSelector({
  selectedStyle,
  onStyleChange,
  showStylePanel,
  onShowStylePanelChange,
}: VideoStyleSelectorProps) {
  return (
    <div className="relative">
      <button
        onClick={() => onShowStylePanelChange(!showStylePanel)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 bg-card/40 border border-white/[0.06] rounded-lg text-xs transition-all hover:bg-card/60',
          selectedStyle ? 'text-sky-400' : 'text-foreground'
        )}
      >
        <Palette className="w-3 h-3" />
        <span>{selectedStyle ? VIDEO_STYLES.find(s => s.id === selectedStyle)?.name : '风格'}</span>
        <ChevronDown className="w-3 h-3 text-foreground/40" />
      </button>
      {showStylePanel && (
        <div className="absolute bottom-full left-0 mb-2 p-4 w-[420px] bg-card border border-white/[0.06] rounded-lg shadow-lg z-20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-foreground/40">选择风格</span>
            {selectedStyle && (
              <button onClick={() => { onStyleChange(null); onShowStylePanelChange(false); }} className="text-xs text-foreground/30 hover:text-foreground/55">清除</button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {VIDEO_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => { onStyleChange(style.id); onShowStylePanelChange(false); }}
                className={cn(
                  'relative w-24 h-16 rounded-lg overflow-hidden border-2 transition-all',
                  selectedStyle === style.id
                    ? 'border-sky-400 ring-2 ring-sky-400/30'
                    : 'border-white/[0.06] hover:border-white/[0.1]'
                )}
              >
                <img src={style.image} alt={style.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-end justify-center pb-1 bg-gradient-to-t from-black/80 to-transparent">
                  <span className="text-xs font-medium text-white">{style.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
