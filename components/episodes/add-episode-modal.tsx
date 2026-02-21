'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Maximize2, Minimize2 } from 'lucide-react';
import { EpisodeStepper } from './episode-stepper';
import { CreationModeSelector } from '@/components/projects/creation-mode-selector';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/toast-utils';
import { apiPost, ApiClientError } from '@/lib/api-client';

interface AddEpisodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  nextOrderNum: number;
  onSuccess: () => void;
}

export function AddEpisodeModal({
  open,
  onOpenChange,
  projectId,
  nextOrderNum,
  onSuccess,
}: AddEpisodeModalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [orderNum, setOrderNum] = useState(nextOrderNum);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [continueCreate, setContinueCreate] = useState(false);
  const [mode, setMode] = useState('default');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setOrderNum(nextOrderNum);
      setTitle(`第${nextOrderNum}集`);
      setContent('');
      setIsExpanded(false);
      setMode('default');
    }
  }, [open, nextOrderNum]);

  useEffect(() => {
    if (/^第\d+集$/.test(title)) {
      setTitle(`第${orderNum}集`);
    }
  }, [orderNum]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      notify.error('请输入剧本内容');
      return;
    }

    try {
      setIsSubmitting(true);
      await apiPost(`/api/projects/${projectId}/episodes`, {
        orderNum,
        title: title.trim() || `第${orderNum}集`,
        content,
        sourceType: 'manual',
        mode,
      });

      notify.success('剧集创建成功');
      onSuccess();

      if (continueCreate) {
        const next = orderNum + 1;
        setOrderNum(next);
        setTitle(`第${next}集`);
        setContent('');
        setTimeout(() => contentRef.current?.focus(), 100);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        notify.error('序号已存在，请修改序号');
      } else {
        notify.fromError(err, '创建失败');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'transition-[max-width] duration-300 ease-out gap-0 p-0 overflow-hidden',
          isExpanded ? 'sm:max-w-[900px]' : 'sm:max-w-[500px]'
        )}
      >
        <div
          className={cn(
            'grid',
            isExpanded ? 'grid-cols-[1fr_350px] h-[600px]' : 'grid-cols-1 h-auto'
          )}
        >
          <div className="flex flex-col h-full p-6 gap-4">
            <DialogHeader className="flex-row items-center justify-between space-y-0">
              <DialogTitle>添加新剧集</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden sm:inline-flex"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? '收起' : '展开'}
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </DialogHeader>

            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label>序号</Label>
                  <EpisodeStepper value={orderNum} onChange={setOrderNum} />
                </div>
                <div className="space-y-2 flex-1">
                  <Label htmlFor="episode-title">标题</Label>
                  <Input
                    id="episode-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="输入剧集标题"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>创作模式</Label>
                <CreationModeSelector value={mode} onChange={setMode} />
              </div>

              <div className="space-y-2 flex-1 flex flex-col">
                <Label htmlFor="episode-content">剧本内容</Label>
                <Textarea
                  id="episode-content"
                  ref={contentRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="在此输入剧本内容..."
                  className="flex-1 resize-none bg-background/50 focus:bg-background transition-colors min-h-[200px]"
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="continue-mode"
                  checked={continueCreate}
                  onCheckedChange={setContinueCreate}
                />
                <Label htmlFor="continue-mode" className="cursor-pointer">
                  保存后继续创建
                </Label>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isSubmitting ? '保存中...' : '保存剧集'}
                </Button>
              </div>
            </DialogFooter>
          </div>

          {isExpanded && (
            <div className="border-l border-white/[0.04] bg-muted/10 p-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="h-full flex flex-col gap-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  创作助手
                </h3>
                <div className="flex-1 rounded-lg border border-dashed border-white/[0.04] bg-background/30 flex items-center justify-center text-muted-foreground text-sm">
                  素材引用区域（开发中）
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
