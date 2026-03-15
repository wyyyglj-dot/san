'use client';

import { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  SafeImageModel,
  SafeVideoModel,
  SafeLlmModel,
  SafeImageChannel,
  SafeVideoChannel,
} from '@/types';

export interface GenerationPreferences {
  defaultImageModelId: string;
  defaultVideoModelId: string;
  defaultTextModelId: string;
  defaultStyle: string;
  defaultVideoRatio: string;
  defaultEra: string;
}

interface GenerationPreferencesFormProps {
  preferences: GenerationPreferences;
  onChange: (preferences: GenerationPreferences) => void;
  imageModels: SafeImageModel[];
  imageChannels: SafeImageChannel[];
  videoModels: SafeVideoModel[];
  videoChannels: SafeVideoChannel[];
  textModels: SafeLlmModel[];
  isLoading?: boolean;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
}

export function GenerationPreferencesForm({
  preferences,
  onChange,
  imageModels,
  imageChannels,
  videoModels,
  videoChannels,
  textModels,
  isLoading,
  aspectRatio,
  onAspectRatioChange,
}: GenerationPreferencesFormProps) {
  const handleChange = (key: keyof GenerationPreferences, value: string) => {
    onChange({ ...preferences, [key]: value });
  };

  const [selectedImageChannelId, setSelectedImageChannelId] = useState<string>('');
  const [selectedVideoChannelId, setSelectedVideoChannelId] = useState<string>('');

  // Reverse-lookup image channel from selected model on mount / external change
  useEffect(() => {
    if (preferences.defaultImageModelId) {
      const model = imageModels.find((m) => m.id === preferences.defaultImageModelId);
      if (model && model.channelId !== selectedImageChannelId) {
        setSelectedImageChannelId(model.channelId);
      }
    } else if (!selectedImageChannelId && imageChannels.length > 0) {
      setSelectedImageChannelId(imageChannels[0].id);
    }
  }, [preferences.defaultImageModelId, imageModels, imageChannels]);

  // Reverse-lookup video channel from selected model on mount / external change
  useEffect(() => {
    if (preferences.defaultVideoModelId) {
      const model = videoModels.find((m) => m.id === preferences.defaultVideoModelId);
      if (model && model.channelId !== selectedVideoChannelId) {
        setSelectedVideoChannelId(model.channelId);
      }
    } else if (!selectedVideoChannelId && videoChannels.length > 0) {
      setSelectedVideoChannelId(videoChannels[0].id);
    }
  }, [preferences.defaultVideoModelId, videoModels, videoChannels]);

  const filteredImageModels = useMemo(
    () => imageModels.filter((m) => m.channelId === selectedImageChannelId),
    [imageModels, selectedImageChannelId]
  );

  const filteredVideoModels = useMemo(
    () => videoModels.filter((m) => m.channelId === selectedVideoChannelId),
    [videoModels, selectedVideoChannelId]
  );

  // Auto-match image model when channel is selected but model is empty or mismatched
  useEffect(() => {
    if (!selectedImageChannelId) return;
    const currentModel = imageModels.find((m) => m.id === preferences.defaultImageModelId);
    if (currentModel && currentModel.channelId === selectedImageChannelId) return;
    const firstModel = imageModels.find((m) => m.channelId === selectedImageChannelId);
    const newId = firstModel?.id ?? '';
    if (newId !== preferences.defaultImageModelId) {
      onChange({ ...preferences, defaultImageModelId: newId });
    }
  }, [selectedImageChannelId, imageModels]);

  // Auto-match video model when channel is selected but model is empty or mismatched
  useEffect(() => {
    if (!selectedVideoChannelId) return;
    const currentModel = videoModels.find((m) => m.id === preferences.defaultVideoModelId);
    if (currentModel && currentModel.channelId === selectedVideoChannelId) return;
    const firstModel = videoModels.find((m) => m.channelId === selectedVideoChannelId);
    const newId = firstModel?.id ?? '';
    if (newId !== preferences.defaultVideoModelId) {
      onChange({ ...preferences, defaultVideoModelId: newId });
    }
  }, [selectedVideoChannelId, videoModels]);

  const handleImageChannelChange = (channelId: string) => {
    setSelectedImageChannelId(channelId);
    const firstModel = imageModels.find((m) => m.channelId === channelId);
    handleChange('defaultImageModelId', firstModel?.id ?? '');
  };

  const handleVideoChannelChange = (channelId: string) => {
    setSelectedVideoChannelId(channelId);
    const firstModel = videoModels.find((m) => m.channelId === channelId);
    handleChange('defaultVideoModelId', firstModel?.id ?? '');
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">生成配置</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>图片渠道</Label>
          <Select
            value={selectedImageChannelId}
            onValueChange={handleImageChannelChange}
            disabled={isLoading}
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
        </div>

        <div className="space-y-2">
          <Label>视频渠道</Label>
          <Select
            value={selectedVideoChannelId}
            onValueChange={handleVideoChannelChange}
            disabled={isLoading}
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
        </div>

        <div className="space-y-2">
          <Label>文字模型</Label>
          <Select
            value={preferences.defaultTextModelId || ''}
            onValueChange={(v) => handleChange('defaultTextModelId', v)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="请选择文字模型" />
            </SelectTrigger>
            <SelectContent>
              {textModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>影片比例</Label>
          <Select value={aspectRatio} onValueChange={onAspectRatioChange} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="选择比例" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9">16:9 (横屏)</SelectItem>
              <SelectItem value="9:16">9:16 (竖屏)</SelectItem>
              <SelectItem value="1:1">1:1 (方形)</SelectItem>
              <SelectItem value="2.35:1">2.35:1 (电影感)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}