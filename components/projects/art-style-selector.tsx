'use client';

import { Plus, Ban, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArtStyleCard } from './art-style-card';
import type { SafeArtStyle } from '@/types';

interface ArtStyleSelectorProps {
  styles: SafeArtStyle[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
  isLoading?: boolean;
  isAdmin?: boolean;
  onAddStyle?: () => void;
}

export function ArtStyleSelector({
  styles,
  selectedSlug,
  onSelect,
  isLoading,
  isAdmin,
  onAddStyle,
}: ArtStyleSelectorProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">画风选择</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-[4/3] rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">画风选择</h3>
        {isAdmin && onAddStyle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs hover:bg-brand/10 hover:text-brand"
            onClick={onAddStyle}
          >
            <Plus className="w-3 h-3 mr-1" />
            添加画风
          </Button>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label="画风选择"
        className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1"
      >
        {/* "No Style" Option */}
        <button
          type="button"
          role="radio"
          aria-checked={!selectedSlug}
          onClick={() => onSelect('')}
          className={cn(
            'relative flex flex-col items-center justify-center text-center rounded-xl border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand/20 aspect-[4/3]',
            !selectedSlug
              ? 'border-brand bg-brand/5 text-brand'
              : 'border-white/[0.04] bg-card hover:border-brand/50 text-muted-foreground'
          )}
        >
          <Ban className="w-8 h-8 mb-2 opacity-50" />
          <div className="font-medium text-sm">不指定</div>
          <div className="text-xs opacity-70">使用模型默认风格</div>
          {!selectedSlug && (
            <div className="absolute top-2 right-2 bg-brand text-white rounded-full p-0.5">
              <Check className="w-3 h-3" />
            </div>
          )}
        </button>

        {styles.map((style) => (
          <ArtStyleCard
            key={style.id}
            style={style}
            isSelected={selectedSlug === style.slug}
            onSelect={() => onSelect(style.slug)}
          />
        ))}

        {styles.length === 0 && (
          <div className="col-span-2 lg:col-span-3 py-8 text-center text-muted-foreground">
            <p className="text-sm">暂无可用画风</p>
            {isAdmin && (
              <p className="text-xs mt-1">点击上方&quot;添加画风&quot;按钮创建</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
