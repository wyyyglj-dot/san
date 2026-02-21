'use client';

import type { ViewProps } from '../dynamic-workspace';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, FileText, Users, MapPin, Package } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function OverviewView({
  selectedEpisodeId,
  episodes,
  currentEpisode,
  onDeleteEpisode,
}: ViewProps) {
  if (!selectedEpisodeId) {
    return (
      <div className="flex-1 p-8 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">项目概览</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card/65 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground/55">
                总剧集数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{episodes.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/65 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground/55">
                分镜总数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            </CardContent>
          </Card>
          <Card className="bg-card/65 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground/55">
                已生成素材
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            </CardContent>
          </Card>
          <Card className="bg-card/65 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground/55">
                预计时长
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            </CardContent>
          </Card>
        </div>

        {episodes.length === 0 ? (
          <Card className="bg-card/65 backdrop-blur-sm border-dashed">
            <CardContent className="py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-card/80 to-card/20 border border-white/[0.04] shadow-inner mx-auto mb-6">
                <FileText className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-semibold mb-2">暂无剧集数据</h3>
              <p className="text-sm text-foreground/65 max-w-sm mx-auto">
                点击底部的 + 按钮添加新剧集，或使用剧本拆分功能批量导入
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {episodes.map((episode) => (
              <Card
                key={episode.id}
                className="bg-card/65 backdrop-blur-sm hover:border-primary/50 transition-colors"
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary font-bold text-lg">
                    {episode.orderNum}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{episode.title}</h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {episode.content?.slice(0, 100)}...
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(episode.createdAt).toLocaleDateString()}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            EP {currentEpisode?.orderNum}: {currentEpisode?.title}
          </h2>
          <p className="text-foreground/55 mt-1 line-clamp-2">
            {currentEpisode?.content?.slice(0, 200)}...
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2">
              <Trash2 className="h-4 w-4" />
              删除剧集
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除剧集？</AlertDialogTitle>
              <AlertDialogDescription>
                此操作将删除剧集「{currentEpisode?.title}」。删除后可在回收站中恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => currentEpisode && onDeleteEpisode(currentEpisode.id)}
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card/65 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">角色</p>
              <p className="text-lg font-bold">-</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/65 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <MapPin className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">场景</p>
              <p className="text-lg font-bold">-</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/65 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Package className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">道具</p>
              <p className="text-lg font-bold">-</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/65 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <FileText className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">字数</p>
              <p className="text-lg font-bold">{currentEpisode?.content?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/65 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">剧本内容</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap">
            {currentEpisode?.content}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
