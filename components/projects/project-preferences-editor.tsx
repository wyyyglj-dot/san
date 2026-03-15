'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArtStyleSelector } from './art-style-selector';
import type { GenerationPreferences } from './generation-preferences-form';
import type { ProjectPreferences } from '@/lib/db-comic';
import type { PreferenceOptions } from '@/hooks/use-preference-options';

const ERA_OPTIONS = [
  { value: 'modern', label: '现代都市' },
  { value: 'ancient', label: '古代中国' },
  { value: 'medieval', label: '中世纪' },
] as const;

export const DEFAULT_PROJECT_PREFERENCES: GenerationPreferences = {
  defaultImageModelId: '',
  defaultVideoModelId: '',
  defaultTextModelId: '',
  defaultStyle: '',
  defaultVideoRatio: '16:9',
  defaultEra: '',
};

interface PreferenceValidationResult {
  canSave: boolean;
  issues: string[];
  imageModelAvailable: boolean;
  videoModelAvailable: boolean;
  textModelAvailable: boolean;
}

interface ProjectPreferencesEditorProps {
  preferences: GenerationPreferences;
  onChange: (preferences: GenerationPreferences) => void;
  options: PreferenceOptions | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  layout?: 'split' | 'stacked';
  showVideoRatio?: boolean;
  onVideoRatioChange?: (value: string) => void;
  isAdmin?: boolean;
  onAddStyle?: () => void;
}

export function toGenerationPreferences(
  preferences?: Partial<ProjectPreferences> | null,
): GenerationPreferences {
  return {
    ...DEFAULT_PROJECT_PREFERENCES,
    defaultImageModelId: preferences?.defaultImageModelId ?? '',
    defaultVideoModelId: preferences?.defaultVideoModelId ?? '',
    defaultTextModelId: preferences?.defaultTextModelId ?? '',
    defaultStyle: preferences?.defaultStyle ?? '',
    defaultVideoRatio:
      typeof preferences?.defaultVideoRatio === 'string' && preferences.defaultVideoRatio
        ? preferences.defaultVideoRatio
        : DEFAULT_PROJECT_PREFERENCES.defaultVideoRatio,
    defaultEra: preferences?.defaultEra ?? '',
  };
}

export function validateProjectPreferences(
  preferences: GenerationPreferences,
  options: PreferenceOptions | null,
): PreferenceValidationResult {
  const imageModelAvailable = Boolean(
    preferences.defaultImageModelId &&
      options?.imageModels.some((model) => model.id === preferences.defaultImageModelId),
  );
  const videoModelAvailable = Boolean(
    preferences.defaultVideoModelId &&
      options?.videoModels.some((model) => model.id === preferences.defaultVideoModelId),
  );
  const textModelAvailable = Boolean(
    preferences.defaultTextModelId &&
      options?.textModels.some((model) => model.id === preferences.defaultTextModelId),
  );

  const issues: string[] = [];

  if (!options) {
    issues.push('偏好选项尚未加载完成');
  } else {
    if (options.imageModels.length === 0) {
      issues.push('当前没有可用的图片模型');
    } else if (!imageModelAvailable) {
      issues.push(
        preferences.defaultImageModelId
          ? '当前图片模型不可用，请重新选择'
          : '请选择图片模型',
      );
    }

    if (options.videoModels.length === 0) {
      issues.push('当前没有可用的视频模型');
    } else if (!videoModelAvailable) {
      issues.push(
        preferences.defaultVideoModelId
          ? '当前视频模型不可用，请重新选择'
          : '请选择视频模型',
      );
    }

    if (options.textModels.length === 0) {
      issues.push('当前没有可用的文字模型');
    } else if (!textModelAvailable) {
      issues.push(
        preferences.defaultTextModelId
          ? '当前文字模型不可用，请重新选择'
          : '请选择文字模型',
      );
    }
  }

  return {
    canSave: issues.length === 0,
    issues,
    imageModelAvailable,
    videoModelAvailable,
    textModelAvailable,
  };
}

export function arePreferencesEqual(
  left: GenerationPreferences,
  right: GenerationPreferences,
): boolean {
  return (
    left.defaultImageModelId === right.defaultImageModelId &&
    left.defaultVideoModelId === right.defaultVideoModelId &&
    left.defaultTextModelId === right.defaultTextModelId &&
    left.defaultStyle === right.defaultStyle &&
    left.defaultEra === right.defaultEra &&
    left.defaultVideoRatio === right.defaultVideoRatio
  );
}

export function ProjectPreferencesEditor({
  preferences,
  onChange,
  options,
  isLoading,
  error,
  onRetry,
  layout = 'split',
  showVideoRatio,
  onVideoRatioChange,
  isAdmin,
  onAddStyle,
}: ProjectPreferencesEditorProps) {
  const [selectedImageChannelId, setSelectedImageChannelId] = useState('');
  const [selectedVideoChannelId, setSelectedVideoChannelId] = useState('');

  const imageChannels = useMemo(() => options?.imageChannels ?? [], [options]);
  const imageModels = useMemo(() => options?.imageModels ?? [], [options]);
  const videoChannels = useMemo(() => options?.videoChannels ?? [], [options]);
  const videoModels = useMemo(() => options?.videoModels ?? [], [options]);
  const textModels = useMemo(() => options?.textModels ?? [], [options]);
  const styles = useMemo(() => options?.styles ?? [], [options]);
  const videoRatios = useMemo(() => options?.videoRatios ?? [], [options]);

  useEffect(() => {
    if (!preferences.defaultImageModelId) return;

    const model = imageModels.find((item) => item.id === preferences.defaultImageModelId);
    if (model && model.channelId !== selectedImageChannelId) {
      setSelectedImageChannelId(model.channelId);
    }
  }, [imageModels, preferences.defaultImageModelId, selectedImageChannelId]);

  useEffect(() => {
    if (!preferences.defaultVideoModelId) return;

    const model = videoModels.find((item) => item.id === preferences.defaultVideoModelId);
    if (model && model.channelId !== selectedVideoChannelId) {
      setSelectedVideoChannelId(model.channelId);
    }
  }, [preferences.defaultVideoModelId, selectedVideoChannelId, videoModels]);

  const filteredImageModels = useMemo(
    () => imageModels.filter((model) => model.channelId === selectedImageChannelId),
    [imageModels, selectedImageChannelId],
  );

  const filteredVideoModels = useMemo(
    () => videoModels.filter((model) => model.channelId === selectedVideoChannelId),
    [selectedVideoChannelId, videoModels],
  );

  const validation = validateProjectPreferences(preferences, options);
  const editorLayoutClass =
    layout === 'stacked'
      ? 'grid grid-cols-1 gap-6'
      : 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]';
  const imageModelVisible = filteredImageModels.some(
    (model) => model.id === preferences.defaultImageModelId,
  );
  const videoModelVisible = filteredVideoModels.some(
    (model) => model.id === preferences.defaultVideoModelId,
  );

  const handlePreferenceChange = (key: keyof GenerationPreferences, value: string) => {
    onChange({ ...preferences, [key]: value });
  };

  const handleImageChannelChange = (channelId: string) => {
    setSelectedImageChannelId(channelId);
    const firstModel = imageModels.find((model) => model.channelId === channelId);
    onChange({
      ...preferences,
      defaultImageModelId: firstModel?.id ?? '',
    });
  };

  const handleVideoChannelChange = (channelId: string) => {
    setSelectedVideoChannelId(channelId);
    const firstModel = videoModels.find((model) => model.channelId === channelId);
    onChange({
      ...preferences,
      defaultVideoModelId: firstModel?.id ?? '',
    });
  };

  const renderNotice = (message: string, tone: 'warning' | 'error' = 'warning') => (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={
        tone === 'error'
          ? 'mt-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200'
          : 'mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100'
      }
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );

  if (error) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-medium">无法加载项目默认配置</p>
              <p className="mt-1 text-red-100/80">{error}</p>
            </div>
            {onRetry && (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                重试
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !options) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className={editorLayoutClass}>
          <div className="space-y-4">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="h-4 w-20 rounded bg-muted" />
                  <div className="h-10 rounded-xl bg-muted" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-10 rounded-xl bg-muted" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="aspect-[4/3] rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={editorLayoutClass}>
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-white/[0.05] bg-card/40 p-4">
            <div>
              <h3 className="text-sm font-medium text-foreground">生成默认配置</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                修改后将应用于当前项目的默认生成配置。
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>图片渠道</Label>
                <Select
                  value={selectedImageChannelId || undefined}
                  onValueChange={handleImageChannelChange}
                  disabled={isLoading || imageChannels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择图片渠道" />
                  </SelectTrigger>
                  <SelectContent>
                    {imageChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {imageChannels.length === 0 && renderNotice('当前没有可用的图片渠道', 'error')}
              </div>

              <div className="space-y-2">
                <Label>图片模型</Label>
                <Select
                  value={imageModelVisible ? preferences.defaultImageModelId : undefined}
                  onValueChange={(value) => handlePreferenceChange('defaultImageModelId', value)}
                  disabled={isLoading || !selectedImageChannelId || filteredImageModels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择图片模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredImageModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedImageChannelId && filteredImageModels.length === 0 &&
                  renderNotice('当前图片渠道下没有可用模型', 'error')}
                {preferences.defaultImageModelId && !validation.imageModelAvailable &&
                  renderNotice('当前已保存的图片模型不可用，请重新选择')}
              </div>

              <div className="space-y-2">
                <Label>视频渠道</Label>
                <Select
                  value={selectedVideoChannelId || undefined}
                  onValueChange={handleVideoChannelChange}
                  disabled={isLoading || videoChannels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择视频渠道" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {videoChannels.length === 0 && renderNotice('当前没有可用的视频渠道', 'error')}
              </div>

              <div className="space-y-2">
                <Label>视频模型</Label>
                <Select
                  value={videoModelVisible ? preferences.defaultVideoModelId : undefined}
                  onValueChange={(value) => handlePreferenceChange('defaultVideoModelId', value)}
                  disabled={isLoading || !selectedVideoChannelId || filteredVideoModels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择视频模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredVideoModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedVideoChannelId && filteredVideoModels.length === 0 &&
                  renderNotice('当前视频渠道下没有可用模型', 'error')}
                {preferences.defaultVideoModelId && !validation.videoModelAvailable &&
                  renderNotice('当前已保存的视频模型不可用，请重新选择')}
              </div>

              <div className="space-y-2">
                <Label>文字模型</Label>
                <Select
                  value={validation.textModelAvailable ? preferences.defaultTextModelId : undefined}
                  onValueChange={(value) => handlePreferenceChange('defaultTextModelId', value)}
                  disabled={isLoading || textModels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择文字模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {textModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {textModels.length === 0 && renderNotice('当前没有可用的文字模型', 'error')}
                {preferences.defaultTextModelId && !validation.textModelAvailable &&
                  renderNotice('当前已保存的文字模型不可用，请重新选择')}
              </div>

              {showVideoRatio && (
                <div className="space-y-2">
                  <Label>视频比例</Label>
                  <Select
                    value={preferences.defaultVideoRatio}
                    onValueChange={(value) => {
                      handlePreferenceChange('defaultVideoRatio', value);
                      onVideoRatioChange?.(value);
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择视频比例" />
                    </SelectTrigger>
                    <SelectContent>
                      {videoRatios.map((ratio) => (
                        <SelectItem key={ratio.value} value={ratio.value}>
                          {ratio.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {validation.issues.length > 0 && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium">保存前请处理以下问题</p>
                    <ul className="list-disc space-y-1 pl-4 text-xs text-amber-100/85">
                      {validation.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border border-white/[0.05] bg-card/40 p-4">
          <div className="space-y-2">
            <Label>时代</Label>
            <Select
              value={preferences.defaultEra || 'none'}
              onValueChange={(value) => handlePreferenceChange('defaultEra', value === 'none' ? '' : value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择时代" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不指定</SelectItem>
                {ERA_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArtStyleSelector
            styles={styles}
            selectedSlug={preferences.defaultStyle}
            onSelect={(slug) => handlePreferenceChange('defaultStyle', slug)}
            isLoading={isLoading}
            isAdmin={isAdmin}
            onAddStyle={onAddStyle}
          />
        </div>
      </div>
    </div>
  );
}
