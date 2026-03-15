'use client';

import * as React from 'react';
import { Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value?: File | null;
  onChange: (file: File | null) => void;
  aspectRatio?: '1:1' | '3:4' | '16:9';
  maxSize?: number;
  accept?: string;
  className?: string;
  existingUrl?: string;
  onRemove?: () => void;
}

export function ImageUpload({
  value,
  onChange,
  aspectRatio = '3:4',
  maxSize = 5,
  accept = 'image/jpeg,image/png,image/jpg',
  className,
  existingUrl,
  onRemove,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (existingUrl) {
      setPreview(existingUrl);
    } else {
      setPreview(null);
    }
  }, [value, existingUrl]);

  const processFile = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|jpg)$/)) {
      return;
    }
    if (file.size > maxSize * 1024 * 1024) {
      return;
    }
    onChange(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const aspectRatioClass = {
    '1:1': 'aspect-square',
    '3:4': 'aspect-[3/4]',
    '16:9': 'aspect-video',
  }[aspectRatio];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative rounded-lg border-2 border-dashed transition-all cursor-pointer',
        'hover:bg-muted/50 flex flex-col items-center justify-center gap-2 p-4',
        'text-center overflow-hidden group',
        aspectRatioClass,
        isDragging
          ? 'border-brand bg-brand/10'
          : 'border-muted-foreground/25',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
          e.target.value = '';
        }}
      />

      {preview ? (
        <>
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover absolute inset-0"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="text-white text-xs font-medium flex flex-col items-center gap-1">
              <Upload className="w-4 h-4" />
              <span>点击更换</span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              onRemove?.();
            }}
            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
          >
            <X className="w-3 h-3" />
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="p-3 bg-muted rounded-full">
            <Upload className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              点击或拖动文件上传
            </p>
            <p className="text-xs">支持 JPG / PNG</p>
          </div>
        </div>
      )}
    </div>
  );
}
