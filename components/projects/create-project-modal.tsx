'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GenerationPreferencesForm,
  type GenerationPreferences,
} from './generation-preferences-form';
import { usePreferenceOptions } from '@/hooks/use-preference-options';
import { ArtStyleSelector } from './art-style-selector';
import { AddArtStyleModal } from './add-art-style-modal';
import { ImageUpload } from '@/components/ui/image-upload';
import { fileToBase64 } from '@/lib/utils';
import { notify } from '@/lib/toast-utils';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import type { ComicProject, ProjectPreferences } from '@/lib/db-comic';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  mode?: 'create' | 'edit';
  initialProject?: ComicProject;
  initialPreferences?: ProjectPreferences;
}

const DEFAULT_PREFERENCES: GenerationPreferences = {
  defaultImageModelId: '',
  defaultVideoModelId: '',
  defaultTextModelId: '',
  defaultStyle: '',
  defaultVideoRatio: '16:9',
  defaultEra: '',
};

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
  mode = 'create',
  initialProject,
  initialPreferences,
}: CreateProjectModalProps) {
  const { data: session } = useSession();
  const { options, isLoading: isLoadingOptions, refetch } = usePreferenceOptions();
  const [isLoading, setIsLoading] = useState(false);
  const [isAddStyleOpen, setIsAddStyleOpen] = useState(false);
  const [name, setName] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [copyText, setCopyText] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [preferences, setPreferences] = useState<GenerationPreferences>(DEFAULT_PREFERENCES);
  const [coverImageUrl, setCoverImageUrl] = useState('');

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    if (isOpen && mode === 'edit' && initialProject) {
      setName(initialProject.name);
      setAspectRatio(initialProject.aspectRatio || '16:9');
      setCopyText(initialProject.description || initialProject.copyText || '');
      setCoverImageUrl(initialProject.coverImageUrl || '');
      if (initialPreferences) {
        setPreferences({
          defaultImageModelId: initialPreferences.defaultImageModelId || '',
          defaultVideoModelId: initialPreferences.defaultVideoModelId || '',
          defaultTextModelId: initialPreferences.defaultTextModelId || '',
          defaultStyle: initialPreferences.defaultStyle || '',
          defaultVideoRatio: initialPreferences.defaultVideoRatio || '16:9',
          defaultEra: initialPreferences.defaultEra || '',
        });
        setAspectRatio(initialPreferences.defaultVideoRatio || initialProject.aspectRatio || '16:9');
      }
    }
  }, [isOpen, mode, initialProject, initialPreferences]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证必填字段
    if (!preferences.defaultImageModelId) {
      notify.error('当前图片渠道无可用模型，请切换渠道');
      return;
    }
    if (!preferences.defaultVideoModelId) {
      notify.error('当前视频渠道无可用模型，请切换渠道');
      return;
    }
    if (!preferences.defaultTextModelId) {
      notify.error('请选择文字模型');
      return;
    }

    setIsLoading(true);

    try {
      let coverImageBase64 = null;
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
          defaultVideoRatio: aspectRatio,
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
    } catch (err) {
      notify.fromError(err, '创建失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setAspectRatio('16:9');
    setCopyText('');
    setCoverImage(null);
    setCoverImageUrl('');
    setPreferences(DEFAULT_PREFERENCES);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '编辑项目' : '创建漫剧作品'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Basic Info + Model Selection */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>项目名称</Label>
                <Input
                  placeholder="输入项目名称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>项目说明</Label>
                  <Textarea
                    placeholder="输入项目简介或备注信息..."
                    className="h-[160px] resize-none"
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
                    className="h-[160px]"
                  />
                </div>
              </div>

              {/* Generation Config */}
              <GenerationPreferencesForm
                preferences={preferences}
                onChange={setPreferences}
                imageModels={options?.imageModels ?? []}
                imageChannels={options?.imageChannels ?? []}
                videoModels={options?.videoModels ?? []}
                videoChannels={options?.videoChannels ?? []}
                textModels={options?.textModels ?? []}
                isLoading={isLoadingOptions}
                aspectRatio={aspectRatio}
                onAspectRatioChange={(value) => {
                  setAspectRatio(value);
                  setPreferences((prev) => ({ ...prev, defaultVideoRatio: value }));
                }}
              />
            </div>

            {/* Right Column: Art Style Selection */}
            <div className="border-l border-white/[0.04] pl-6 hidden md:block">
              <div className="space-y-2 mb-6">
                <Label>时代设定</Label>
                <Select
                  value={preferences.defaultEra || 'none'}
                  onValueChange={(v) => setPreferences(prev => ({ ...prev, defaultEra: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择时代" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不指定</SelectItem>
                    <SelectItem value="modern">都市韩国</SelectItem>
                    <SelectItem value="ancient">古代中国</SelectItem>
                    <SelectItem value="medieval">中世纪</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ArtStyleSelector
                styles={options?.styles ?? []}
                selectedSlug={preferences.defaultStyle}
                onSelect={(slug) => setPreferences(prev => ({ ...prev, defaultStyle: slug }))}
                isLoading={isLoadingOptions}
                isAdmin={isAdmin}
                onAddStyle={() => setIsAddStyleOpen(true)}
              />
            </div>
          </div>

          {/* Mobile: Show art style selection below */}
          <div className="md:hidden border-t border-white/[0.04] pt-6">
            <div className="space-y-2 mb-6">
              <Label>时代设定</Label>
              <Select
                value={preferences.defaultEra || 'none'}
                onValueChange={(v) => setPreferences(prev => ({ ...prev, defaultEra: v === 'none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择时代" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  <SelectItem value="modern">都市韩国</SelectItem>
                  <SelectItem value="ancient">古代中国</SelectItem>
                  <SelectItem value="medieval">中世纪</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ArtStyleSelector
              styles={options?.styles ?? []}
              selectedSlug={preferences.defaultStyle}
              onSelect={(slug) => setPreferences(prev => ({ ...prev, defaultStyle: slug }))}
              isLoading={isLoadingOptions}
              isAdmin={isAdmin}
              onAddStyle={() => setIsAddStyleOpen(true)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button
              type="submit"
              className="bg-brand hover:bg-brand/90 text-white"
              disabled={isLoading}
            >
              {isLoading ? '提交中...' : (mode === 'edit' ? '保存修改' : '立即创建')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <AddArtStyleModal
        isOpen={isAddStyleOpen}
        onClose={() => setIsAddStyleOpen(false)}
        onSuccess={() => {
          refetch();
        }}
      />
    </Dialog>
  );
}
