'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  MoreVertical,
  Split,
  ListChecks,
  Square,
  CheckSquare,
  X,
  ChevronDown,
} from 'lucide-react';
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
import { useToast } from '@/components/ui/toaster';
import { AddEpisodeModal } from '@/components/episodes/add-episode-modal';
import { ScriptSplitterModal } from '@/components/episodes/script-splitter-modal';

interface EpisodeListSidebarProps {
  projectId: string;
}

interface DeleteTarget {
  ids: string[];
  isBatch: boolean;
}

export function EpisodeListSidebar({ projectId }: EpisodeListSidebarProps) {
  const episodes = useWorkspaceStore((s) => s.episodes);
  const selectedEpisodeId = useWorkspaceStore((s) => s.selectedEpisodeId);
  const isLoadingEpisodes = useWorkspaceStore((s) => s.isLoadingEpisodes);
  const isLoadingMoreEpisodes = useWorkspaceStore((s) => s.isLoadingMoreEpisodes);
  const episodesHasMore = useWorkspaceStore((s) => s.episodesHasMore);
  const episodesTotal = useWorkspaceStore((s) => s.episodesTotal);
  const leftSidebarOpen = useWorkspaceStore((s) => s.leftSidebarOpen);
  const nextOrderNum = useWorkspaceStore((s) => s.nextOrderNum);
  const setSelectedEpisodeId = useWorkspaceStore((s) => s.setSelectedEpisodeId);
  const toggleLeftSidebar = useWorkspaceStore((s) => s.toggleLeftSidebar);
  const deleteEpisode = useWorkspaceStore((s) => s.deleteEpisode);
  const deleteEpisodes = useWorkspaceStore((s) => s.deleteEpisodes);
  const fetchEpisodes = useWorkspaceStore((s) => s.fetchEpisodes);
  const loadMoreEpisodes = useWorkspaceStore((s) => s.loadMoreEpisodes);
  const { toast } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allEpisodeIds = useMemo(() => episodes.map((episode) => episode.id), [episodes]);
  const selectedCount = selectedIds.size;
  const allSelected = episodes.length > 0 && selectedCount === episodes.length;

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;

      const validIds = new Set(allEpisodeIds);
      const next = new Set<string>();
      let changed = false;

      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    if (episodes.length === 0) {
      setSelectMode(false);
    }
  }, [allEpisodeIds, episodes.length]);

  const resetSelection = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelectedId = (episodeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(episodeId)) {
        next.delete(episodeId);
      } else {
        next.add(episodeId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (episodes.length === 0) return;
    setSelectedIds(allSelected ? new Set() : new Set(allEpisodeIds));
  };

  const openDeleteDialog = (ids: string[]) => {
    const normalizedIds = Array.from(
      new Set(
        ids
          .filter((id) => typeof id === 'string')
          .map((id) => id.trim())
          .filter(Boolean)
      )
    );

    if (normalizedIds.length === 0) {
      return;
    }

    setDeleteTarget({ ids: normalizedIds, isBatch: normalizedIds.length > 1 });
  };

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    const targetIds = deleteTarget.ids;
    setDeleteTarget(null);
    setIsDeleting(true);

    try {
      if (targetIds.length === 1) {
        await deleteEpisode(targetIds[0]);
        toast({
          title: '删除成功',
          description: '剧集已删除',
        });
      } else {
        const { deletedCount } = await deleteEpisodes(targetIds);

        if (deletedCount === 0) {
          toast({
            title: '删除失败',
            description: '未删除任何剧集，请重试',
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: deletedCount === targetIds.length ? '批量删除成功' : '部分删除完成',
          description:
            deletedCount === targetIds.length
              ? `已删除 ${deletedCount} 个剧集`
              : `已删除 ${deletedCount} 个剧集，部分剧集可能已不存在`,
        });
      }

      if (selectMode) {
        resetSelection();
      }
    } catch (error) {
      toast({
        title: '删除失败',
        description:
          error instanceof Error ? error.message : '网络错误，请重试',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
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
          selectMode ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={handleToggleSelectAll}
                disabled={episodes.length === 0}
                title={allSelected ? '取消全选' : '全选'}
              >
                {allSelected ? '取消全选' : '全选'}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={resetSelection}
                title="退出多选"
                aria-label="退出多选"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
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
                aria-label="新建剧集"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  setSelectMode(true);
                  setSelectedIds(new Set());
                }}
                title="批量选择"
                aria-label="批量选择"
              >
                <ListChecks className="h-4 w-4" />
              </Button>
            </div>
          )
        }
      >
        <ScrollArea className="h-full">
          <div className="p-2 space-y-2">
            {selectMode && episodes.length > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-2">
                <span className="text-xs text-muted-foreground">
                  已选 {selectedCount} 项
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 px-2"
                  disabled={selectedCount === 0}
                  onClick={() => openDeleteDialog(Array.from(selectedIds))}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  删除
                </Button>
              </div>
            )}

            {isLoadingEpisodes ? (
              <div className="text-center py-10 text-xs text-muted-foreground">
                加载中...
              </div>
            ) : episodes.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground">
                暂无剧集
              </div>
            ) : (
              <div className="space-y-1">
                {episodes.map((episode) => {
                  const isCurrentEpisode = selectedEpisodeId === episode.id;
                  const isSelected = selectedIds.has(episode.id);

                  return (
                    <div
                      key={episode.id}
                      className={cn(
                        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        selectMode
                          ? isSelected
                            ? 'bg-primary/10 ring-1 ring-primary/20 text-foreground'
                            : 'text-foreground/60 hover:bg-accent/30'
                          : isCurrentEpisode
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground/60 hover:bg-accent/50'
                      )}
                    >
                      <button
                        className="flex flex-1 items-center gap-3 text-left focus:outline-none"
                        onClick={() => {
                          if (selectMode) {
                            toggleSelectedId(episode.id);
                            return;
                          }
                          setSelectedEpisodeId(episode.id);
                        }}
                        type="button"
                        aria-pressed={selectMode ? isSelected : isCurrentEpisode}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/[0.06] bg-background/60 text-[10px] font-mono">
                          {selectMode ? (
                            isSelected ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )
                          ) : (
                            episode.orderNum
                          )}
                        </span>
                        <span className="flex-1 truncate text-foreground">
                          {episode.title || '未命名剧集'}
                        </span>
                      </button>

                      {!selectMode && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-auto h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
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
                                openDeleteDialog([episode.id]);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}

                {episodesHasMore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                    disabled={isLoadingMoreEpisodes}
                    onClick={() => void loadMoreEpisodes()}
                  >
                    {isLoadingMoreEpisodes ? (
                      '加载中...'
                    ) : (
                      <>
                        <ChevronDown className="mr-1 h-3 w-3" />
                        加载更多（{episodes.length}/{episodesTotal}）
                      </>
                    )}
                  </Button>
                )}
              </div>
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
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.isBatch
                ? `确认删除选中的 ${deleteTarget.ids.length} 个剧集？`
                : '确认删除剧集？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
