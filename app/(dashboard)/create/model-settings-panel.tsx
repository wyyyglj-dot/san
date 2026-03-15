'use client';

import { Sparkles, Loader2, AlertCircle, Dices, Info, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { MediaType } from './types';
import { VideoStyleSelector } from './video-style-selector';
import type {
  SafeImageModel, SafeImageChannel, SafeVideoModel, SafeVideoChannel,
} from '@/types';

export interface ModelSettingsPanelProps {
  mediaType: MediaType;
  imageChannels: SafeImageChannel[];
  selectedImageChannelId: string;
  onImageChannelChange: (value: string) => void;
  currentImageModel: SafeImageModel | null;
  imageAspectRatio: string;
  onImageAspectRatioChange: (value: string) => void;
  aggregatedImageSizes: string[];
  imageSize: string;
  onImageSizeChange: (value: string) => void;
  videoChannels: SafeVideoChannel[];
  selectedVideoChannelId: string;
  onVideoChannelChange: (value: string) => void;
  currentVideoModel: SafeVideoModel | null;
  videoDuration: string;
  onVideoDurationChange: (value: string) => void;
  videoAspectRatio: string;
  onVideoAspectRatioChange: (value: string) => void;
  selectedStyle: string | null;
  onStyleChange: (value: string | null) => void;
  showStylePanel: boolean;
  onShowStylePanelChange: (value: boolean) => void;
  keepPrompt: boolean;
  onKeepPromptChange: (value: boolean) => void;
  submitting: boolean;
  compressing: boolean;
  onSubmit: (gachaCount?: number) => void;
  error: string | null;
}

export function ModelSettingsPanel({
  mediaType,
  imageChannels, selectedImageChannelId, onImageChannelChange,
  currentImageModel, imageAspectRatio, onImageAspectRatioChange,
  aggregatedImageSizes, imageSize, onImageSizeChange,
  videoChannels, selectedVideoChannelId, onVideoChannelChange,
  currentVideoModel, videoDuration, onVideoDurationChange,
  videoAspectRatio, onVideoAspectRatioChange,
  selectedStyle, onStyleChange, showStylePanel, onShowStylePanelChange,
  keepPrompt, onKeepPromptChange, submitting, compressing, onSubmit, error,
}: ModelSettingsPanelProps) {
  return (
    <>
      {/* Toolbar Row */}
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* IMAGE MODE: Channel selector */}
          {mediaType === 'image' && imageChannels.length > 0 && (
            <Select value={selectedImageChannelId} onValueChange={onImageChannelChange}>
              <SelectTrigger aria-label="图片渠道" className="h-auto w-auto gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border bg-card/40 border-white/[0.06] hover:bg-card/60 text-foreground focus:ring-ring/30 transition-colors [&_svg]:w-3 [&_svg]:h-3 [&_svg]:opacity-50">
                <SelectValue placeholder="选择渠道" />
              </SelectTrigger>
              <SelectContent side="top">
                {imageChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* IMAGE MODE: Aspect ratio pills */}
          {mediaType === 'image' && currentImageModel && (
            <>
              <div className="w-px h-4 bg-white/[0.05] shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                {currentImageModel.aspectRatios.slice(0, 3).map((r) => (
                  <button
                    key={r}
                    onClick={() => onImageAspectRatioChange(r)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                      imageAspectRatio === r
                        ? 'bg-foreground text-background border-transparent'
                        : 'bg-card/40 border-white/[0.06] hover:bg-card/60'
                    )}
                  >
                    {r}
                  </button>
                ))}
                {currentImageModel.aspectRatios.length > 3 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                          currentImageModel.aspectRatios.slice(3).includes(imageAspectRatio)
                            ? 'bg-foreground text-background border-transparent'
                            : 'bg-card/40 border-white/[0.06] hover:bg-card/60'
                        )}
                      >
                        {currentImageModel.aspectRatios.slice(3).includes(imageAspectRatio) ? imageAspectRatio : '更多'}
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top">
                      {currentImageModel.aspectRatios.slice(3).map((r) => (
                        <DropdownMenuItem key={r} onClick={() => onImageAspectRatioChange(r)} className={cn(imageAspectRatio === r && 'bg-accent')}>
                          {r}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </>
          )}

          {/* IMAGE MODE: Resolution pills (aggregated from all channel models) */}
          {mediaType === 'image' && aggregatedImageSizes.length > 0 && (
            <>
              <div className="w-px h-4 bg-white/[0.05] shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                {aggregatedImageSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => onImageSizeChange(size)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                      imageSize === size
                        ? 'bg-foreground text-background border-transparent'
                        : 'bg-card/40 border-white/[0.06] hover:bg-card/60'
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* VIDEO MODE: Channel selector */}
          {mediaType === 'video' && videoChannels.length > 0 && (
            <Select value={selectedVideoChannelId} onValueChange={onVideoChannelChange}>
              <SelectTrigger aria-label="视频渠道" className="h-auto w-auto gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border bg-card/40 border-white/[0.06] hover:bg-card/60 text-foreground focus:ring-ring/30 transition-colors [&_svg]:w-3 [&_svg]:h-3 [&_svg]:opacity-50">
                <SelectValue placeholder="选择渠道" />
              </SelectTrigger>
              <SelectContent side="top">
                {videoChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* VIDEO MODE: Duration selector */}
          {mediaType === 'video' && currentVideoModel && (
            <Select value={videoDuration} onValueChange={onVideoDurationChange}>
              <SelectTrigger aria-label="视频时长" className="h-auto w-auto gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border bg-card/40 border-white/[0.06] hover:bg-card/60 text-foreground focus:ring-ring/30 transition-colors [&_svg]:w-3 [&_svg]:h-3 [&_svg]:opacity-50">
                <SelectValue placeholder="时长" />
              </SelectTrigger>
              <SelectContent side="top">
                {currentVideoModel.durations.map((d) => (
                  <SelectItem key={d.value} value={d.value} className="text-xs">
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* VIDEO MODE: Aspect ratio selector */}
          {mediaType === 'video' && currentVideoModel && (
            <Select value={videoAspectRatio} onValueChange={onVideoAspectRatioChange}>
              <SelectTrigger aria-label="视频比例" className="h-auto w-auto gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border bg-card/40 border-white/[0.06] hover:bg-card/60 text-foreground focus:ring-ring/30 transition-colors [&_svg]:w-3 [&_svg]:h-3 [&_svg]:opacity-50">
                <SelectValue placeholder="比例" />
              </SelectTrigger>
              <SelectContent side="top">
                {currentVideoModel.aspectRatios.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="text-xs">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* VIDEO MODE: Style selector */}
          {mediaType === 'video' && currentVideoModel?.features.supportStyles && (
            <VideoStyleSelector
              selectedStyle={selectedStyle}
              onStyleChange={onStyleChange}
              showStylePanel={showStylePanel}
              onShowStylePanelChange={onShowStylePanelChange}
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-foreground/55 hover:text-foreground transition-colors">
            <input
              type="checkbox"
              checked={keepPrompt}
              onChange={(e) => onKeepPromptChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-white/[0.06] bg-card/40 accent-sky-400 cursor-pointer"
            />
            <span>保留</span>
          </label>

          <div className="relative group">
            <button
              onClick={() => onSubmit(3)}
              disabled={submitting || compressing}
              title="抽卡模式"
              aria-label="抽卡模式"
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-lg transition-all',
                submitting || compressing
                  ? 'bg-card/40 text-foreground/30 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90'
              )}
            >
              <Dices className="w-4 h-4" />
            </button>
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-20">
              <div className="bg-card/80 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-foreground/65 whitespace-nowrap shadow-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <Info className="w-3 h-3 text-amber-300" />
                  <span className="font-medium text-foreground">抽卡模式</span>
                </div>
                <p>一次性提交 3 个相同参数的任务</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSubmit()}
            disabled={submitting || compressing}
            className={cn(
              'flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-all',
              submitting || compressing
                ? 'bg-card/60 text-foreground/40 cursor-not-allowed'
                : 'bg-gradient-to-r from-sky-500 to-emerald-500 text-white hover:opacity-90'
            )}
          >
            {submitting || compressing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{compressing ? '处理图片中...' : '提交中...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>立即生成</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
    </>
  );
}
