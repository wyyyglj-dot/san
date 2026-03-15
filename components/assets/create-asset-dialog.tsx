'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ui/image-upload';
import { attributeLabels, typeLabels } from '@/components/assets/asset-schema';
import type { ProjectAssetType } from '@/lib/db-comic';
import { cn } from '@/lib/utils';

interface CreateAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType: ProjectAssetType;
  onSubmit: (payload: {
    type: ProjectAssetType;
    name: string;
    description?: string;
    attributes?: Record<string, unknown>;
    imageFile?: File;
  }) => Promise<void>;
}

export function CreateAssetDialog({
  open,
  onOpenChange,
  defaultType,
  onSubmit,
}: CreateAssetDialogProps) {
  const [type, setType] = React.useState<ProjectAssetType>(defaultType);
  const [name, setName] = React.useState('');
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [attrs, setAttrs] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  // 当 defaultType 变化时同步 type
  React.useEffect(() => {
    setType(defaultType);
  }, [defaultType]);

  // 当 type 变化时重置属性字段
  React.useEffect(() => {
    setAttrs({});
  }, [type]);

  // 打开时重置表单
  React.useEffect(() => {
    if (open) {
      setName('');
      setImageFile(null);
      setAttrs({});
      setType(defaultType);
    }
  }, [open, defaultType]);

  const labels = attributeLabels[type] || {};

  const handleSubmit = async () => {
    // 验证：名称必填，且（图片 或 绘图描述词）至少填一项
    const hasImage = !!imageFile;
    const hasDescriptor = !!attrs.descriptors?.trim();
    
    if (!name.trim() || (!hasImage && !hasDescriptor) || submitting) return;
    
    setSubmitting(true);
    try {
      const attributes: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(attrs)) {
        if (v.trim()) attributes[k] = v.trim();
      }
      await onSubmit({
        type,
        name: name.trim(),
        // 将绘图描述词同步写入 description，确保下游搜索和 prompt 构造兼容
        description: attrs.descriptors?.trim() || undefined,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        imageFile: imageFile || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = name.trim() && (!!imageFile || !!attrs.descriptors?.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>新增{typeLabels[type]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 类型选择 */}
          <div className="flex gap-2">
            {(['character', 'scene', 'prop'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm transition-colors',
                  type === t
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {typeLabels[t]}
              </button>
            ))}
          </div>

          {/* 名称（必填） */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              名称 <span className="text-red-400">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`输入${typeLabels[type]}名称`}
              maxLength={200}
            />
          </div>

          {/* 参考图片（与绘图描述词二选一必填） */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              参考图片
              {attrs.descriptors?.trim()
                ? <span className="text-muted-foreground font-normal ml-1">(可选)</span>
                : <span className="text-red-400 ml-1">*</span>}
            </label>
            <ImageUpload
              value={imageFile}
              onChange={setImageFile}
              aspectRatio="1:1"
              className="h-36"
            />
          </div>

          {/* 动态属性字段 */}
          {Object.keys(labels).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">属性</h4>
              {Object.entries(labels).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {label}
                    {key === 'descriptors' && (
                      imageFile
                        ? <span className="ml-1">(可选)</span>
                        : <span className="text-red-400 ml-1">*</span>
                    )}
                  </label>
                  {key === 'descriptors' ? (
                    <textarea
                      value={attrs[key] || ''}
                      onChange={(e) =>
                        setAttrs((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full min-h-[80px] px-3 py-2 bg-card/60 border border-white/[0.06] rounded-lg text-sm text-foreground resize-y focus:outline-none focus:border-border"
                      placeholder={`输入${label}...`}
                    />
                  ) : (
                    <Input
                      value={attrs[key] || ''}
                      onChange={(e) =>
                        setAttrs((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder={label}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || submitting}
          >
            {submitting ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}