'use client';

import { Image as ImageIcon, Video, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaType } from './types';

interface CreateHeaderProps {
  mediaType: MediaType;
  onMediaTypeChange: (type: MediaType) => void;
  dailyLimit: number;
  dailyCount: number;
  isLimitReached: boolean;
  modelsLoaded: boolean;
  hasNoChannels: boolean;
}

export function CreateHeader({
  mediaType,
  onMediaTypeChange,
  dailyLimit,
  dailyCount,
  isLimitReached,
  modelsLoaded,
  hasNoChannels,
}: CreateHeaderProps) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-light text-foreground">AI 创作</h1>
          <div className="flex items-center bg-card/40 border border-white/[0.08] rounded-full p-0.5">
            <button
              onClick={() => onMediaTypeChange('image')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                mediaType === 'image'
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground/70'
              )}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>图片</span>
            </button>
            <button
              onClick={() => onMediaTypeChange('video')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                mediaType === 'video'
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground/70'
              )}
            >
              <Video className="w-3.5 h-3.5" />
              <span>视频</span>
            </button>
          </div>
        </div>
        {dailyLimit > 0 && (
          <div className={cn(
            "px-4 py-2 rounded-xl border text-sm",
            isLimitReached
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-card/40 border-white/[0.06] text-foreground/45"
          )}>
            今日: {dailyCount} / {dailyLimit}
          </div>
        )}
      </div>

      {modelsLoaded && hasNoChannels && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3 mb-4 shrink-0">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-200">
            {mediaType === 'image' ? '所有图像生成渠道已被管理员禁用' : '视频生成功能已被管理员禁用或您没有访问权限'}
          </p>
        </div>
      )}
      {isLimitReached && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 mb-4 shrink-0">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">
            今日{mediaType === 'image' ? '图像' : '视频'}生成次数已达上限，请明天再试
          </p>
        </div>
      )}
    </>
  );
}