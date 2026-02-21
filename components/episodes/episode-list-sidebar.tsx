'use client';

import * as React from 'react';
import { useState } from 'react';
import { Plus, Trash2, MoreVertical, Split } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CollapsibleSidebar } from '@/components/episodes/shared/collapsible-sidebar';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import { notify } from '@/lib/toast-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddEpisodeModal } from '@/components/episodes/add-episode-modal';
import { ScriptSplitterModal } from '@/components/episodes/script-splitter-modal';

interface EpisodeListSidebarProps {
  projectId: string;
}

export function EpisodeListSidebar({ projectId }: EpisodeListSidebarProps) {
  const episodes = useWorkspaceStore((s) => s.episodes);
  const selectedEpisodeId = useWorkspaceStore((s) => s.selectedEpisodeId);
  const isLoadingEpisodes = useWorkspaceStore((s) => s.isLoadingEpisodes);
  const leftSidebarOpen = useWorkspaceStore((s) => s.leftSidebarOpen);
  const nextOrderNum = useWorkspaceStore((s) => s.nextOrderNum);
  const setSelectedEpisodeId = useWorkspaceStore((s) => s.setSelectedEpisodeId);
  const toggleLeftSidebar = useWorkspaceStore((s) => s.toggleLeftSidebar);
  const deleteEpisode = useWorkspaceStore((s) => s.deleteEpisode);
  const fetchEpisodes = useWorkspaceStore((s) => s.fetchEpisodes);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const handleDelete = async (episodeId: string) => {
    setDeletingId(null);
    try {
      await deleteEpisode(episodeId);
      notify.success('删除成功', '剧集已删除');
    } catch {
      notify.error('删除失败', '网络错误，请重试');
    }
  };

  return (
    <>
      <CollapsibleSidebar
        side="left"
        isOpen={leftSidebarOpen}
        onToggle={toggleLeftSidebar}
        title="剧集列表"
        width="260px"
        headerActions={
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setIsSplitModalOpen(true)}
              title="剧本拆分"
              aria-label="剧本拆分"
            >
              <Split className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setIsAddModalOpen(true)}
              title="新建剧集"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingEpisodes ? (
              <div className="text-center py-10 text-xs text-muted-foreground">
                加载中...
              </div>
            ) : episodes.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground">
                暂无剧集
              </div>
            ) : (
              episodes.map((episode) => (
                <div
                  key={episode.id}
                  className={cn(
                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50',
                    selectedEpisodeId === episode.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground/60',
                  )}
                >
                  <button
                    className="flex flex-1 items-center gap-3 text-left focus:outline-none"
                    onClick={() => setSelectedEpisodeId(episode.id)}
                    type="button"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-background/60 text-[10px] font-mono border border-white/[0.06]">
                      {episode.orderNum}
                    </span>
                    <span className="flex-1 truncate text-foreground">
                      {episode.title || '未命名剧集'}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100 ml-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(episode.id);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CollapsibleSidebar>

      <AddEpisodeModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        projectId={projectId}
        nextOrderNum={nextOrderNum}
        onSuccess={() => void fetchEpisodes()}
      />
      <ScriptSplitterModal
        open={isSplitModalOpen}
        onOpenChange={setIsSplitModalOpen}
        projectId={projectId}
        onSuccess={() => void fetchEpisodes()}
      />

      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除剧集？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，请谨慎操作。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
