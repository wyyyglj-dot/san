'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles } from 'lucide-react';
import type { SafeImageChannel, SafeImageModel } from '@/types';

interface CreationToolbarProps {
  channels: SafeImageChannel[];
  currentModel?: SafeImageModel;
  selectedChannelId: string;
  onChannelChange: (id: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (r: string) => void;
  availableRatios: string[];
  imageSize: string;
  onImageSizeChange: (s: string) => void;
  availableSizes: string[];
  count: number;
  onCountChange: (n: number) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  className?: string;
}

export function CreationToolbar({
  channels,
  selectedChannelId,
  onChannelChange,
  aspectRatio,
  onAspectRatioChange,
  availableRatios,
  imageSize,
  onImageSizeChange,
  availableSizes,
  count,
  onCountChange,
  prompt,
  onPromptChange,
  onSubmit,
  isSubmitting,
  className,
}: CreationToolbarProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Settings Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Channel Selector */}
        <Select value={selectedChannelId} onValueChange={onChannelChange}>
          <SelectTrigger className="w-auto min-w-[120px] h-8 text-xs bg-card/40 border-white/[0.06]">
            <SelectValue placeholder="选择渠道" />
          </SelectTrigger>
          <SelectContent>
            {channels.map(c => (
              <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-px h-4 bg-border/40 shrink-0" />

        {/* Aspect Ratio Select */}
        <Select value={aspectRatio} onValueChange={onAspectRatioChange}>
          <SelectTrigger className="w-auto min-w-[80px] h-8 text-xs bg-card/40 border-white/[0.06]">
            <SelectValue placeholder="比例" />
          </SelectTrigger>
          <SelectContent>
            {availableRatios.map(r => (
              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {availableSizes.length > 0 && (
          <>
            <div className="w-px h-4 bg-border/40 shrink-0" />
            {/* Resolution Select */}
            <Select value={imageSize} onValueChange={onImageSizeChange}>
              <SelectTrigger className="w-auto min-w-[80px] h-8 text-xs bg-card/40 border-white/[0.06]">
                <SelectValue placeholder="分辨率" />
              </SelectTrigger>
              <SelectContent>
                {availableSizes.map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <div className="w-px h-4 bg-border/40 shrink-0" />

        {/* Count Select */}
        <Select value={String(count)} onValueChange={v => onCountChange(Number(v))}>
          <SelectTrigger className="w-auto min-w-[70px] h-8 text-xs bg-card/40 border-white/[0.06]">
            <SelectValue placeholder="数量" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4].map(n => (
              <SelectItem key={n} value={String(n)} className="text-xs">{n} 张</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Prompt Input */}
      <textarea
        value={prompt}
        onChange={e => onPromptChange(e.target.value)}
        placeholder="输入绘图描述词..."
        className="w-full min-h-[80px] px-3 py-2 bg-card/60 border border-white/[0.06] rounded-lg text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
      />

      {/* Submit Row */}
      <div className="flex justify-end gap-2">
        <Button onClick={onSubmit} disabled={isSubmitting || !prompt.trim()} className="gap-2">
          {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          生成 {count > 1 ? `(${count}张)` : ''}
        </Button>
      </div>
    </div>
  );
}
