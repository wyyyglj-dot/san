'use client';

import * as React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, FileText, Sparkles, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Episode } from '@/components/episodes/types';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import { ShotBlock } from './shot-block';

interface Block {
  id: string;
  text: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface EpisodeOverviewProps {
  episode: Episode;
}

function contentToBlocks(content: string | undefined | null): Block[] {
  const raw = typeof content === 'string' ? content : '';
  const lines = raw.split(/\r?\n/);
  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
    return [];
  }
  return lines.map((text) => ({ id: crypto.randomUUID(), text }));
}

function blocksToContent(blocks: Block[]): string {
  return blocks.map((b) => b.text).join('\n');
}

export function EpisodeOverview({ episode }: EpisodeOverviewProps) {
  const analyzeAssets = useWorkspaceStore((s) => s.analyzeAssets);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const generateStoryboard = useWorkspaceStore((s) => s.generateStoryboard);
  const updateEpisodeContent = useWorkspaceStore((s) => s.updateEpisodeContent);
  const storyboardStatus = useWorkspaceStore(
    (s) => s.storyboardStatus[episode.id] ?? 'idle',
  );
  const isGenerating = storyboardStatus === 'generating';

  const [blocks, setBlocks] = React.useState<Block[]>(() =>
    contentToBlocks(episode.content),
  );
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');

  const blockRefs = React.useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const pendingFocus = React.useRef<{ blockId: string; cursorPos: number } | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const latestBlocksRef = React.useRef(blocks);
  latestBlocksRef.current = blocks;

  // --- episode.id 变化时重置 blocks ---
  const prevEpisodeIdRef = React.useRef(episode.id);
  React.useEffect(() => {
    if (prevEpisodeIdRef.current !== episode.id) {
      prevEpisodeIdRef.current = episode.id;
      setBlocks(contentToBlocks(episode.content));
      setSaveStatus('idle');
    }
  }, [episode.id, episode.content]);

  // --- 外部内容变化同步（AI 生成完成后） ---
  React.useEffect(() => {
    if (isGenerating) return;
    const currentContent = blocksToContent(latestBlocksRef.current);
    if (episode.content !== currentContent) {
      setBlocks(contentToBlocks(episode.content));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode.content, isGenerating]);

  // --- Debounce 自动保存 ---
  const triggerSave = React.useCallback(
    (newBlocks: Block[]) => {
      clearTimeout(saveTimerRef.current);
      setSaveStatus('saving');
      saveTimerRef.current = setTimeout(async () => {
        const content = blocksToContent(newBlocks);
        if (!content.trim()) {
          setSaveStatus('error');
          return;
        }
        const ok = await updateEpisodeContent(episode.id, content);
        setSaveStatus(ok ? 'saved' : 'error');
        if (ok) {
          setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
        }
      }, 500);
    },
    [episode.id, updateEpisodeContent],
  );

  // --- Unmount flush ---
  React.useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current);
      const content = blocksToContent(latestBlocksRef.current);
      if (content.trim()) {
        void updateEpisodeContent(episode.id, content);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode.id]);

  // --- 焦点管理（useLayoutEffect 确保在 Paint 前同步执行） ---
  React.useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const { blockId, cursorPos } = pendingFocus.current;
    const ta = blockRefs.current.get(blockId);
    if (ta) {
      pendingFocus.current = null;
      ta.focus();
      const safePos = Math.min(cursorPos, ta.value.length);
      ta.setSelectionRange(safePos, safePos);
    }
    // ref 尚未注册时不清除 pendingFocus，等下次渲染重试
  });

  // --- Block 操作 ---
  const handleBlockChange = React.useCallback(
    (blockId: string, text: string) => {
      let savedBlocks: Block[] | undefined;
      setBlocks((prev) => {
        const updated = prev.map((b) => (b.id === blockId ? { ...b, text } : b));
        savedBlocks = updated;
        return updated;
      });
      if (savedBlocks) triggerSave(savedBlocks);
    },
    [triggerSave],
  );

  const handleEnter = React.useCallback(
    (blockId: string, cursorPos: number) => {
      const newId = crypto.randomUUID();
      let savedBlocks: Block[] | undefined;
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === blockId);
        if (idx === -1) return prev;
        const block = prev[idx];
        const before = block.text.slice(0, cursorPos);
        const after = block.text.slice(cursorPos);
        const newBlock: Block = { id: newId, text: after };
        const updated = [...prev];
        updated[idx] = { ...block, text: before };
        updated.splice(idx + 1, 0, newBlock);
        savedBlocks = updated;
        return updated;
      });
      pendingFocus.current = { blockId: newId, cursorPos: 0 };
      if (savedBlocks) triggerSave(savedBlocks);
    },
    [triggerSave],
  );

  const handleBackspaceAtStart = React.useCallback(
    (blockId: string) => {
      let savedBlocks: Block[] | undefined;
      let focusTarget: { blockId: string; cursorPos: number } | null = null;
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === blockId);
        if (idx <= 0) return prev;
        const current = prev[idx];
        const previous = prev[idx - 1];
        const mergedText = previous.text + current.text;
        const cursorPos = previous.text.length;
        const updated = prev.filter((_, i) => i !== idx);
        updated[idx - 1] = { ...previous, text: mergedText };
        focusTarget = { blockId: previous.id, cursorPos };
        savedBlocks = updated;
        return updated;
      });
      if (focusTarget) pendingFocus.current = focusTarget;
      if (savedBlocks) triggerSave(savedBlocks);
    },
    [triggerSave],
  );

  const handleArrowUp = React.useCallback((blockId: string) => {
    const blocks = latestBlocksRef.current;
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx <= 0) return;
    const target = blocks[idx - 1];
    const ta = blockRefs.current.get(target.id);
    if (ta) {
      ta.focus();
      const pos = target.text.length;
      ta.setSelectionRange(pos, pos);
    }
  }, []);

  const handleArrowDown = React.useCallback((blockId: string) => {
    const blocks = latestBlocksRef.current;
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1 || idx >= blocks.length - 1) return;
    const target = blocks[idx + 1];
    const ta = blockRefs.current.get(target.id);
    if (ta) {
      ta.focus();
      ta.setSelectionRange(0, 0);
    }
  }, []);

  const handleEmptyClick = React.useCallback(() => {
    const newBlock: Block = { id: crypto.randomUUID(), text: '' };
    setBlocks([newBlock]);
    pendingFocus.current = { blockId: newBlock.id, cursorPos: 0 };
  }, []);

  // --- 稳定的 ref callback 缓存，避免每次渲染创建新函数导致 ref 抖动 ---
  const refCallbacks = React.useRef(new Map<string, (el: HTMLTextAreaElement | null) => void>());

  const registerRef = React.useCallback(
    (blockId: string) => {
      let cb = refCallbacks.current.get(blockId);
      if (!cb) {
        cb = (el: HTMLTextAreaElement | null) => {
          if (el) {
            blockRefs.current.set(blockId, el);
          } else {
            blockRefs.current.delete(blockId);
            refCallbacks.current.delete(blockId);
          }
        };
        refCallbacks.current.set(blockId, cb);
      }
      return cb;
    },
    [],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-6 border-b border-white/[0.06] flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="h-6 px-2 text-xs font-mono">
              EP {episode.orderNum}
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight">{episode.title || '未命名剧集'}</h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-foreground/55">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{new Date(episode.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>{episode.content?.length || 0} 字</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus !== 'idle' && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-medium transition-all duration-300',
                saveStatus === 'saving' && 'text-brand/60 bg-brand/5',
                saveStatus === 'saved' && 'text-green-500/60 bg-green-500/5',
                saveStatus === 'error' && 'text-red-500/60 bg-red-500/5',
              )}
            >
              {saveStatus === 'saving' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {saveStatus === 'saving' ? '保存中' : saveStatus === 'saved' ? '已保存' : '保存失败'}
            </span>
          )}

          <Button
            size="sm"
            onClick={() => {
              void analyzeAssets();
              setActiveTab('assets');
            }}
            className="gap-2 bg-purple-600/15 text-purple-200 hover:bg-purple-600/25 border border-purple-500/30"
          >
            <Sparkles className="h-4 w-4" />
            资产分析
          </Button>

          <Button
            size="sm"
            disabled={isGenerating}
            onClick={() => void generateStoryboard(episode.id)}
            className="gap-2 bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {isGenerating ? '生成中...' : 'AI 一键分镜'}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <section>
            <h3 className="text-sm font-medium text-foreground/55 mb-4 uppercase tracking-wider">
              剧本内容
            </h3>
            <Card className="bg-card/60 border-dashed overflow-hidden">
              <CardContent className="p-0">
                {blocks.length > 0 ? (
                  <ol className="divide-y divide-white/[0.05] list-none m-0 p-0">
                    {blocks.map((block, index) => (
                      <ShotBlock
                        key={block.id}
                        index={index}
                        text={block.text}
                        disabled={isGenerating}
                        textareaRef={registerRef(block.id)}
                        onChange={(text) => handleBlockChange(block.id, text)}
                        onEnter={(pos) => handleEnter(block.id, pos)}
                        onBackspaceAtStart={() => handleBackspaceAtStart(block.id)}
                        onMergeUp={index > 0 ? () => handleBackspaceAtStart(block.id) : undefined}
                        onArrowUp={() => handleArrowUp(block.id)}
                        onArrowDown={() => handleArrowDown(block.id)}
                      />
                    ))}
                  </ol>
                ) : (
                  <button
                    type="button"
                    className="w-full p-12 text-center text-foreground/40 cursor-text hover:bg-accent/5 focus:bg-accent/5 transition-colors outline-none"
                    onClick={handleEmptyClick}
                  >
                    <p className="italic text-sm mb-1">暂无分镜内容</p>
                    <p className="text-xs">点击此处开始编写</p>
                  </button>
                )}
              </CardContent>
            </Card>
          </section>

          {episode.note && (
            <section>
              <h3 className="text-sm font-medium text-foreground/55 mb-4 uppercase tracking-wider">
                备注
              </h3>
              <p className="text-sm text-foreground/60">{episode.note}</p>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
