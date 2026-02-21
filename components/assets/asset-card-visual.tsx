'use client';

import * as React from 'react';
import type { ProjectAssetType } from '@/lib/db-comic';
import { typeConfig } from '@/components/assets/asset-schema';
import { cn } from '@/lib/utils';

interface AssetCardVisualProps {
  name: string;
  type: ProjectAssetType;
  imageUrl: string | null;
  isSelected?: boolean;
  isDragOver?: boolean;
  /** 拖放高亮层（由容器注入），需自带 pointer-events-none */
  dragOverContent?: React.ReactNode;
  /** sm=侧栏(text-xs), md=中央区(text-sm) */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * 纯视觉卡片组件：渐变阴影 + 文字居中叠加。
 * 不含拖放逻辑，由外层容器负责事件处理。
 */
export function AssetCardVisual({
  name,
  type,
  imageUrl,
  isSelected,
  isDragOver,
  dragOverContent,
  size = 'md',
  className,
}: AssetCardVisualProps) {
  const config = typeConfig[type];
  const Icon = config.icon;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={cn(
        'group relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 transition-all',
        isDragOver
          ? 'border-primary ring-2 ring-primary/40 scale-[1.02]'
          : isSelected
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-transparent hover:border-white/20 bg-muted/20',
        className,
      )}
    >
      {/* 图片层 */}
      <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <Icon className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>
      {/* 渐变遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
      {/* 拖放高亮层（由容器注入） */}
      {isDragOver && dragOverContent}
      {/* 文字层 */}
      <div className="absolute bottom-0 left-0 w-full p-2.5 z-10 text-center pointer-events-none">
        <p className={cn(textSize, 'font-bold text-white truncate drop-shadow-md')}>
          {name}
        </p>
      </div>
    </div>
  );
}
