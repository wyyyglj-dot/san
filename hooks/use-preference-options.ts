'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SafeImageModel, SafeVideoModel, SafeLlmModel, SafeArtStyle, SafeImageChannel, SafeVideoChannel } from '@/types';

export interface PreferenceOptions {
  imageModels: SafeImageModel[];
  imageChannels: SafeImageChannel[];
  videoModels: SafeVideoModel[];
  videoChannels: SafeVideoChannel[];
  textModels: SafeLlmModel[];
  styles: SafeArtStyle[];
  videoRatios: { value: string; label: string; description?: string }[];
}

interface UsePreferenceOptionsConfig {
  enabled?: boolean;
}

interface UsePreferenceOptionsResult {
  options: PreferenceOptions | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePreferenceOptions(
  config: UsePreferenceOptionsConfig = {},
): UsePreferenceOptionsResult {
  const { enabled = true } = config;
  const [options, setOptions] = useState<PreferenceOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/project-preferences/options');
      if (!res.ok) {
        throw new Error('获取偏好选项失败');
      }
      const data = await res.json();
      setOptions(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取偏好选项失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const doFetch = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/project-preferences/options');
        if (!res.ok) {
          throw new Error('获取偏好选项失败');
        }
        const data = await res.json();
        if (!cancelled) {
          setOptions(data.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '获取偏好选项失败');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    doFetch();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { options, isLoading, error, refetch: fetchOptions };
}
