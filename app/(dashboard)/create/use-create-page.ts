'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { compressImageToWebP, fileToBase64 } from '@/lib/image-compression';
import { notify } from '@/lib/toast-utils';
import { getPollingInterval, shouldContinuePolling, isHardTimeout } from '@/lib/polling-utils';
import { isGenerationHidden, addHiddenGenerationIds } from '@/lib/hidden-generations';
import type {
  MediaType,
  CreationMode,
  DailyUsage,
  Task,
  Generation,
  SafeImageModel,
  SafeVideoModel,
  CharacterCard,
} from './types';
import { getImageResolution } from './types';
import type {
  SafeImageChannel,
  SafeVideoChannel,
  DailyLimitConfig,
} from '@/types';

export function useCreatePage() {
  const { update } = useSession();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const remixPromptRef = useRef<HTMLTextAreaElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const updateRef = useRef(update);
  useEffect(() => { updateRef.current = update; }, [update]);

  // Media type (image/video)
  const [mediaType, setMediaType] = useState<MediaType>(() => {
    const mode = searchParams.get('mode');
    return mode === 'video' ? 'video' : 'image';
  });

  // Shared state
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressedCache, setCompressedCache] = useState<Map<File, string>>(new Map());
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [keepPrompt, setKeepPrompt] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  // Daily limits
  const [dailyUsage, setDailyUsage] = useState<DailyUsage>({ imageCount: 0, videoCount: 0, characterCardCount: 0 });
  const [dailyLimits, setDailyLimits] = useState<DailyLimitConfig>({ imageLimit: 0, videoLimit: 0, characterCardLimit: 0 });

  // Image state
  const [imageModels, setImageModels] = useState<SafeImageModel[]>([]);
  const [imageChannels, setImageChannels] = useState<SafeImageChannel[]>([]);
  const [selectedImageChannelId, setSelectedImageChannelId] = useState('');
  const [imageAspectRatio, setImageAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');

  // Video state
  const [videoModels, setVideoModels] = useState<SafeVideoModel[]>([]);
  const [videoChannels, setVideoChannels] = useState<SafeVideoChannel[]>([]);
  const [selectedVideoChannelId, setSelectedVideoChannelId] = useState('');
  const [selectedVideoModelId, setSelectedVideoModelId] = useState('');
  const [videoAspectRatio, setVideoAspectRatio] = useState('landscape');
  const [videoDuration, setVideoDuration] = useState('10s');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [creationMode, setCreationMode] = useState<CreationMode>('normal');
  const [remixUrl, setRemixUrl] = useState('');
  const [storyboardPrompt, setStoryboardPrompt] = useState('');

  // Character cards
  const [characterCards, setCharacterCards] = useState<CharacterCard[]>([]);
  const [showCharacterMenu, setShowCharacterMenu] = useState(false);

  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Computed: current image channel
  const currentImageChannel = useMemo(
    () => imageChannels.find((c) => c.id === selectedImageChannelId) || imageChannels[0],
    [imageChannels, selectedImageChannelId]
  );

  // Computed: image models for current channel
  const channelImageModels = useMemo(
    () => (currentImageChannel ? imageModels.filter((m) => m.channelId === currentImageChannel.id) : []),
    [imageModels, currentImageChannel]
  );

  // Computed: auto-selected image model (for UI capabilities like aspectRatios, features)
  const currentImageModel = useMemo(() => {
    if (channelImageModels.length === 0) return undefined;
    const hasImages = files.length > 0;
    if (hasImages) {
      const i2i = channelImageModels.find((m) => m.features.imageToImage);
      if (i2i) return i2i;
    }
    return channelImageModels.find((m) => m.features.textToImage) || channelImageModels[0];
  }, [channelImageModels, files.length]);

  // Computed: aggregate imageSizes from all models in the channel
  const aggregatedImageSizes = useMemo(() => {
    const sizesSet = new Set<string>();
    for (const m of channelImageModels) {
      if (m.features.imageSize && m.imageSizes) {
        for (const s of m.imageSizes) sizesSet.add(s);
      }
    }
    const order = ['1K', '2K', '4K'];
    return Array.from(sizesSet).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [channelImageModels]);

  // Computed: current video channel
  const currentVideoChannel = useMemo(
    () => videoChannels.find((c) => c.id === selectedVideoChannelId) || videoChannels[0],
    [videoChannels, selectedVideoChannelId]
  );

  // Computed: video models for current channel
  const channelVideoModels = useMemo(
    () => (currentVideoChannel ? videoModels.filter((m) => m.channelId === currentVideoChannel.id) : []),
    [videoModels, currentVideoChannel]
  );

  // Computed: auto-selected video model
  const currentVideoModel = useMemo(() => {
    const imageCount = files.filter(f => f.file.type?.startsWith('image/')).length;
    if (imageCount >= 2) {
      const r2v = channelVideoModels.find((m) => m.features.referenceToVideo);
      if (r2v) return r2v;
      const i2v = channelVideoModels.find((m) => m.features.imageToVideo);
      if (i2v) return i2v;
    } else if (imageCount === 1) {
      const i2v = channelVideoModels.find((m) => m.features.imageToVideo);
      if (i2v) return i2v;
    }
    const selected = channelVideoModels.find((m) => m.id === selectedVideoModelId);
    if (selected) return selected;
    return channelVideoModels.find((m) => m.features.textToVideo) || channelVideoModels[0];
  }, [channelVideoModels, selectedVideoModelId, files]);

  // Load image models + channels
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/image-models');
        if (res.ok) {
          const data = await res.json();
          const models = data.data?.models || [];
          const channels = data.data?.channels || [];
          setImageModels(models);
          setImageChannels(channels);
          if (channels.length > 0 && !selectedImageChannelId) {
            setSelectedImageChannelId(channels[0].id);
            const firstChannelModels = models.filter((m: SafeImageModel) => m.channelId === channels[0].id);
            if (firstChannelModels.length > 0) {
              setImageAspectRatio(firstChannelModels[0].defaultAspectRatio);
              if (firstChannelModels[0].defaultImageSize) setImageSize(firstChannelModels[0].defaultImageSize);
            }
          }
        }
      } catch (err) { console.error('Failed to load image models:', err); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load video models + channels
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/video-models');
        if (res.ok) {
          const data = await res.json();
          const models = data.data?.models || [];
          const channels = data.data?.channels || [];
          setVideoModels(models);
          setVideoChannels(channels);
          if (channels.length > 0 && !selectedVideoChannelId) setSelectedVideoChannelId(channels[0].id);
          if (models.length > 0 && !selectedVideoModelId) {
            setSelectedVideoModelId(models[0].id);
            setVideoAspectRatio(models[0].defaultAspectRatio);
            setVideoDuration(models[0].defaultDuration);
          }
        }
      } catch (err) { console.error('Failed to load video models:', err); }
      setModelsLoaded(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load daily usage
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/daily-usage');
        if (res.ok) {
          const data = await res.json();
          setDailyUsage(data.data.usage);
          setDailyLimits(data.data.limits);
        }
      } catch (err) { console.error('Failed to load daily usage:', err); }
    })();
  }, []);

  // Load character cards
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/character-cards');
        if (res.ok) {
          const data = await res.json();
          setCharacterCards((data.data || []).filter((c: CharacterCard) => c.status === 'completed' && c.characterName));
        }
      } catch (err) { console.error('Failed to load character cards:', err); }
    })();
  }, []);

  // Reset image params when channel changes
  useEffect(() => {
    if (currentImageModel) {
      setImageAspectRatio(currentImageModel.defaultAspectRatio);
      if (currentImageModel.defaultImageSize) setImageSize(currentImageModel.defaultImageSize);
    }
  }, [selectedImageChannelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset video params when channel changes
  useEffect(() => {
    if (channelVideoModels.length > 0) {
      const auto = channelVideoModels.find((m) => m.features.textToVideo) || channelVideoModels[0];
      if (auto) {
        setSelectedVideoModelId(auto.id);
        setVideoAspectRatio(auto.defaultAspectRatio);
        setVideoDuration(auto.defaultDuration);
      }
    }
  }, [selectedVideoChannelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered generations/tasks by media type
  const displayedGenerations = useMemo(
    () => generations.filter((g) => (mediaType === 'image' ? !g.type.includes('video') : g.type.includes('video') || g.type.includes('sora'))),
    [generations, mediaType]
  );

  const displayedTasks = useMemo(
    () => tasks.filter((t) => {
      const isVideoTask = t.type?.includes('video') || t.type?.includes('sora');
      return mediaType === 'image' ? !isVideoTask : isVideoTask;
    }),
    [tasks, mediaType]
  );

  // Poll task status
  const pollTaskStatus = useCallback(async (taskId: string, taskPrompt: string, taskType: 'image' | 'video') => {
    if (abortControllersRef.current.has(taskId)) return;
    const controller = new AbortController();
    abortControllersRef.current.set(taskId, controller);
    const startTime = Date.now();
    let consecutiveErrors = 0;

    const poll = async (): Promise<void> => {
      if (controller.signal.aborted) return;
      const elapsed = Date.now() - startTime;
      if (!shouldContinuePolling(elapsed, taskType)) {
        if (taskType !== 'video' || isHardTimeout(elapsed, taskType)) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'failed' as const, errorMessage: '任务超时' } : t)));
          abortControllersRef.current.delete(taskId);
          return;
        }
      }
      try {
        const res = await fetch(`/api/generate/status/${taskId}`, { signal: controller.signal });
        if (res.status >= 500) throw new Error(`Server Error: ${res.status}`);
        const ct = res.headers.get('content-type');
        if (!ct?.includes('application/json')) throw new Error('Invalid response format');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '查询任务状态失败');
        consecutiveErrors = 0;
        const status = data.data.status;
        const resultUrl = typeof data.data.url === 'string' ? data.data.url : '';

        if ((status === 'completed' || status === 'succeeded') && (taskType === 'image' || resultUrl)) {
          if (updateRef.current) updateRef.current().catch(console.error);
          if (!isGenerationHidden(data.data.id)) {
            setGenerations((prev) => {
              if (prev.some((g) => g.id === data.data.id)) return prev;
              return [{
                id: data.data.id, userId: '', type: data.data.type, prompt: taskPrompt,
                params: data.data.params || {}, resultUrl: resultUrl || data.data.url, cost: data.data.cost,
                status: 'completed', createdAt: data.data.createdAt, updatedAt: data.data.updatedAt,
              }, ...prev];
            });
            notify.success('生成成功', `消耗 ${data.data.cost} 积分`);
          }
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
          abortControllersRef.current.delete(taskId);
        } else if (status === 'failed' || status === 'cancelled') {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'failed' as const, errorMessage: data.data.errorMessage || '生成失败' } : t)));
          abortControllersRef.current.delete(taskId);
        } else {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: (status === 'queued' || status === 'pending' || status === 'processing' ? status : 'processing') as 'queued' | 'pending' | 'processing', progress: typeof data.data.progress === 'number' ? data.data.progress : t.progress } : t)));
          setTimeout(poll, getPollingInterval(elapsed, taskType));
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        consecutiveErrors++;
        const errMsg = (err as Error).message || '网络错误';
        const isTransient = /socket|ECONNRESET|ETIMEDOUT|network|fetch|Server Error|Invalid response|Unexpected token|JSON/i.test(errMsg);
        if (isTransient && consecutiveErrors < 5) {
          setTimeout(poll, Math.min(5000 * Math.pow(2, consecutiveErrors - 1), 60000));
          return;
        }
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'failed' as const, errorMessage: errMsg } : t)));
        abortControllersRef.current.delete(taskId);
      }
    };
    poll();
  }, []);

  // Load initial tasks + history
  useEffect(() => {
    const controllers = abortControllersRef.current;
    (async () => {
      try {
        const [tasksRes, historyRes] = await Promise.all([
          fetch('/api/user/tasks'),
          fetch('/api/user/history?limit=30'),
        ]);
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          const allTasks: Task[] = (data.data || []).map((t: any) => ({
            id: t.id, prompt: t.prompt, type: t.type,
            status: t.status as 'queued' | 'pending' | 'processing', createdAt: t.createdAt,
          }));
          if (allTasks.length > 0) {
            setTasks(allTasks);
            allTasks.forEach((task) => {
              const isVideo = task.type?.includes('video') || task.type?.includes('sora');
              pollTaskStatus(task.id, task.prompt, isVideo ? 'video' : 'image');
            });
          }
        }
        if (historyRes.ok) {
          const data = await historyRes.json();
          const recent: Generation[] = (data.data || []).filter(
            (g: any) => g.status === 'completed' && g.resultUrl && !isGenerationHidden(g.id)
          );
          if (recent.length > 0) setGenerations(recent);
        }
      } catch (err) { console.error('Failed to load initial data:', err); }
    })();
    return () => { controllers.forEach((c) => c.abort()); controllers.clear(); };
  }, [pollTaskStatus]);

  // File handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    for (const file of selected) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 15 * 1024 * 1024) { notify.error('图片过大', '限制 15MB'); continue; }
      setFiles((prev) => [...prev, { file, preview: URL.createObjectURL(file) }]);
    }
    e.target.value = '';
  };

  const clearFiles = () => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setCompressedCache(new Map());
  };

  const compressFilesIfNeeded = async (): Promise<Array<{ mimeType: string; data: string }>> => {
    if (files.length === 0) return [];
    setCompressing(true);
    try {
      const results: Array<{ mimeType: string; data: string }> = [];
      const nextCache = new Map(compressedCache);
      for (const { file } of files) {
        const cached = nextCache.get(file);
        if (cached) { results.push({ mimeType: 'image/jpeg', data: cached }); continue; }
        try {
          const compressed = await compressImageToWebP(file);
          const base64 = await fileToBase64(compressed);
          nextCache.set(file, base64);
          results.push({ mimeType: 'image/jpeg', data: base64 });
        } catch {
          const base64 = await fileToBase64(file);
          results.push({ mimeType: file.type || 'image/jpeg', data: base64 });
        }
      }
      setCompressedCache(nextCache);
      return results;
    } finally { setCompressing(false); }
  };

  // Enhance prompt
  const handleEnhancePrompt = async () => {
    const currentPrompt = mediaType === 'video' && creationMode === 'storyboard' ? storyboardPrompt : prompt;
    if (!currentPrompt.trim()) { notify.error('请先输入提示词'); return; }
    setEnhancing(true);
    try {
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt.trim(), expansion_level: 'medium' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提示词增强失败');
      if (data.data?.enhanced_prompt) {
        if (mediaType === 'video' && creationMode === 'storyboard') setStoryboardPrompt(data.data.enhanced_prompt);
        else setPrompt(data.data.enhanced_prompt);
        notify.success('提示词已增强');
      }
    } catch (err) {
      notify.error('增强失败', err instanceof Error ? err.message : '请稍后重试');
    } finally { setEnhancing(false); }
  };

  // Validate
  const validateInput = (): string | null => {
    if (mediaType === 'image') {
      if (!currentImageChannel) return '请选择渠道';
      if (dailyLimits.imageLimit > 0 && dailyUsage.imageCount >= dailyLimits.imageLimit) return `今日图像生成次数已达上限 (${dailyLimits.imageLimit} 次)`;
      if (currentImageModel?.requiresReferenceImage && files.length === 0) return '请上传参考图';
      if (currentImageModel?.channelType === 'gemini') {
        if (!prompt.trim() && files.length === 0) return '请输入提示词或上传参考图片';
      } else if (!currentImageModel?.allowEmptyPrompt && !prompt.trim()) return '请输入提示词';
    } else {
      if (!currentVideoModel) return '请选择模型';
      if (dailyLimits.videoLimit > 0 && dailyUsage.videoCount >= dailyLimits.videoLimit) return `今日视频生成次数已达上限 (${dailyLimits.videoLimit} 次)`;
      if (creationMode === 'remix' && !remixUrl.trim()) return '请输入视频分享链接或ID';
      if (creationMode === 'storyboard' && !storyboardPrompt.trim()) return '请输入分镜提示词';
      if (creationMode === 'normal' && !prompt.trim() && files.length === 0) return '请输入提示词或上传参考素材';
    }
    return null;
  };

  // Submit
  const handleSubmit = async (gachaCount = 1) => {
    const errMsg = validateInput();
    if (errMsg) { setError(errMsg); return; }
    setError('');
    setSubmitting(true);

    try {
      const compressedFiles = await compressFilesIfNeeded();
      const taskPrompt = (mediaType === 'video' && creationMode === 'storyboard') ? storyboardPrompt.trim() : prompt.trim();

      for (let i = 0; i < gachaCount; i++) {
        let taskId: string;
        let taskStatus: 'queued' | 'pending' = 'pending';
        if (mediaType === 'image') {
          const payload = {
            channelId: selectedImageChannelId,
            prompt: taskPrompt,
            aspectRatio: imageAspectRatio,
            imageSize: aggregatedImageSizes.length > 0 ? imageSize : undefined,
            images: compressedFiles,
          };
          const res = await fetch('/api/generate/image', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '生成失败');
          taskId = data.data.id;
          if (data.data.status === 'queued') taskStatus = 'queued';
        } else {
          const remixTargetId = creationMode === 'remix' && remixUrl.trim()
            ? (remixUrl.trim().match(/s_[a-f0-9]+/i)?.[0] || remixUrl.trim())
            : undefined;
          const payload = {
            channelId: selectedVideoChannelId,
            modelId: currentVideoModel?.id,
            prompt: creationMode === 'remix' ? prompt.trim() : taskPrompt,
            aspectRatio: videoAspectRatio,
            duration: videoDuration,
            files: creationMode === 'normal' ? compressedFiles : [],
            remix_target_id: remixTargetId,
            style_id: creationMode === 'normal' ? selectedStyle || undefined : undefined,
          };
          const res = await fetch('/api/generate/sora', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '生成失败');
          taskId = data.data.id;
          if (data.data.status === 'queued') taskStatus = 'queued';
        }

        const newTask: Task = {
          id: taskId, prompt: taskPrompt,
          type: mediaType === 'image' ? 'image' : 'sora-video',
          status: taskStatus, createdAt: Date.now(),
        };
        setTasks((prev) => [newTask, ...prev]);
        pollTaskStatus(taskId, taskPrompt, mediaType);
      }

      // Update daily usage
      if (mediaType === 'image') setDailyUsage((prev) => ({ ...prev, imageCount: prev.imageCount + gachaCount }));
      else setDailyUsage((prev) => ({ ...prev, videoCount: prev.videoCount + gachaCount }));

      if (gachaCount > 1) notify.success('抽卡模式已启动', `已提交 ${gachaCount} 个相同任务`);

      if (!keepPrompt) {
        if (creationMode === 'remix') { setRemixUrl(''); setPrompt(''); }
        else if (creationMode === 'storyboard') setStoryboardPrompt('');
        else { setPrompt(''); clearFiles(); }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally { setSubmitting(false); setCompressing(false); }
  };

  const handleRemoveTask = useCallback(async (taskId: string) => {
    const controller = abortControllersRef.current.get(taskId);
    if (controller) { controller.abort(); abortControllersRef.current.delete(taskId); }
    try { await fetch(`/api/user/tasks/${taskId}`, { method: 'DELETE' }); } catch {}
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const handleRetryTask = useCallback(async (task: Task) => {
    try {
      const res = await fetch('/api/generate/sora/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId: task.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '重试失败');

      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: 'processing' as const, errorMessage: undefined, progress: 0 } : t
      ));

      const isVideo = task.type?.includes('video') || task.type?.includes('sora');
      pollTaskStatus(task.id, task.prompt, isVideo ? 'video' : 'image');

      notify.info('重试中', '正在恢复视频生成...');
    } catch (err) {
      notify.error('重试失败', (err as Error).message);
    }
  }, [pollTaskStatus]);

  const handleClearGenerations = useCallback((ids: string[]) => {
    addHiddenGenerationIds(ids);
    setGenerations((prev) => prev.filter((g) => !ids.includes(g.id)));
  }, []);

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    for (const file of droppedFiles) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 15 * 1024 * 1024) { notify.error('图片过大', '限制 15MB'); continue; }
      setFiles((prev) => [...prev, { file, preview: URL.createObjectURL(file) }]);
    }
  };

  // Character card @ mention
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>, setter: (v: string) => void) => {
    const val = e.target.value;
    setter(val);
    if (val.endsWith('@') && characterCards.length > 0) setShowCharacterMenu(true);
    else setShowCharacterMenu(false);
  };
  const handleAddCharacter = (name: string) => {
    const currentPrompt = prompt;
    const idx = currentPrompt.lastIndexOf('@');
    if (idx >= 0) setPrompt(currentPrompt.slice(0, idx) + `@${name} `);
    else setPrompt(currentPrompt + `@${name} `);
    setShowCharacterMenu(false);
  };

  // Resolution display for image mode (kept for potential future use)
  const getCurrentResolutionDisplay = () => {
    if (!currentImageModel) return '';
    if (aggregatedImageSizes.length > 0) {
      const sizeModel = channelImageModels.find(
        (m) => m.features.imageSize && m.imageSizes?.includes(imageSize)
      );
      if (sizeModel) return getImageResolution(sizeModel, imageAspectRatio, imageSize);
    }
    return getImageResolution(currentImageModel, imageAspectRatio, imageSize);
  };

  const isLimitReached = mediaType === 'image'
    ? dailyLimits.imageLimit > 0 && dailyUsage.imageCount >= dailyLimits.imageLimit
    : dailyLimits.videoLimit > 0 && dailyUsage.videoCount >= dailyLimits.videoLimit;

  const hasNoChannels = mediaType === 'image' ? imageChannels.length === 0 : videoChannels.length === 0;

  const dailyLimit = mediaType === 'image' ? dailyLimits.imageLimit : dailyLimits.videoLimit;
  const dailyCount = mediaType === 'image' ? dailyUsage.imageCount : dailyUsage.videoCount;

  // Suppress unused variable warning
  void getCurrentResolutionDisplay;

  return {
    // Refs
    fileInputRef,
    promptTextareaRef,
    remixPromptRef,

    // Media type
    mediaType,
    setMediaType,

    // Prompt & creation mode
    prompt,
    setPrompt,
    creationMode,
    setCreationMode,
    storyboardPrompt,
    setStoryboardPrompt,
    remixUrl,
    setRemixUrl,

    // Files
    files,
    isDragging,
    compressing,

    // Generations & tasks
    displayedGenerations,
    displayedTasks,

    // Image settings
    imageChannels,
    selectedImageChannelId,
    setSelectedImageChannelId,
    currentImageModel,
    imageAspectRatio,
    setImageAspectRatio,
    aggregatedImageSizes,
    imageSize,
    setImageSize,

    // Video settings
    videoChannels,
    selectedVideoChannelId,
    setSelectedVideoChannelId,
    currentVideoModel,
    videoDuration,
    setVideoDuration,
    videoAspectRatio,
    setVideoAspectRatio,
    selectedStyle,
    setSelectedStyle,
    showStylePanel,
    setShowStylePanel,

    // Character cards
    characterCards,
    showCharacterMenu,
    setShowCharacterMenu,

    // UI state
    submitting,
    error,
    keepPrompt,
    setKeepPrompt,
    enhancing,
    modelsLoaded,

    // Computed
    isLimitReached,
    hasNoChannels,
    dailyLimit,
    dailyCount,

    // Handlers
    handleFileUpload,
    clearFiles,
    handleEnhancePrompt,
    handleSubmit,
    handleRemoveTask,
    handleRetryTask,
    handleClearGenerations,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePromptChange,
    handleAddCharacter,
  };
}
