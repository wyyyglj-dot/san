'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePreferenceOptions } from '@/hooks/use-preference-options';
import { apiPatch } from '@/lib/api-client';
import { notify } from '@/lib/toast-utils';
import type { ProjectPreferences } from '@/lib/db-comic';
import {
  arePreferencesEqual,
  DEFAULT_PROJECT_PREFERENCES,
  ProjectPreferencesEditor,
  toGenerationPreferences,
  validateProjectPreferences,
} from './project-preferences-editor';
import type { GenerationPreferences } from './generation-preferences-form';

interface ProjectPreferencesDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProjectDetailEnvelope {
  success?: boolean;
  data?: {
    name?: string;
  };
  preferences?: ProjectPreferences | null;
  error?: string;
}

async function fetchProjectDetail(projectId: string) {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    credentials: 'same-origin',
  });

  let payload: ProjectDetailEnvelope | null = null;
  try {
    payload = await res.json();
  } catch {
    throw new Error('项目配置响应格式异常');
  }

  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || '获取项目默认配置失败');
  }

  return {
    projectName: payload.data?.name || `Project ${projectId}`,
    preferences: toGenerationPreferences(payload.preferences),
  };
}

export function ProjectPreferencesDialog({
  projectId,
  open,
  onOpenChange,
}: ProjectPreferencesDialogProps) {
  const {
    options,
    isLoading: isOptionsLoading,
    error: optionsError,
    refetch,
  } = usePreferenceOptions({ enabled: open });

  const [projectName, setProjectName] = useState('当前项目');
  const [preferences, setPreferences] = useState<GenerationPreferences>(
    DEFAULT_PROJECT_PREFERENCES,
  );
  const [initialPreferences, setInitialPreferences] = useState<GenerationPreferences>(
    DEFAULT_PROJECT_PREFERENCES,
  );
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadProject = useCallback(async () => {
    setIsProjectLoading(true);
    setProjectError(null);
    setSaveError(null);

    try {
      const detail = await fetchProjectDetail(projectId);
      setProjectName(detail.projectName);
      setPreferences(detail.preferences);
      setInitialPreferences(detail.preferences);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : '获取项目默认配置失败');
      setPreferences(DEFAULT_PROJECT_PREFERENCES);
      setInitialPreferences(DEFAULT_PROJECT_PREFERENCES);
    } finally {
      setIsProjectLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) {
      setSaveError(null);
      return;
    }

    void loadProject();
  }, [loadProject, open]);

  const handleRetry = useCallback(() => {
    void loadProject();
    void refetch();
  }, [loadProject, refetch]);

  const validation = useMemo(
    () => validateProjectPreferences(preferences, options),
    [options, preferences],
  );
  const isDirty = useMemo(
    () => !arePreferencesEqual(preferences, initialPreferences),
    [initialPreferences, preferences],
  );

  const editorError = projectError || optionsError;
  const disableSave =
    isSaving ||
    isProjectLoading ||
    isOptionsLoading ||
    !validation.canSave ||
    !isDirty;

  const handleSave = async () => {
    if (disableSave) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await apiPatch(`/api/projects/${encodeURIComponent(projectId)}`, {
        preferences: {
          defaultImageModelId: preferences.defaultImageModelId || null,
          defaultVideoModelId: preferences.defaultVideoModelId || null,
          defaultTextModelId: preferences.defaultTextModelId || null,
          defaultStyle: preferences.defaultStyle || null,
          defaultEra: preferences.defaultEra || null,
        },
      });

      notify.success('项目默认配置已保存');
      setInitialPreferences(preferences);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存项目默认配置失败';
      setSaveError(message);
      notify.error('保存失败', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>项目默认配置</DialogTitle>
          <DialogDescription>
            为“{projectName}”统一设置图片、视频、文字和风格类默认配置。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <ProjectPreferencesEditor
            preferences={preferences}
            onChange={setPreferences}
            options={isProjectLoading ? null : options}
            isLoading={isProjectLoading || isOptionsLoading}
            error={editorError}
            onRetry={handleRetry}
          />
        </div>

        {saveError && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          >
            {saveError}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            className="bg-brand hover:bg-brand/90 text-white"
            disabled={disableSave}
            onClick={handleSave}
          >
            {isSaving ? '保存中...' : '保存默认配置'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
