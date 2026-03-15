'use client';

import * as React from 'react';
import type { ProjectAsset } from '@/lib/db-comic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatTimestamp } from '@/lib/date-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Save, Trash2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { typeConfig, attributeLabels } from '@/components/assets/asset-schema';
import { apiGet, apiDelete } from '@/lib/api-client';

interface AssetOverviewTabProps {
  asset: ProjectAsset;
  onUpdate: (updates: Partial<ProjectAsset>) => void;
  onDelete?: () => void;
}

export function AssetOverviewTab({ asset, onUpdate, onDelete }: AssetOverviewTabProps) {
  const [name, setName] = React.useState(asset.name);
  const [isDirty, setIsDirty] = React.useState(false);
  const [descriptors, setDescriptors] = React.useState('');
  const [isDescriptorsDirty, setIsDescriptorsDirty] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  const config = typeConfig[asset.type];

  // Sync name when asset changes externally
  React.useEffect(() => {
    setName(asset.name);
    setIsDirty(false);
  }, [asset.id, asset.name]);

  // Sync descriptors when asset changes externally
  React.useEffect(() => {
    const desc = (asset.attributes as Record<string, unknown>)?.descriptors;
    setDescriptors(typeof desc === 'string' ? desc : '');
    setIsDescriptorsDirty(false);
  }, [asset.id, asset.attributes]);

  const handleSaveName = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onUpdate({ name: trimmed });
    setIsDirty(false);
  };

  const handleSaveDescriptors = () => {
    const currentAttrs = (asset.attributes as Record<string, unknown>) || {};
    onUpdate({
      attributes: { ...currentAttrs, descriptors: descriptors.trim() },
    } as Partial<ProjectAsset>);
    setIsDescriptorsDirty(false);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await apiGet(`/api/assets/${asset.id}/export?includeOccurrences=true`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${asset.name}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiDelete(`/api/assets/${asset.id}`);
      if (onDelete) onDelete();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6 max-w-4xl mx-auto">
      {/* 资产类型 Badge & 操作区 */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 col-span-full pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            config.bgColor,
            config.color,
          )}>
            {config.label}
          </div>
          <span className="text-xs text-muted-foreground">
            创建于 {formatTimestamp(asset.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {isExporting ? '导出中...' : '导出资产'}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red-400 hover:text-red-300 hover:border-red-400/50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除资产
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除资产「{asset.name}」吗？此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* 名称编辑 */}
      <div className="space-y-2 col-span-full">
        <label className="text-sm font-medium">名称</label>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setIsDirty(true);
            }}
            className="flex-1"
          />
          {isDirty && (
            <Button size="sm" onClick={handleSaveName} className="gap-1.5 shrink-0">
              <Save className="h-3.5 w-3.5" />
              保存
            </Button>
          )}
        </div>
      </div>

      {/* 类型特有属性字段 */}
      {Object.entries(attributeLabels[asset.type] || {}).map(([key, label]) => {
        if (key === 'descriptors') return null;
        const isMultiline = ['persona', 'locationDescription', 'propDescription'].includes(key);
        return (
          <AttributeField
            key={key}
            attrKey={key}
            label={label}
            asset={asset}
            multiline={isMultiline}
            onUpdate={onUpdate}
          />
        );
      })}

      {/* 绘图描述词编辑 */}
      <div className="space-y-2 col-span-full">
        <label className="text-sm font-medium">绘图描述词</label>
        <textarea
          value={descriptors}
          onChange={(e) => {
            setDescriptors(e.target.value);
            setIsDescriptorsDirty(true);
          }}
          placeholder="输入绘图描述词..."
          className={cn(
            'w-full min-h-[100px] px-3 py-2 bg-card/60',
            'border border-white/[0.06] rounded-lg text-sm resize-y',
            'focus:outline-none focus:ring-1 focus:ring-primary/50',
          )}
        />
        {isDescriptorsDirty && (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSaveDescriptors} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              保存描述词
            </Button>
          </div>
        )}
      </div>

    </div>
  );
}

function AttributeField({
  attrKey,
  label,
  asset,
  multiline,
  onUpdate,
}: {
  attrKey: string;
  label: string;
  asset: ProjectAsset;
  multiline?: boolean;
  onUpdate: (updates: Partial<ProjectAsset>) => void;
}) {
  const rawValue = (asset.attributes as Record<string, unknown>)?.[attrKey];
  const initialValue = typeof rawValue === 'string' ? rawValue : '';
  const [localValue, setLocalValue] = React.useState(initialValue);
  const [dirty, setDirty] = React.useState(false);
  const fieldId = React.useId();

  React.useEffect(() => {
    if (dirty) return;
    const v = (asset.attributes as Record<string, unknown>)?.[attrKey];
    setLocalValue(typeof v === 'string' ? v : '');
  }, [asset.id, asset.attributes, attrKey, dirty]);

  const handleSave = () => {
    const currentAttrs = (asset.attributes as Record<string, unknown>) || {};
    onUpdate({
      attributes: { ...currentAttrs, [attrKey]: localValue.trim() },
    } as Partial<ProjectAsset>);
    setDirty(false);
  };

  return (
    <div className={cn("space-y-2", multiline && "col-span-full")}>
      <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
      <div className="flex gap-2 items-start">
        {multiline ? (
          <textarea
            id={fieldId}
            value={localValue}
            onChange={(e) => { setLocalValue(e.target.value); setDirty(true); }}
            placeholder={`输入${label}...`}
            className={cn(
              'flex-1 min-h-[80px] px-3 py-2 bg-card/60',
              'border border-white/[0.06] rounded-lg text-sm resize-y',
              'focus:outline-none focus:ring-1 focus:ring-primary/50',
            )}
          />
        ) : (
          <Input
            id={fieldId}
            value={localValue}
            onChange={(e) => { setLocalValue(e.target.value); setDirty(true); }}
            placeholder={`输入${label}...`}
            className="flex-1"
          />
        )}
        {dirty && (
          <Button size="sm" onClick={handleSave} className="gap-1.5 shrink-0 mt-0.5">
            <Save className="h-3.5 w-3.5" />
            保存
          </Button>
        )}
      </div>
    </div>
  );
}
