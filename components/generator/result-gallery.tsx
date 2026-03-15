'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Maximize2, X, Play, Image as ImageIcon, Sparkles, Loader2, AlertCircle, Copy, ExternalLink, Bookmark, Trash2, UserPlus, Eraser, RotateCcw } from 'lucide-react';
import type { Generation } from '@/types';
import { formatDate, truncate } from '@/lib/utils';
import { downloadAsset } from '@/lib/download';
import { isRetryableVideoError } from '@/lib/retry-utils';
import { toast } from '@/components/ui/toaster';
import { apiPost, ApiClientError } from '@/lib/api-client';
import { TimestampSelectorModal } from './timestamp-selector-modal';

// 任务类型
export interface Task {
  id: string;
  prompt: string;
  model?: string;
  modelId?: string;
  channelId?: string;
  type?: string;
  status: 'queued' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number; // 0-100
  errorMessage?: string;
  result?: Generation;
  createdAt: number;
}

interface ResultGalleryProps {
  generations: Generation[];
  tasks?: Task[];
  onRemoveTask?: (taskId: string) => void;
  onRetryTask?: (task: Task) => void;
  onClear?: (ids: string[]) => void;
  onDeleteGeneration?: (id: string) => void;
}

export function ResultGallery({ generations, tasks = [], onRemoveTask, onRetryTask, onClear, onDeleteGeneration }: ResultGalleryProps) {
  const [selected, setSelected] = useState<Generation | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const renderMoreRef = useRef<HTMLDivElement>(null);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [showMarkedOnly, setShowMarkedOnly] = useState(false);
  const [selectedFailedTask, setSelectedFailedTask] = useState<Task | null>(null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [characterTarget, setCharacterTarget] = useState<Generation | null>(null);

  const toggleMark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 跟踪上一次的 generations 长度，用于检测新增
  const prevLengthRef = useRef(generations.length);

  useEffect(() => {
    const prevLength = prevLengthRef.current;
    const currentLength = generations.length;
    prevLengthRef.current = currentLength;

    setVisibleCount((prev) => {
      if (currentLength === 0) return 0;
      if (prev === 0) return Math.min(12, currentLength);

      // 如果有新视频添加，增加 visibleCount 以保持之前的视频可见
      if (currentLength > prevLength) {
        const added = currentLength - prevLength;
        return Math.min(prev + added, currentLength);
      }

      // 如果视频被删除，确保 visibleCount 不超过当前长度
      return Math.min(prev, currentLength);
    });
  }, [generations.length]);

  const downloadFile = async (url: string, id: string, type: string) => {
    if (!url) {
      toast({
        title: '下载失败',
        description: '文件地址不存在',
        variant: 'destructive',
      });
      return;
    }

    const extension = type.includes('video') ? 'mp4' : 'png';
    try {
      await downloadAsset(url, `sanhub-${id}.${extension}`);
    } catch (err) {
      console.error('Download failed', err);
      toast({
        title: '下载失败',
        description: '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const isVideo = (gen: Generation) => gen.type.includes('video');
  const isTaskVideo = (task: Task) => task.type?.includes('video') || task.model?.includes('video');

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, id: string) => {
    const target = e.currentTarget;
    const proxyUrl = `/api/media/${id}`;
    if (target.src.includes(proxyUrl)) return;
    target.src = proxyUrl;
  };

  // 过滤出正在进行的任务（不包括已完成的，已完成的会在 generations 中显示）
  // 同时排除已经存在于 generations 中的任务（通过 id 匹配）
  const generationIds = new Set(generations.map(g => g.id));
  const activeTasks = tasks.filter(t =>
    (t.status === 'queued' || t.status === 'pending' || t.status === 'processing') && !generationIds.has(t.id)
  );
  const failedTasks = tasks.filter(t => t.status === 'failed' || t.status === 'cancelled');

  const totalCount = generations.length + activeTasks.length;
  const visibleGenerations = useMemo(
    () => {
      const filtered = showMarkedOnly
        ? generations.filter(g => markedIds.has(g.id))
        : generations;
      return filtered.slice(0, visibleCount);
    },
    [generations, visibleCount, showMarkedOnly, markedIds]
  );
  const hasMoreGenerations = visibleCount < generations.length;

  useEffect(() => {
    if (!hasMoreGenerations) return;
    const target = renderMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        setVisibleCount((prev) => Math.min(prev + 12, generations.length));
      },
      { rootMargin: '200px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreGenerations, generations.length]);

  const handleRenderMore = () => {
    setVisibleCount((prev) => Math.min(prev + 12, generations.length));
  };

  // Escape 键关闭错误详情弹窗
  useEffect(() => {
    if (!selectedFailedTask) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedFailedTask(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFailedTask]);

  const handleCreateCharacter = async (start: number, end: number, extra?: { characterPrompt?: string; characterUserName?: string; firstFrameBase64?: string }) => {
    if (!characterTarget) return;
    try {
      await apiPost('/api/generate/character-card/from-task', {
        generationId: characterTarget.id,
        timestamps: `${start},${end}`,
        ...(extra?.characterPrompt ? { characterPrompt: extra.characterPrompt } : {}),
        ...(extra?.characterUserName ? { characterUserName: extra.characterUserName } : {}),
        ...(extra?.firstFrameBase64 ? { firstFrameBase64: extra.firstFrameBase64 } : {}),
      });

      toast({ title: '创建成功', description: '角色卡已生成' });
      setShowCharacterModal(false);
      setCharacterTarget(null);
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof ApiClientError ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div className="surface overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-card/40 border border-white/[0.06] rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-foreground">生成结果</h2>
                <p className="text-sm text-foreground/40">
                  {activeTasks.length > 0 ? `${activeTasks.length} 个任务进行中 · ` : ''}
                  {generations.length} 个作品
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onClear && generations.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('确定要清除当前显示的记录吗？\n\n注意：任务不会被删除，但会被隐藏不再显示。')) {
                      onClear(visibleGenerations.map(g => g.id));
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-card/40 text-foreground/55 border border-white/[0.06] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
                  title="清除当前显示的记录（不删除文件）"
                  aria-label="清除当前显示的记录"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">清除</span>
                </button>
              )}
              {markedIds.size > 0 && (
              <button
                onClick={() => setShowMarkedOnly(!showMarkedOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                  showMarkedOnly
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-card/40 text-foreground/55 border border-white/[0.06] hover:text-foreground'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{showMarkedOnly ? '显示全部' : `已标记 (${markedIds.size})`}</span>
              </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {totalCount === 0 && failedTasks.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/[0.08] rounded-xl">
              <div className="w-16 h-16 bg-card/40 rounded-2xl flex items-center justify-center mb-4">
                <ImageIcon className="w-8 h-8 text-foreground/20" />
              </div>
              <p className="text-foreground/40">暂无生成结果</p>
              <p className="text-foreground/20 text-sm mt-1">开始创作你的第一个作品</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {/* 正在进行的任务 */}
              {activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="group relative aspect-video bg-card/40 rounded-xl overflow-hidden border border-sky-500/30"
                >
                  {/* 加载动画背景 */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-sky-500/10 to-emerald-500/10">
                    <Loader2 className={`w-8 h-8 text-foreground/45 mb-2 ${task.status === 'queued' ? '' : 'animate-spin'}`} />
                    <p className="text-xs text-foreground/45">
                      {task.status === 'queued' ? '队列等待中...' : task.status === 'processing' ? '生成中...' : '排队中...'}
                    </p>
                    {/* 进度显示 */}
                    {typeof task.progress === 'number' && task.progress > 0 && (
                      <div className="mt-2 w-24">
                        <div className="h-1.5 bg-card/40 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-foreground/40 text-center mt-1">{task.progress}%</p>
                      </div>
                    )}
                  </div>
                  {/* 任务类型标签 */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-sky-500/40 backdrop-blur-sm rounded-md flex items-center gap-1">
                    {isTaskVideo(task) ? (
                      <>
                        <Play className="w-3 h-3 text-foreground" />
                        <span className="text-[10px] text-foreground">VIDEO</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3 h-3 text-foreground" />
                        <span className="text-[10px] text-foreground">IMAGE</span>
                      </>
                    )}
                  </div>
                  {/* 取消按钮 */}
                  {onRemoveTask && (
                    <button
                      onClick={() => onRemoveTask(task.id)}
                      className="absolute top-2 right-2 p-1.5 bg-card/40 border border-white/[0.06] backdrop-blur-sm rounded-md hover:bg-red-500/40 transition-colors"
                    >
                      <X className="w-3 h-3 text-foreground" />
                    </button>
                  )}
                  {/* 提示词 */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background/80 via-background/30 to-transparent">
                    <p className="text-xs text-foreground/65 truncate">{task.prompt || '无提示词'}</p>
                  </div>
                </div>
              ))}

              {/* 失败的任务 */}
              {failedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`group relative aspect-video bg-card/40 rounded-xl overflow-hidden border border-red-500/30 ${
                    task.errorMessage ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => task.errorMessage && setSelectedFailedTask(task)}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/10">
                    <AlertCircle className="w-8 h-8 text-red-300 mb-2" />
                    <p className="text-xs text-red-300">
                      {task.status === 'cancelled' ? '已取消' : '生成失败'}
                    </p>
                    {task.errorMessage && (
                      <>
                        <p className="text-xs text-red-300/70 mt-1 px-4 text-center truncate max-w-full">
                          {task.errorMessage}
                        </p>
                        <p className="text-[10px] text-red-300/50 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          点击查看详情
                        </p>
                      </>
                    )}
                  </div>
                  {/* 重试按钮 */}
                  {onRetryTask && isRetryableVideoError(task.errorMessage) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRetryTask(task); }}
                      className={`absolute top-2 ${onRemoveTask ? 'right-10' : 'right-2'} p-1.5 bg-card/40 border border-white/[0.06] backdrop-blur-sm rounded-md hover:bg-sky-500/40 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none`}
                      aria-label="重试生成"
                    >
                      <RotateCcw className="w-3 h-3 text-foreground" />
                    </button>
                  )}
                  {/* 移除按钮 */}
                  {onRemoveTask && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveTask(task.id); }}
                      className="absolute top-2 right-2 p-1.5 bg-card/40 border border-white/[0.06] backdrop-blur-sm rounded-md hover:bg-card/90 transition-colors"
                    >
                      <X className="w-3 h-3 text-foreground" />
                    </button>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background/80 via-background/30 to-transparent">
                    <p className="text-xs text-foreground/65 truncate">{task.prompt || '无提示词'}</p>
                  </div>
                </div>
              ))}

              {/* 已完成的生成结果 */}
              {visibleGenerations.map((gen, index) => (
                <div
                  key={gen.id}
                  className={`group relative aspect-video bg-card/40 rounded-xl overflow-hidden cursor-pointer border transition-all ${
                    markedIds.has(gen.id)
                      ? 'border-amber-500/50 ring-1 ring-amber-500/30'
                      : 'border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                  onClick={() => setSelected(gen)}
                >
                  {isVideo(gen) ? (
                    <>
                      <video
                        src={gen.resultUrl}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        preload="metadata"
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                      <div className="absolute top-2 left-2 px-2 py-1 bg-card/40 border border-white/[0.06] backdrop-blur-sm rounded-md flex items-center gap-1">
                        <span className="text-[10px] font-medium text-foreground">#{index + 1}</span>
                        <Play className="w-3 h-3 text-foreground" />
                      </div>
                    </>
                  ) : (
                    <>
                      <img
                        src={gen.resultUrl}
                        alt={gen.prompt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, gen.id)}
                      />
                      <div className="absolute top-2 left-2 px-2 py-1 bg-card/40 border border-white/[0.06] backdrop-blur-sm rounded-md">
                        <span className="text-[10px] font-medium text-foreground">#{index + 1}</span>
                      </div>
                    </>
                  )}
                  {/* 中心视觉提示 - 仅装饰 */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                    <div className="w-14 h-14 bg-background/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Maximize2 className="w-6 h-6 text-foreground" />
                    </div>
                  </div>

                  {/* 右上角操作区 - 仅下载 */}
                  <div
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(gen.resultUrl, gen.id, gen.type);
                      }}
                      className="w-8 h-8 bg-card/40 border border-white/[0.06] backdrop-blur-sm rounded-lg flex items-center justify-center text-foreground hover:bg-card/60 transition-colors"
                      title="下载"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background/80 via-background/30 to-transparent">
                    <p className="text-xs text-foreground/65 truncate">{gen.prompt || '无提示词'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {hasMoreGenerations && (
        <div ref={renderMoreRef} className="mt-6 flex items-center justify-center">
          <button
            type="button"
            onClick={handleRenderMore}
            className="px-4 py-2 rounded-lg bg-card/40 border border-white/[0.06] text-foreground/55 text-sm hover:text-foreground hover:border-white/[0.1] transition"
          >
            Load more
          </button>
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8"
          onClick={() => setSelected(null)}
        >
          <div className="w-full h-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-[90vw] max-h-[70vh] md:max-h-[75vh] flex items-center justify-center">
              {isVideo(selected) ? (
                <video
                  src={selected.resultUrl}
                  className="max-w-full max-h-[70vh] md:max-h-[75vh] w-auto h-auto rounded-xl border border-white/[0.06]"
                  controls
                  autoPlay
                  loop
                />
              ) : (
                <img
                  src={selected.resultUrl}
                  alt={selected.prompt}
                  className="max-w-full max-h-[70vh] md:max-h-[75vh] w-auto h-auto rounded-xl border border-white/[0.06] object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageError(e, selected.id)}
                />
              )}
            </div>

            <div className="w-full max-w-3xl mt-4 md:mt-6 px-2">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm leading-relaxed truncate md:whitespace-normal">{truncate(selected.prompt || '无提示词', 150)}</p>
                  <p className="text-foreground/40 text-xs mt-2">
                    {formatDate(selected.createdAt)} · 消耗 {selected.cost} 积分
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-foreground/30 text-xs shrink-0 w-14">URL</span>
                      <span className="text-foreground/55 text-xs break-all flex-1">{selected.resultUrl || '-'}</span>
                      {selected.resultUrl && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selected.resultUrl);
                            toast({ title: '已复制 URL' });
                          }}
                          className="shrink-0 p-1.5 text-foreground/30 hover:text-foreground hover:bg-card/40 rounded-lg transition-colors"
                          title="复制 URL"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {typeof selected.params?.permalink === 'string' && selected.params.permalink && (
                      <div className="flex items-start gap-2">
                        <span className="text-foreground/30 text-xs shrink-0 w-14">详情</span>
                        <a
                          href={selected.params.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground/55 text-xs break-all flex-1 hover:text-foreground underline underline-offset-2"
                        >
                          {selected.params.permalink}
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selected.params.permalink as string);
                            toast({ title: '已复制 Permalink' });
                          }}
                          className="shrink-0 p-1.5 text-foreground/30 hover:text-foreground hover:bg-card/40 rounded-lg transition-colors"
                          title="复制 Permalink"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={selected.params.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 p-1.5 text-foreground/30 hover:text-foreground hover:bg-card/40 rounded-lg transition-colors"
                          title="打开链接"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}

                    {typeof selected.params?.revised_prompt === 'string' && selected.params.revised_prompt && (
                      <div className="flex items-start gap-2">
                        <span className="text-foreground/30 text-xs shrink-0 w-14">改写</span>
                        <span className="text-foreground/55 text-xs break-words flex-1">{selected.params.revised_prompt}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selected.params.revised_prompt as string);
                            toast({ title: '已复制改写提示词' });
                          }}
                          className="shrink-0 p-1.5 text-foreground/30 hover:text-foreground hover:bg-card/40 rounded-lg transition-colors"
                          title="复制改写提示词"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 w-full md:w-auto">
                  {isVideo(selected) && selected.params?.videoId && (
                    <button
                      onClick={() => { setCharacterTarget(selected); setShowCharacterModal(true); }}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors text-sm font-medium"
                    >
                      <UserPlus className="w-4 h-4" />
                      创建角色
                    </button>
                  )}
                  <button
                    onClick={() => downloadFile(selected.resultUrl, selected.id, selected.type)}
                    className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-xl hover:opacity-90 transition-colors text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    下载
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-card/40 text-foreground border border-white/[0.06] rounded-xl hover:bg-card/60 transition-colors text-sm font-medium"
                  >
                    <X className="w-4 h-4" />
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 错误详情弹窗 */}
      {selectedFailedTask && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedFailedTask(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="error-modal-title"
        >
          <div
            className="bg-card/85 border border-red-500/30 rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 id="error-modal-title" className="text-lg font-medium text-foreground">
                  {selectedFailedTask.status === 'cancelled' ? '任务已取消' : '生成失败'}
                </h2>
                <p className="text-xs text-foreground/40">
                  {formatDate(selectedFailedTask.createdAt)}
                </p>
              </div>
            </div>

            {/* Error Message */}
            <div className="space-y-3">
              <div>
                <p className="text-xs text-foreground/40 mb-1">错误信息</p>
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-300 whitespace-pre-wrap break-words">
                    {selectedFailedTask.errorMessage}
                  </p>
                </div>
              </div>

              {/* Context Info */}
              {selectedFailedTask.prompt && (
                <div>
                  <p className="text-xs text-foreground/40 mb-1">提示词</p>
                  <p className="text-sm text-foreground/55 break-words">
                    {selectedFailedTask.prompt}
                  </p>
                </div>
              )}

              {selectedFailedTask.model && (
                <div>
                  <p className="text-xs text-foreground/40 mb-1">模型</p>
                  <p className="text-sm text-foreground/55">{selectedFailedTask.model}</p>
                </div>
              )}
            </div>

            {/* 重试按钮 */}
            {onRetryTask && isRetryableVideoError(selectedFailedTask.errorMessage) && (
              <button
                onClick={() => { onRetryTask(selectedFailedTask); setSelectedFailedTask(null); }}
                className="mt-6 w-full py-2.5 bg-sky-500/20 border border-sky-500/30 text-sky-300 rounded-xl hover:bg-sky-500/30 transition-colors text-sm font-medium"
              >
                重试生成
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={() => setSelectedFailedTask(null)}
              className={`${onRetryTask && isRetryableVideoError(selectedFailedTask.errorMessage) ? 'mt-3' : 'mt-6'} w-full py-2.5 bg-card/40 border border-white/[0.06] text-foreground rounded-xl hover:bg-card/60 transition-colors text-sm font-medium`}
              autoFocus
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 创建角色卡弹窗 */}
      <TimestampSelectorModal
        isOpen={showCharacterModal}
        videoUrl={characterTarget?.resultUrl || ''}
        onClose={() => { setShowCharacterModal(false); setCharacterTarget(null); }}
        onConfirm={handleCreateCharacter}
        showCharacterFields={characterTarget?.params?.videoChannelType === 'kie-ai'}
      />
    </>
  );
}
