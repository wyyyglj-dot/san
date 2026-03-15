'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search, Trash2, Download, Move, GripHorizontal, Activity } from 'lucide-react';
import { useDebug } from '@/components/providers/debug-provider';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { exportLogs } from '@/lib/debug-utils';
import type { LogType } from '@/types/debug';

const STANDARD_LOG_KEYS = new Set([
  'id', 'timestamp', 'type', 'source', 'isPolling',
  'method', 'url', 'status', 'duration', 'headers', 'body', 'message'
]);

export function DebugLogViewer() {
  const { data: session } = useSession();
  const { isViewerOpen, setViewerOpen, logs, serverLogs, clearLogs, isConnected } = useDebug();
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<LogType | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'client' | 'server'>('client');
  const [showPolling, setShowPolling] = useState(false);

  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const isAdmin = session?.user?.role === 'admin';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isResizing) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [position.x, position.y, isResizing]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  }, [size.w, size.h]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragStart.current.x));
        const newY = Math.max(0, Math.min(window.innerHeight - 300, e.clientY - dragStart.current.y));
        setPosition({ x: newX, y: newY });
      }
      if (isResizing) {
        const newW = Math.max(320, Math.min(window.innerWidth - position.x, resizeStart.current.w + (e.clientX - resizeStart.current.x)));
        const newH = Math.max(200, Math.min(window.innerHeight - position.y, resizeStart.current.h + (e.clientY - resizeStart.current.y)));
        setSize({ w: newW, h: newH });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, position.x, position.y]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isViewerOpen) {
        setViewerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerOpen, setViewerOpen]);

  if (!isAdmin || !isViewerOpen) return null;

  const targetLogs = activeTab === 'client' ? logs : serverLogs;

  const filteredLogs = targetLogs.filter(log => {
    const matchesSearch =
      log.url?.toLowerCase().includes(filter.toLowerCase()) ||
      log.message?.toLowerCase().includes(filter.toLowerCase()) ||
      log.method?.toLowerCase().includes(filter.toLowerCase());
    const matchesType = typeFilter === 'all' || log.type === typeFilter;
    const matchesPolling = showPolling || !log.isPolling;
    return matchesSearch && matchesType && matchesPolling;
  });

  return (
    <div
      className="fixed z-[100] bg-card border border-white/[0.06] rounded-xl flex flex-col shadow-2xl overflow-hidden backdrop-blur-md max-w-[95vw] max-h-[95vh]"
      style={{
        left: position.x,
        top: position.y,
        width: size.w,
        height: size.h,
        minWidth: 320,
        minHeight: 200,
      }}
    >
      <div
        className="flex items-center justify-between p-3 border-b border-white/[0.06] bg-muted/50 cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Move className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">调试控制台</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportLogs([...logs, ...serverLogs], 'json')}
            className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-foreground"
            title="导出 JSON"
            aria-label="导出日志"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={clearLogs}
            className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-destructive"
            title="清空日志"
            aria-label="清空日志"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewerOpen(false)}
            className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="关闭调试面板"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex p-1 bg-muted/30 gap-1 px-2 border-b border-white/[0.06]" role="tablist" aria-label="日志来源">
        <button
          onClick={() => setActiveTab('client')}
          role="tab"
          aria-selected={activeTab === 'client'}
          className={cn(
            "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2",
            activeTab === 'client' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"
          )}
        >
          <span>前端日志</span>
          <span className="bg-primary/10 text-primary px-1.5 rounded-full text-[10px]">{logs.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('server')}
          role="tab"
          aria-selected={activeTab === 'server'}
          className={cn(
            "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2",
            activeTab === 'server' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"
          )}
        >
          <div className="flex items-center gap-1.5">
            <span>后端日志</span>
            <div
              className={cn("w-1.5 h-1.5 rounded-full transition-colors", isConnected ? "bg-green-500" : "bg-red-500")}
              title={isConnected ? "已连接" : "已断开"}
              aria-label={isConnected ? "服务器已连接" : "服务器已断开"}
              role="status"
            />
          </div>
          <span className="bg-primary/10 text-primary px-1.5 rounded-full text-[10px]">{serverLogs.length}</span>
        </button>
      </div>

        <div className="flex items-center gap-2 p-2 border-b border-white/[0.06] bg-card">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索 URL、方法、消息..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="搜索日志"
              className="w-full bg-muted/20 border border-transparent focus:border-primary/50 rounded-md pl-9 pr-3 py-1.5 text-sm outline-none"
            />
          </div>
          <button
            onClick={() => setShowPolling(!showPolling)}
            className={cn(
              "p-1.5 rounded-md transition-colors border",
              showPolling
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-transparent border-transparent text-muted-foreground hover:bg-muted"
            )}
            title={showPolling ? "隐藏轮询日志" : "显示轮询日志"}
            aria-pressed={showPolling}
            aria-label="切换轮询日志显示"
          >
            <Activity className="w-4 h-4" />
          </button>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as LogType | 'all')}
            aria-label="筛选日志类型"
            className="bg-muted/20 border-transparent rounded-md px-3 py-1.5 text-sm outline-none cursor-pointer"
          >
            <option value="all">全部类型</option>
            <option value="request">请求</option>
            <option value="response">响应</option>
            <option value="error">错误</option>
            <option value="navigation">导航</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0 font-mono text-xs">
          {filteredLogs.map(log => (
            <div key={log.id} className={cn(
              "border-b border-white/[0.05] last:border-0",
              log.source === 'server' && "bg-purple-500/5"
            )}>
              <div
                className={cn(
                  'flex items-center gap-2 w-full text-left px-2 py-1.5 select-text',
                  log.type === 'error' && 'text-red-400 bg-red-500/5',
                  log.type === 'response' && log.status && log.status >= 400 && 'text-yellow-400 bg-yellow-500/5'
                )}
              >
                <span className="text-muted-foreground shrink-0 w-[60px]">
                  [{new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}]
                </span>

                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase w-14 text-center shrink-0',
                  log.type === 'request' && 'bg-blue-500/20 text-blue-400',
                  log.type === 'response' && 'bg-green-500/20 text-green-400',
                  log.type === 'error' && 'bg-red-500/20 text-red-400',
                  log.type === 'navigation' && 'bg-purple-500/20 text-purple-400'
                )}>
                  {log.type}
                </span>

                <div className="flex-1 truncate flex items-center gap-2">
                  {log.method && <span className={cn("font-bold", log.method === 'GET' ? 'text-blue-400' : 'text-green-400')}>{log.method}</span>}
                  <span className="opacity-90 truncate" title={log.url || log.message}>
                    {log.url || log.message}
                  </span>
                </div>

                {log.status && (
                  <span className={cn(
                    'font-bold shrink-0',
                    log.status >= 400 ? 'text-red-400' : 'text-green-400'
                  )}>
                    {log.status}
                  </span>
                )}

                {log.duration !== undefined && log.duration > 0 && (
                  <span className="text-muted-foreground shrink-0">
                    {log.duration}ms
                  </span>
                )}
              </div>

              {(() => {
                let debugInfo: Record<string, unknown> | null = null;
                if (log.body && log.type === 'response') {
                  try {
                    const parsed = JSON.parse(log.body);
                    if (parsed._debug) {
                      debugInfo = parsed._debug;
                    }
                  } catch {}
                }

                const extraEntries = Object.entries(log).filter(
                  ([key]) => !STANDARD_LOG_KEYS.has(key)
                );

                return (
                <div className="pl-[76px] pr-2 pb-2 text-muted-foreground/80 space-y-1 text-[11px]">
                  {debugInfo && (
                    <div className="bg-cyan-500/5 border border-cyan-500/20 rounded p-2 mb-2 space-y-1">
                      <div className="text-[10px] font-bold text-cyan-500/80 mb-1">API DEBUG INFO</div>
                      {Object.entries(debugInfo).map(([key, value]) => (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-start">
                          <span className="opacity-50 mr-2 min-w-[80px] shrink-0 font-medium">{key}:</span>
                          <span className="text-cyan-400 break-all font-mono">
                            {typeof value === 'object' && value !== null
                              ? JSON.stringify(value)
                              : String(value ?? '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {log.message && (
                    <div>
                      <span className="opacity-50 mr-2 select-none">MSG:</span>
                      <span className="text-red-400 break-all">{log.message}</span>
                    </div>
                  )}
                  {log.headers && Object.keys(log.headers).length > 0 && (
                    <div>
                      <div className="opacity-50 mb-0.5 select-none">HEADERS:</div>
                      <pre className="whitespace-pre-wrap break-all text-muted-foreground/60 pl-2 border-l border-white/10">{JSON.stringify(log.headers, null, 2)}</pre>
                    </div>
                  )}
                  {log.body && (
                    <div>
                      <div className="opacity-50 mb-0.5 select-none">BODY:</div>
                      <pre className="whitespace-pre-wrap break-all text-primary/80 pl-2 border-l border-white/10">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(log.body), null, 2);
                          } catch {
                            return log.body;
                          }
                        })()}
                      </pre>
                    </div>
                  )}
                  {extraEntries.length > 0 && (
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded p-2 mt-2 space-y-1">
                      <div className="text-[10px] font-bold text-yellow-500/80 mb-1">EXTRA FIELDS</div>
                      {extraEntries.map(([key, value]) => (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-start">
                          <span className="opacity-50 mr-2 min-w-[80px] shrink-0 font-medium">{key}:</span>
                          <span className="text-yellow-400 break-all font-mono">
                            {typeof value === 'object' && value !== null
                              ? JSON.stringify(value)
                              : String(value ?? '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!log.message && !log.headers && !log.body && !debugInfo && extraEntries.length === 0 && (
                    <div className="text-muted-foreground/50 italic">暂无详细信息</div>
                  )}
                </div>
                );
              })()}
            </div>
          ))}
        </div>
        <div
          className="absolute bottom-0 right-0 p-1.5 cursor-nwse-resize hover:bg-white/10 text-muted-foreground/50 hover:text-foreground"
          onMouseDown={handleResizeMouseDown}
        >
          <GripHorizontal className="w-4 h-4 -rotate-45" />
        </div>
    </div>
  );
}
