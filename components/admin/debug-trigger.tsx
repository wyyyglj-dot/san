'use client';

import { Terminal, AlertCircle } from 'lucide-react';
import { useDebug } from '@/components/providers/debug-provider';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

export function DebugTrigger() {
  const { data: session } = useSession();
  const { isDebugMode, setViewerOpen, logs, serverLogs, isConnected } = useDebug();

  const isAdmin = session?.user?.role === 'admin';
  if (!isAdmin || !isDebugMode) return null;

  const clientErrors = logs.filter(l => l.type === 'error' || (l.status && l.status >= 400)).length;
  const serverErrors = serverLogs.filter(l => l.type === 'error' || (l.status && l.status >= 400)).length;
  const totalErrors = clientErrors + serverErrors;

  return (
    <button
      onClick={() => setViewerOpen(true)}
      aria-label={`调试控制台 (${totalErrors} 个错误) - 服务器${isConnected ? '已连接' : '已断开'}`}
      className={cn(
        'fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95',
        'bg-foreground text-background font-medium border-2 border-background/20',
        totalErrors > 0 && 'bg-red-500 text-white border-red-400'
      )}
    >
      {totalErrors > 0 ? <AlertCircle className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
      <span className="text-sm">
        Debug ({logs.length + serverLogs.length})
      </span>
      <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")} aria-hidden="true" />
    </button>
  );
}
