'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from '@/components/ui/toaster';
import { API } from '@/lib/api-endpoints';

interface UseAdminConfigOptions {
  endpoint?: string;
  successMessage?: string;
  errorMessage?: string;
}

interface UseAdminConfigResult<T> {
  config: T | null;
  setConfig: React.Dispatch<React.SetStateAction<T | null>>;
  loading: boolean;
  saving: boolean;
  reload: () => Promise<void>;
  save: (payload?: Partial<T>) => Promise<boolean>;
  updateField: (path: string, value: unknown) => void;
}

export function useAdminConfig<T = Record<string, unknown>>(
  options: UseAdminConfigOptions = {}
): UseAdminConfigResult<T> {
  const endpointRef = useRef(options.endpoint ?? API.admin.settings);
  const messagesRef = useRef({
    success: options.successMessage,
    error: options.errorMessage,
  });
  endpointRef.current = options.endpoint ?? API.admin.settings;
  messagesRef.current = { success: options.successMessage, error: options.errorMessage };

  const [config, setConfig] = useState<T | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(endpointRef.current);
      if (res.ok) {
        const data = await res.json();
        setConfig(data.data);
      }
    } catch (err) {
      console.error('Failed to load config:', err);
      toast({ title: messagesRef.current.error ?? '加载失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (payload?: Partial<T>): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch(endpointRef.current, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? configRef.current),
      });
      if (res.ok) {
        toast({ title: messagesRef.current.success ?? '保存成功' });
        return true;
      }
      const data = await res.json();
      toast({ title: data.error || '保存失败', variant: 'destructive' });
      return false;
    } catch {
      toast({ title: '保存失败', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateField = useCallback((path: string, value: unknown) => {
    setConfig(prev => {
      if (!prev) return prev;
      const clone = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return clone;
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return useMemo(
    () => ({ config, setConfig, loading, saving, reload, save, updateField }),
    [config, loading, saving, reload, save, updateField]
  );
}
