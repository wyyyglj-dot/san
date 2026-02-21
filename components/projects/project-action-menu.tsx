'use client';

import { MoreHorizontal, Trash2, Copy, Share2, Pencil, Type } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { ComicProject } from '@/lib/db-comic';

interface ProjectActionMenuProps {
  project: ComicProject;
  onDelete?: (id: string) => void;
  onRename?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export function ProjectActionMenu({
  project,
  onDelete,
  onRename,
  onDuplicate,
  onEdit,
}: ProjectActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
          <span className="sr-only">打开菜单</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-card/85 backdrop-blur-xl border-white/[0.06]">
        <DropdownMenuItem onClick={() => onEdit?.(project.id)}>
          <Pencil className="mr-2 h-4 w-4" />
          <span>编辑项目</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRename?.(project.id)}>
          <Type className="mr-2 h-4 w-4" />
          <span>重命名</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate?.(project.id)}>
          <Copy className="mr-2 h-4 w-4" />
          <span>创建副本</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Share2 className="mr-2 h-4 w-4" />
          <span>分享</span>
        </DropdownMenuItem>
        <div className="h-px bg-border/70 my-1" />
        <DropdownMenuItem
          className="text-red-400 focus:text-red-500 focus:bg-red-500/10"
          onClick={() => onDelete?.(project.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>删除</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
