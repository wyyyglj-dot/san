'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Scissors, Play, FileText, Settings, Loader2 } from 'lucide-react';
import { notify } from '@/lib/toast-utils';
import { apiPost, ApiClientError } from '@/lib/api-client';
import type { SplitPreviewItem, SplitRule, SplitResult } from './types';
import { EpisodeStepper } from './episode-stepper';
import { CreationModeSelector } from '@/components/projects/creation-mode-selector';

interface ScriptSplitterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

const SAMPLE_SCRIPT = `第1集
小明走进教室，看到同学们都在讨论着什么。
"发生什么事了？"小明问道。

第2集
放学后，小明独自走在回家的路上。
天空开始下起了小雨。

第3集
第二天早上，小明收到了一封神秘的信。
信上写着一个陌生的地址。`;

export function ScriptSplitterModal({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: ScriptSplitterModalProps) {
  const [script, setScript] = useState('');
  const [rule, setRule] = useState<SplitRule>({
    type: 'episode_heading',
    titleTemplate: '第{n}集',
    startOrderNum: 1,
    maxEpisodes: 200,
  });
  const [preview, setPreview] = useState<SplitPreviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState('ai_merge');
  const [activeTab, setActiveTab] = useState('input');

  const fetchPreview = useCallback(async () => {
    if (!script.trim()) {
      setPreview([]);
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiPost<SplitResult>(`/api/projects/${projectId}/episodes/split`, {
        content: script,
        rule,
      });
      setPreview(result?.items || []);
    } catch {
      setPreview([]);
    } finally {
      setIsLoading(false);
    }
  }, [script, rule, projectId]);

  useEffect(() => {
    const timer = setTimeout(fetchPreview, 300);
    return () => clearTimeout(timer);
  }, [fetchPreview]);

  useEffect(() => {
    if (open) {
      setScript('');
      setPreview([]);
      setActiveTab('input');
    }
  }, [open]);

  const handleLoadSample = () => {
    setScript(SAMPLE_SCRIPT);
  };

  const handleSubmit = async () => {
    if (preview.length === 0) {
      notify.error('没有可导入的剧集');
      return;
    }

    setIsSubmitting(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const item of preview) {
        try {
          await apiPost(`/api/projects/${projectId}/episodes`, {
            orderNum: item.orderNum,
            title: item.title,
            content: item.content,
            sourceType: 'split',
            mode,
          });
          successCount++;
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        notify.success(`成功导入 ${successCount} 个剧集${failCount > 0 ? `，${failCount} 个失败` : ''}`);
        onSuccess();
        onOpenChange(false);
      } else {
        notify.error('导入失败，请检查序号是否冲突');
      }
    } catch {
      notify.error('网络错误，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[1200px] h-[80vh] flex flex-col p-0 overflow-hidden gap-0 sm:rounded-xl">
        <div className="flex h-14 items-center justify-between border-b border-white/[0.04] bg-muted/10 px-6 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            剧本拆分助手
          </DialogTitle>
          <div className="flex gap-2 mr-8">
            <Button variant="outline" size="sm" onClick={handleLoadSample}>
              加载案例
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || preview.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-2" />
              )}
              执行拆分 ({preview.length})
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {/* Mobile View */}
          <div className="md:hidden h-full flex flex-col">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col"
            >
              <TabsList className="w-full justify-start rounded-none border-b bg-muted/20 p-0 h-10">
                <TabsTrigger
                  value="input"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                >
                  输入
                </TabsTrigger>
                <TabsTrigger
                  value="rules"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                >
                  规则
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                >
                  预览 ({preview.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="input" className="flex-1 p-4 m-0">
                <Textarea
                  placeholder="在此粘贴剧本原文..."
                  className="h-full resize-none font-mono text-sm leading-relaxed"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="rules" className="flex-1 p-4 m-0 space-y-4">
                <div className="space-y-2">
                  <Label>起始序号</Label>
                  <EpisodeStepper
                    value={rule.startOrderNum}
                    onChange={(v) => setRule({ ...rule, startOrderNum: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>标题模板</Label>
                  <Input
                    value={rule.titleTemplate}
                    onChange={(e) =>
                      setRule({ ...rule, titleTemplate: e.target.value })
                    }
                    placeholder="第{n}集"
                  />
                  <p className="text-xs text-muted-foreground">
                    使用 {'{n}'} 表示序号，系统将自动识别匹配的标题
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>创作模式</Label>
                  <CreationModeSelector value={mode} onChange={setMode} />
                </div>
              </TabsContent>
              <TabsContent
                value="preview"
                className="flex-1 p-4 m-0 overflow-y-auto"
              >
                {preview.map((p, i) => (
                  <div
                    key={i}
                    className="mb-4 p-3 bg-card border rounded-lg text-sm"
                  >
                    <div className="font-bold text-primary mb-1">{p.title}</div>
                    <div className="line-clamp-3 text-muted-foreground">
                      {p.content}
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          {/* Desktop View */}
          <div className="hidden md:grid grid-cols-12 h-full divide-x divide-white/[0.05]">
            <div className="col-span-4 p-4 flex flex-col gap-3 bg-background/30">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" /> 原文输入
              </div>
              <Textarea
                placeholder="在此粘贴剧本原文..."
                className="flex-1 resize-none font-mono text-sm leading-relaxed bg-background/50 focus:bg-background transition-colors border-0 ring-1 ring-border/50"
                value={script}
                onChange={(e) => setScript(e.target.value)}
              />
            </div>
            <div className="col-span-3 p-4 flex flex-col gap-3 bg-muted/5">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Settings className="h-4 w-4" /> 拆分规则
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    起始序号
                  </Label>
                  <EpisodeStepper
                    value={rule.startOrderNum}
                    onChange={(v) => setRule({ ...rule, startOrderNum: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    标题模板
                  </Label>
                  <Input
                    value={rule.titleTemplate}
                    onChange={(e) =>
                      setRule({ ...rule, titleTemplate: e.target.value })
                    }
                    placeholder="第{n}集"
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    使用 {'{n}'} 表示序号，系统将自动识别匹配的标题
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    创作模式
                  </Label>
                  <CreationModeSelector value={mode} onChange={setMode} />
                </div>
              </div>
            </div>
            <div className="col-span-5 p-4 flex flex-col gap-3 bg-accent/5">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span className="flex items-center gap-2">
                  {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  实时预览
                </span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {preview.length} 个片段
                </span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {preview.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm">
                    {script.trim() ? '解析中...' : '等待输入...'}
                  </div>
                ) : (
                  preview.map((p, i) => (
                    <div
                      key={i}
                      className="p-3 bg-card border border-white/[0.05] rounded-lg shadow-sm hover:border-primary/50 transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          EP {p.orderNum}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.content.length} 字
                        </span>
                      </div>
                      <div className="font-medium text-sm mb-1">{p.title}</div>
                      <div className="text-sm text-foreground/65 leading-relaxed line-clamp-3">
                        {p.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
