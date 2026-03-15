'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AddArtStyleModal } from './add-art-style-modal';
import { ProjectPreferencesEditor, DEFAULT_PROJECT_PREFERENCES, toGenerationPreferences, validateProjectPreferences } from './project-preferences-editor';
import type { GenerationPreferences } from './generation-preferences-form';
import { usePreferenceOptions } from '@/hooks/use-preference-options';
import { ImageUpload } from '@/components/ui/image-upload';
import { fileToBase64 } from '@/lib/utils';
import { notify } from '@/lib/toast-utils';
import { apiFetch } from '@/lib/api-client';
import type { ComicProject, ProjectPreferences } from '@/lib/db-comic';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  mode?: 'create' | 'edit';
  initialProject?: ComicProject;
  initialPreferences?: ProjectPreferences;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
  mode = 'create',
  initialProject,
  initialPreferences,
}: CreateProjectModalProps) {
  const { data: session } = useSession();
  const {
    options,
    isLoading: isLoadingOptions,
    error: optionsError,
    refetch,
  } = usePreferenceOptions({ enabled: isOpen });

  const [isLoading, setIsLoading] = useState(false);
  const [isAddStyleOpen, setIsAddStyleOpen] = useState(false);
  const [name, setName] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [copyText, setCopyText] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [preferences, setPreferences] = useState<GenerationPreferences>(
    DEFAULT_PROJECT_PREFERENCES,
  );
  const [coverImageUrl, setCoverImageUrl] = useState('');

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && initialProject) {
      const nextPreferences = toGenerationPreferences(initialPreferences);

      setName(initialProject.name);
      setAspectRatio(nextPreferences.defaultVideoRatio || initialProject.aspectRatio || '16:9');
      setCopyText(initialProject.description || initialProject.copyText || '');
      setCoverImageUrl(initialProject.coverImageUrl || '');
      setCoverImage(null);
      setPreferences(nextPreferences);
      return;
    }

    setName('');
    setAspectRatio('16:9');
    setCopyText('');
    setCoverImage(null);
    setCoverImageUrl('');
    setPreferences(DEFAULT_PROJECT_PREFERENCES);
  }, [initialPreferences, initialProject, isOpen, mode]);

  const validation = useMemo(
    () => validateProjectPreferences(preferences, options),
    [options, preferences],
  );

  const handleClose = () => {
    setName('');
    setAspectRatio('16:9');
    setCopyText('');
    setCoverImage(null);
    setCoverImageUrl('');
    setPreferences(DEFAULT_PROJECT_PREFERENCES);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validation.canSave) {
      notify.error('请先完成项目默认配置');
      return;
    }

    setIsLoading(true);

    try {
      let coverImageBase64: string | null = null;
      let coverImageType = '';

      if (coverImage) {
        coverImageBase64 = await fileToBase64(coverImage);
        coverImageType = coverImage.type;
      }

      const url = mode === 'edit' && initialProject
        ? `/api/projects/${initialProject.id}`
        : '/api/projects';
      const method = mode === 'edit' ? 'PATCH' : 'POST';

      const payload: Record<string, unknown> = {
        name: name.trim() || '未命名项目',
        aspectRatio,
        description: copyText || null,
        sizeLabel: aspectRatio,
        preferences: {
          defaultImageModelId: preferences.defaultImageModelId,
          defaultVideoModelId: preferences.defaultVideoModelId,
          defaultTextModelId: preferences.defaultTextModelId,
          defaultStyle: preferences.defaultStyle || null,
          defaultVideoRatio: preferences.defaultVideoRatio,
          defaultEra: preferences.defaultEra || null,
        },
      };

      if (mode === 'create') {
        payload.mode = 'ai_merge';
      }

      if (coverImageBase64) {
        payload.coverImage = `data:${coverImageType};base64,${coverImageBase64}`;
      } else if (mode === 'edit' && !coverImageUrl && initialProject?.coverImageUrl) {
        payload.coverImage = null;
      }

      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      notify.success(mode === 'edit' ? '项目更新成功' : '项目创建成功');
      onCreated?.();
      handleClose();
    } catch (error) {
      notify.fromError(error, mode === 'edit' ? '更新失败' : '创建失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[960px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '编辑项目' : '创建漫剧作品'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>项目名称</Label>
                <Input
                  placeholder="输入项目名称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>项目说明</Label>
                <Textarea
                  placeholder="输入项目简介或备注信息..."
                  className="h-[180px] resize-none"
                  value={copyText}
                  onChange={(e) => setCopyText(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>项目封面</Label>
                <ImageUpload
                  value={coverImage}
                  onChange={setCoverImage}
                  onRemove={() => setCoverImageUrl('')}
                  existingUrl={coverImageUrl}
                  aspectRatio="3:4"
                  className="h-[220px]"
                />
              </div>
            </div>

            <ProjectPreferencesEditor
              preferences={preferences}
              onChange={setPreferences}
              options={options}
              isLoading={isLoadingOptions}
              error={optionsError}
              onRetry={refetch}
              layout="stacked"
              showVideoRatio
              onVideoRatioChange={setAspectRatio}
              isAdmin={isAdmin}
              onAddStyle={isAdmin ? () => setIsAddStyleOpen(true) : undefined}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button
              type="submit"
              className="bg-brand hover:bg-brand/90 text-white"
              disabled={isLoading || isLoadingOptions || !validation.canSave}
            >
              {isLoading ? '提交中...' : mode === 'edit' ? '保存修改' : '立即创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <AddArtStyleModal
        isOpen={isAddStyleOpen}
        onClose={() => setIsAddStyleOpen(false)}
        onSuccess={() => {
          void refetch();
        }}
      />
    </Dialog>
  );
}
