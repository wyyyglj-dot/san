'use client';

import { FolderKanban, User, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProjectActionMenu } from './project-action-menu';
import type { ComicProject } from '@/lib/db-comic';
import { formatTimestamp } from '@/lib/date-utils';

interface ProjectListProps {
  projects: ComicProject[];
  type: 'active' | 'trash';
  onDelete?: (id: string) => void;
  onRename?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPurge?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export function ProjectList({
  projects,
  type,
  onDelete,
  onRename,
  onDuplicate,
  onEdit,
  onRestore,
  onPurge,
}: ProjectListProps) {
  const isEmpty = !projects || projects.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-card/40 rounded-2xl flex items-center justify-center mb-4 border border-brand/40">
          <FolderKanban className="w-8 h-8 text-brand/40" />
        </div>
        <h3 className="text-lg font-medium text-foreground">暂无项目</h3>
        <p className="text-foreground/40 mt-1 max-w-sm">
          {type === 'trash' ? '回收站为空' : '创建您的第一个漫剧作品，开始创作之旅'}
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-[10px] tracking-wider text-brand/70 uppercase bg-brand/5 border-b border-brand/20">
          <tr>
            <th scope="col" className="px-6 py-4 font-medium">作品名称</th>
            <th scope="col" className="px-6 py-4 font-medium">编辑人员</th>
            <th scope="col" className="px-6 py-4 font-medium">尺寸</th>
            <th scope="col" className="px-6 py-4 font-medium">时长</th>
            <th scope="col" className="px-6 py-4 font-medium">创建时间</th>
            <th scope="col" className="px-6 py-4 font-medium">最后编辑</th>
            <th scope="col" className="px-6 py-4 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {projects.map((project) => (
            <tr key={project.id} className="bg-transparent hover:bg-brand/5 hover:shadow-[inset_2px_0_0_0_hsl(var(--brand-primary))] transition-all duration-300 group">
              <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-black/40 flex items-center justify-center border border-brand/40">
                    <FolderKanban className="w-5 h-5 text-brand" />
                  </div>
                  <span>{project.name}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-accent border border-background flex items-center justify-center text-[10px]">
                    <User className="w-3 h-3" />
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-foreground/55 font-mono text-xs">{project.sizeLabel || '16:9'}</td>
              <td className="px-6 py-4 text-foreground/55 font-mono text-xs">{project.durationSeconds || 0}s</td>
              <td className="px-6 py-4 text-foreground/50 text-xs font-mono">
                {formatTimestamp(project.createdAt)}
              </td>
              <td className="px-6 py-4 text-foreground/50 text-xs font-mono">
                {formatTimestamp(project.updatedAt)}
              </td>
              <td className="px-6 py-4 text-right">
                {type === 'active' ? (
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/projects/${project.id}/episodes`}>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-2 h-8"
                        title="编辑漫剧"
                        aria-label="编辑漫剧"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span className="text-xs">编辑漫剧</span>
                      </Button>
                    </Link>
                    <ProjectActionMenu
                      project={project}
                      onDelete={onDelete}
                      onRename={onRename}
                      onDuplicate={onDuplicate}
                      onEdit={onEdit}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={() => onRestore?.(project.id)}
                      className="text-xs text-sky-500 hover:text-sky-400"
                    >
                      恢复
                    </button>
                    <button
                      onClick={() => onPurge?.(project.id)}
                      className="text-xs text-red-400 hover:text-red-500"
                    >
                      永久删除
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
