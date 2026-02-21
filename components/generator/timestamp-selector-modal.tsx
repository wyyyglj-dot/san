'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Play, Pause, Loader2, UserPlus, AlertCircle } from 'lucide-react';

interface CharacterExtra {
  characterPrompt?: string;
  characterUserName?: string;
  firstFrameBase64?: string;
}

interface TimestampSelectorModalProps {
  videoUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (start: number, end: number, extra?: CharacterExtra) => Promise<void>;
  showCharacterFields?: boolean;
  maxDuration?: number;
}

const DEFAULT_DURATION = 3;
const MIN_CLIP_DURATION = 1;
const MAX_CLIP_DURATION = 3;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

function isValidVideoUrl(url: string): boolean {
  if (!url) return false;
  // Allow http/https/blob protocols OR relative paths starting with /
  return /^(https?|blob):/.test(url) || url.startsWith('/');
}

export function TimestampSelectorModal({ videoUrl, isOpen, onClose, onConfirm, showCharacterFields, maxDuration: propMaxDuration }: TimestampSelectorModalProps) {
  const effectiveMaxDuration = Math.min(propMaxDuration ?? MAX_CLIP_DURATION, MAX_CLIP_DURATION);
  const [clipDuration, setClipDuration] = useState(DEFAULT_DURATION);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [characterPrompt, setCharacterPrompt] = useState('.');
  const [characterUserName, setCharacterUserName] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'window' | null>(null);
  const dragStartRef = useRef({ x: 0, startTime: 0, duration: 0, trackWidth: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const endTime = startTime + clipDuration;

  useEffect(() => {
    if (isOpen) {
      setIsLoaded(false);
      setLoadError(null);
      setStartTime(0);
      setIsPlaying(true);
      setClipDuration(DEFAULT_DURATION);
      setCharacterPrompt('.');
      setCharacterUserName('');

      if (videoUrl && !isValidVideoUrl(videoUrl)) {
        setLoadError('无效的视频链接');
      }

      // 热重载后视频 DOM 已加载但 onLoadedMetadata 不会重新触发，手动同步状态
      if (videoRef.current && videoRef.current.readyState >= 1) {
        const dur = videoRef.current.duration;
        if (isFinite(dur) && dur >= MIN_CLIP_DURATION) {
          setDuration(dur);
          setIsLoaded(true);
        }
      }
    }
  }, [isOpen, videoUrl]);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const onLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (!isFinite(dur) || dur < MIN_CLIP_DURATION) {
        setLoadError(`视频时长不足 ${MIN_CLIP_DURATION} 秒，无法创建角色卡`);
        setIsLoaded(false);
        return;
      }
      setDuration(dur);
      setIsLoaded(true);
      setStartTime(0);
    }
  };

  const onVideoError = () => {
    setLoadError('视频加载失败');
    setIsLoaded(false);
  };

  const onTimeUpdate = () => {
    if (!videoRef.current) return;
    if (videoRef.current.currentTime >= endTime || videoRef.current.currentTime < startTime) {
      videoRef.current.currentTime = startTime;
      if (isPlaying) videoRef.current.play().catch(() => {});
    }
  };

  const handleDragMove = useCallback((clientX: number) => {
    if (draggingRef.current !== 'window') return;
    
    const { x: startX, startTime: initialStartTime, duration, trackWidth } = dragStartRef.current;
    if (trackWidth === 0 || duration === 0) return;

    const deltaX = clientX - startX;
    const deltaTime = (deltaX / trackWidth) * duration;
    
    let newStartTime = initialStartTime + deltaTime;
    
    // Clamp values
    // min: 0
    // max: duration - clipDuration
    const maxStartTime = Math.max(0, duration - clipDuration);
    newStartTime = Math.max(0, Math.min(maxStartTime, newStartTime));
    
    setStartTime(newStartTime);
    
    if (videoRef.current) {
      // Throttle seeking to avoid stuttering? 
      // Current usage seems to accept direct setting.
      // We check difference to avoid micro-updates if needed, but simple assignment is usually fine.
      if (Math.abs(videoRef.current.currentTime - newStartTime) > 0.1) {
        videoRef.current.currentTime = newStartTime;
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleDragMove(e.clientX);
  }, [handleDragMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (draggingRef.current) {
      e.preventDefault();
      handleDragMove(e.touches[0].clientX);
    }
  }, [handleDragMove]);

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleTouchEnd = useCallback(() => {
    draggingRef.current = null;
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  }, [handleTouchMove]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!trackRef.current) return;
    
    draggingRef.current = 'window';
    dragStartRef.current = {
      x: e.clientX,
      startTime: startTime,
      duration: duration,
      trackWidth: trackRef.current.getBoundingClientRect().width
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    
    if (!trackRef.current) return;
    
    draggingRef.current = 'window';
    dragStartRef.current = {
      x: e.touches[0].clientX,
      startTime: startTime,
      duration: duration,
      trackWidth: trackRef.current.getBoundingClientRect().width
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleConfirm = async () => {
    if (!isLoaded || loadError) return;
    if (endTime > duration) return;
    if (isNaN(startTime) || isNaN(endTime) || !isFinite(startTime) || !isFinite(endTime)) {
      return;
    }
    setIsSubmitting(true);
    try {
      // 截取视频第一帧作为封面
      let firstFrameBase64: string | undefined;
      if (videoRef.current) {
        try {
          const video = videoRef.current;
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            firstFrameBase64 = canvas.toDataURL('image/jpeg', 0.8);
          }
        } catch {
          // CORS 或其他原因导致截帧失败，忽略
        }
      }
      const finalPrompt = characterPrompt.trim() || '.';
      const extra = showCharacterFields
        ? { characterPrompt: finalPrompt, characterUserName: characterUserName.trim() || undefined, firstFrameBase64 }
        : firstFrameBase64 ? { firstFrameBase64 } : undefined;
      await onConfirm(startTime, endTime, extra);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = 0.1;
    let newTime = startTime;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      newTime = Math.max(0, startTime - step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const maxStart = Math.max(0, duration - clipDuration);
      newTime = Math.min(maxStart, startTime + step);
    }

    if (newTime !== startTime) {
      setStartTime(newTime);
      if (videoRef.current) videoRef.current.currentTime = newTime;
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || duration === 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));

    const halfWindowDuration = clipDuration / 2;
    let newStartTime = (clickRatio * duration) - halfWindowDuration;

    const maxStartTime = Math.max(0, duration - clipDuration);
    newStartTime = Math.max(0, Math.min(maxStartTime, newStartTime));

    setStartTime(newStartTime);
    if (videoRef.current) videoRef.current.currentTime = newStartTime;
  };

  if (!isOpen) return null;

  const showControls = duration > 0 && !loadError;

  return (
    <div
      className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-500/20 rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 id="modal-title" className="text-lg font-medium text-foreground">创建角色卡</h3>
              <p className="text-sm text-foreground/50">选择视频展示片段</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-card/80 rounded-lg transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5 text-foreground/50" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6">
          {/* Video Area */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border group">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              onError={onVideoError}
              autoPlay
              loop={false}
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={togglePlayPause}
                className="p-3 bg-black/50 rounded-full backdrop-blur-sm hover:bg-black/70 transition-colors"
              >
                {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white" />}
              </button>
            </div>
            {!isLoaded && !loadError && (
              <div className="absolute inset-0 flex items-center justify-center bg-card">
                <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
              </div>
            )}
            {loadError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-card z-10">
                <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                <p className="text-sm text-red-400">{loadError}</p>
              </div>
            )}
          </div>

          {/* Timeline Controls */}
          <div className="space-y-4 select-none touch-none">
            <div className="flex justify-between text-sm text-foreground/50 font-mono">
              <span>{formatTime(startTime)}</span>
              <span className="text-sky-400">{clipDuration}s</span>
              <span>{formatTime(endTime)}</span>
            </div>

            <div
              className="relative h-12 flex items-center cursor-pointer"
              ref={trackRef}
              onClick={handleTrackClick}
            >
              {/* Background Track */}
              <div className="absolute left-0 right-0 h-2 bg-card/80 border border-border rounded-full" />

              {/* Active Draggable Window */}
              {showControls && (
                <div
                  className="absolute h-full top-0 z-10 cursor-grab active:cursor-grabbing group touch-none focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 rounded"
                  style={{
                    left: `${(startTime / duration) * 100}%`,
                    width: `${(clipDuration / duration) * 100}%`
                  }}
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={handleKeyDown}
                  tabIndex={0}
                  role="slider"
                  aria-label="选择视频片段"
                  aria-valuemin={0}
                  aria-valuemax={Math.max(0, duration - clipDuration)}
                  aria-valuenow={startTime}
                >
                  {/* Highlight Bar */}
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 bg-sky-500/30 border border-sky-500 rounded-full flex items-center justify-center">
                    {/* Grip Handle Indicator */}
                    <div className="w-1 h-3 bg-sky-500 rounded-full mx-0.5" />
                    <div className="w-1 h-3 bg-sky-500 rounded-full mx-0.5" />
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-foreground/40 text-center">
              拖动选中区域选择展示片段
            </p>

            {/* Duration Selector */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs text-foreground/50">片段时长:</span>
              {Array.from({ length: effectiveMaxDuration - MIN_CLIP_DURATION + 1 }, (_, i) => i + MIN_CLIP_DURATION).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setClipDuration(d);
                    // 确保 startTime + 新时长不超出视频
                    if (duration > 0 && startTime + d > duration) {
                      setStartTime(Math.max(0, duration - d));
                    }
                  }}
                  className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                    clipDuration === d
                      ? 'bg-sky-500 text-white border-sky-500'
                      : 'bg-card/60 text-foreground/60 border-border hover:border-sky-500/50'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Character Fields (KIE.AI) */}
          {showCharacterFields && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1.5">
                  角色描述 <span className="text-foreground/30">(可选)</span>
                </label>
                <textarea
                  value={characterPrompt}
                  onChange={(e) => setCharacterPrompt(e.target.value)}
                  placeholder="描述角色的个性和外观，例如：一个友好的卡通角色，有着富有表现力的眼睛和流畅的动作"
                  className="w-full px-3 py-2 bg-card/60 border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none"
                  rows={3}
                  maxLength={5000}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1.5">
                  角色名称 <span className="text-foreground/30">(可选)</span>
                </label>
                <input
                  type="text"
                  value={characterUserName}
                  onChange={(e) => setCharacterUserName(e.target.value)}
                  placeholder="角色名称，用于后续引用"
                  className="w-full px-3 py-2 bg-card/60 border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  maxLength={40}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-card/50 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-card/60 text-foreground border border-white/[0.06] rounded-xl hover:bg-card/80 transition-colors text-sm font-medium disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || !isLoaded || !!loadError}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            创建角色卡
          </button>
        </div>
      </div>
    </div>
  );
}
