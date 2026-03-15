'use client';

import * as React from 'react';
import type { ProjectAsset } from '@/lib/db-comic';
import { ImageIcon, Upload, ArrowLeft, ZoomIn, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssetHeroProps {
  asset: ProjectAsset;
  onSetPrimary: (historyId: string, imageUrl: string) => void;
  onSetPrimaryUrl?: (url: string) => void;
  onUploadImage?: (file: File) => void;
  onBack: () => void;
}

export function AssetHero({ asset, onSetPrimary, onSetPrimaryUrl, onUploadImage, onBack }: AssetHeroProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [displayUrl, setDisplayUrl] = React.useState(asset.primaryImageUrl);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const lightboxRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragCounterRef = React.useRef(0);

  React.useEffect(() => {
    if (lightboxOpen) lightboxRef.current?.focus();
  }, [lightboxOpen]);

  React.useEffect(() => { setLightboxOpen(false); }, [asset.id]);
  React.useEffect(() => { if (!displayUrl) setLightboxOpen(false); }, [displayUrl]);

  // Crossfade 动效：主图切换时
  React.useEffect(() => {
    if (asset.primaryImageUrl !== displayUrl) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayUrl(asset.primaryImageUrl);
        setIsTransitioning(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [asset.primaryImageUrl, displayUrl]);

  const isAcceptedDrag = (e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    return (
      types.includes('application/x-sanhub-history') ||
      types.includes('application/x-sanhub-asset') ||
      types.includes('Files')
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isAcceptedDrag(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isAcceptedDrag(e)) return;
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    // 1) Gallery 历史记录拖拽
    const historyRaw = e.dataTransfer.getData('application/x-sanhub-history');
    if (historyRaw) {
      try {
        const { historyId, imageUrl } = JSON.parse(historyRaw);
        if (imageUrl) onSetPrimary(historyId, imageUrl);
      } catch { /* ignore */ }
      return;
    }

    // 2) 素材库侧栏拖拽
    const assetRaw = e.dataTransfer.getData('application/x-sanhub-asset');
    if (assetRaw && onSetPrimaryUrl) {
      try {
        const { primaryImageUrl } = JSON.parse(assetRaw);
        if (primaryImageUrl) onSetPrimaryUrl(primaryImageUrl);
      } catch { /* ignore */ }
      return;
    }

    // 3) 本地文件拖拽
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
    if (file && onUploadImage) {
      onUploadImage(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/') && onUploadImage) {
      onUploadImage(file);
    }
    e.target.value = '';
  };

  return (
    <div
      className="relative shrink-0 bg-black/20 border-b border-white/[0.06]"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 浮动返回按钮 */}
      <button
        onClick={onBack}
        aria-label="返回"
        className="absolute top-3 left-3 z-20 w-9 h-9 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* 浮动上传按钮 */}
      {displayUrl && onUploadImage && (
        <button
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          aria-label="上传图片"
          className="absolute top-3 right-3 z-20 h-8 px-3 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center gap-1.5 text-white text-xs hover:bg-black/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>上传</span>
        </button>
      )}

      {/* 高斯模糊背景 */}
      {displayUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-2xl opacity-20 scale-110"
          style={{ backgroundImage: `url(${displayUrl})` }}
        />
      )}

      {/* 拖放覆盖层 */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <span className="text-primary font-medium">松开以替换主图</span>
        </div>
      )}

      {/* 主图内容 */}
      <div className="relative z-[1] flex items-center justify-center py-4 px-4 min-h-[140px] max-h-[220px]">
        {displayUrl ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="查看大图"
            className="relative group cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => !isDragOver && setLightboxOpen(true)}
            onKeyDown={(e) => { if (!isDragOver && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setLightboxOpen(true); } }}
          >
            <img
              src={displayUrl}
              alt={asset.name}
              className={cn(
                'max-w-full max-h-[180px] object-contain rounded-lg shadow-2xl',
                'transition-opacity duration-200',
                isTransitioning && 'opacity-0',
              )}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <ZoomIn className="h-8 w-8 text-white/0 group-hover:text-white/60 transition-all duration-200 drop-shadow-lg" />
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            className={cn(
              'w-full max-w-md aspect-video bg-muted/20 rounded-lg border border-dashed border-white/[0.08] flex flex-col items-center justify-center gap-3 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              onUploadImage ? 'cursor-pointer hover:border-white/[0.15]' : 'cursor-default',
            )}
            onClick={() => onUploadImage && fileInputRef.current?.click()}
            onKeyDown={(e) => { if (onUploadImage && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInputRef.current?.click(); } }}
          >
            <ImageIcon className="h-12 w-12 opacity-30" />
            <span className="text-sm">点击上传图片</span>
          </div>
        )}
      </div>

      {/* Lightbox 全屏预览 */}
      {lightboxOpen && displayUrl && (
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 outline-none"
          tabIndex={-1}
          onClick={() => setLightboxOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setLightboxOpen(false)}
        >
          <button
            aria-label="关闭预览"
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={displayUrl}
            alt={asset.name}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 隐藏文件输入 */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileUpload}
      />
    </div>
  );
}