'use client';

import { useState } from 'react';
import { RotateCcw, ChevronDown, ChevronUp, Clock, User } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { AgentVersion } from '@/types';

interface VersionHistoryProps {
  versions: AgentVersion[];
  currentVersion: number;
  onRollback: (version: number) => void;
}

export function VersionHistory({ versions, currentVersion, onRollback }: VersionHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (versions.length === 0) {
    return (
      <div className="text-center py-16 text-foreground/50">
        暂无版本记录
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((v) => {
        const isCurrent = v.version === currentVersion;
        const isExpanded = expandedId === v.id;

        return (
          <div
            key={v.id}
            className={`bg-card/40 backdrop-blur-sm border rounded-2xl overflow-hidden transition-colors ${
              isCurrent ? 'border-primary/30' : 'border-white/[0.06]'
            }`}
          >
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                  isCurrent
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-white/[0.06] text-foreground/50 border border-white/[0.06]'
                }`}>
                  v{v.version}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {v.changeSummary || '无变更说明'}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                        当前
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(v.createdAt).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {v.createdBy}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 ml-3">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  className="p-2 rounded-lg text-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors"
                  aria-label={isExpanded ? `收起版本 v${v.version} 详情` : `展开版本 v${v.version} 详情`}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {!isCurrent && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="p-2 rounded-lg text-foreground/40 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        aria-label={`回滚到版本 v${v.version}`}
                      >                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认回滚</AlertDialogTitle>
                        <AlertDialogDescription>
                          确定要回滚到版本 v{v.version} 吗？这将创建一个新版本记录。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRollback(v.version)}>
                          确认回滚
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-white/[0.06]">
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-foreground/50 mb-2">系统提示词</h4>
                  <pre className="text-xs text-foreground/60 whitespace-pre-wrap break-words bg-black/20 rounded-lg p-3 max-h-64 overflow-y-auto font-mono">
                    {v.systemPrompt || '(空)'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
