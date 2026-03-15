'use client';

import Link from 'next/link';
import { Bot, Pencil, Trash2, Clock, Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { AgentSummary } from '@/types';

interface AgentCardProps {
  agent: AgentSummary;
  onDelete: (key: string) => void;
  isDeleting?: boolean;
}

export function AgentCard({ agent, onDelete, isDeleting }: AgentCardProps) {
  return (
    <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-3 group hover:border-white/[0.12] transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">{agent.featureKey}</p>
          </div>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          agent.enabled
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {agent.enabled ? '启用' : '禁用'}
        </span>
      </div>

      <p className="text-sm text-foreground/50 line-clamp-2 min-h-[2.5rem]">
        {agent.description || '暂无描述'}
      </p>

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>v{agent.currentVersion}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(agent.updatedAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/admin/agents/${agent.featureKey}`}
            className="p-2 rounded-lg text-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors"
            aria-label={`编辑 ${agent.name}`}
          >
            <Pencil className="w-4 h-4" />
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="p-2 rounded-lg text-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`删除 ${agent.name}`}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除 Agent「{agent.name}」吗？此操作不可撤销，所有版本历史也将被删除。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(agent.featureKey)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
