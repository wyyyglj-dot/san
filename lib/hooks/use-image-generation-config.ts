'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { SafeImageModel, SafeImageChannel } from '@/types';

export function useImageGenerationConfig() {
  const [channels, setChannels] = useState<SafeImageChannel[]>([]);
  const [models, setModels] = useState<SafeImageModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [count, setCount] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/image-models');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const fetchedModels: SafeImageModel[] = data.data?.models || [];
        const fetchedChannels: SafeImageChannel[] = data.data?.channels || [];

        setModels(fetchedModels);
        setChannels(fetchedChannels);

        if (fetchedChannels.length > 0) {
          setSelectedChannelId(fetchedChannels[0].id);
          const firstModels = fetchedModels.filter(m => m.channelId === fetchedChannels[0].id);
          if (firstModels.length > 0) {
            setAspectRatio(firstModels[0].defaultAspectRatio || '1:1');
            if (firstModels[0].defaultImageSize) setImageSize(firstModels[0].defaultImageSize);
          }
        }
      } catch (err) {
        console.error('Failed to load image models:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const currentChannel = useMemo(
    () => channels.find(c => c.id === selectedChannelId) || channels[0],
    [channels, selectedChannelId]
  );

  const channelModels = useMemo(
    () => currentChannel ? models.filter(m => m.channelId === currentChannel.id) : [],
    [models, currentChannel]
  );

  const currentModel = useMemo(
    () => channelModels.find(m => m.features.textToImage) || channelModels[0],
    [channelModels]
  );

  const availableRatios = useMemo(
    () => currentModel?.aspectRatios || ['1:1', '16:9', '9:16'],
    [currentModel]
  );

  const availableSizes = useMemo(() => {
    const sizesSet = new Set<string>();
    for (const m of channelModels) {
      if (m.features.imageSize && m.imageSizes) {
        for (const s of m.imageSizes) sizesSet.add(s);
      }
    }
    const order = ['1K', '2K', '3K', '4K'];
    return Array.from(sizesSet).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [channelModels]);

  useEffect(() => {
    if (!currentModel) return;
    if (!currentModel.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(currentModel.defaultAspectRatio || currentModel.aspectRatios[0] || '1:1');
    }
    if (availableSizes.length > 0 && !availableSizes.includes(imageSize)) {
      setImageSize(currentModel.defaultImageSize || availableSizes[0] || '1K');
    }
  }, [currentModel]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    setCount(1);
    if (currentModel) {
      setAspectRatio(currentModel.defaultAspectRatio || '1:1');
      if (currentModel.defaultImageSize) setImageSize(currentModel.defaultImageSize);
    }
  }, [currentModel]);

  return {
    channels,
    models: channelModels,
    currentChannel,
    currentModel,
    selectedChannelId,
    setSelectedChannelId,
    aspectRatio,
    setAspectRatio,
    imageSize,
    setImageSize,
    count,
    setCount,
    availableRatios,
    availableSizes,
    isLoading,
    reset,
  };
}
