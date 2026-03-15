'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import type { DebugContextType, LogEntry } from '@/types/debug';
import { sanitizeHeaders, sanitizeBody, sanitizeUrl } from '@/lib/debug-utils';
import { generateId } from '@/lib/utils';

const MAX_LOGS = 300;
const MAX_BODY_BYTES = 10 * 1024;
const SKIP_CONTENT_TYPES = [
  'text/event-stream',
  'application/octet-stream',
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/zip',
  'multipart/',
];

const POLLING_PATHS = ['/api/status/video', '/api/status/pending', '/api/user/status'];
const POLLING_LOG_THROTTLE_MS = 30_000;

function getPollingKey(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

function isPollingPath(url: string): boolean {
  const pathname = getPollingKey(url);
  return POLLING_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

const DebugContext = createContext<DebugContextType | null>(null);

const getStorageKey = (userId: string) => `sanhub_debug_mode_${userId}`;

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isDebugMode, _setDebugMode] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [serverLogs, setServerLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isViewerOpen, setViewerOpen] = useState(false);
  const originalFetch = useRef<typeof fetch | null>(null);
  const lastUserId = useRef<string | null>(null);
  const lastPollingLogTime = useRef<Record<string, number>>({});

  const isAdmin = session?.user?.role === 'admin';

  const setDebugMode = useCallback((mode: boolean) => {
    _setDebugMode(mode);
    if (session?.user?.id) {
      localStorage.setItem(getStorageKey(session.user.id), String(mode));
    }
  }, [session?.user?.id]);

  const addLog = useCallback((log: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs(prev => {
      const newLog: LogEntry = { ...log, id: generateId(), timestamp: Date.now() };
      const updated = [newLog, ...prev];
      return updated.slice(0, MAX_LOGS);
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setServerLogs([]);
    lastPollingLogTime.current = {};
  }, []);

  useEffect(() => {
    setMounted(true);
    const currentId = session?.user?.id ?? null;
    if (lastUserId.current && lastUserId.current !== currentId) {
      setLogs([]);
      setViewerOpen(false);
      _setDebugMode(false);
    }
    if (currentId && !lastUserId.current) {
      const saved = localStorage.getItem(getStorageKey(currentId));
      if (saved === 'true') {
        _setDebugMode(true);
      }
    }
    lastUserId.current = currentId;
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isDebugMode || !isAdmin) return;

    originalFetch.current = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const startTime = Date.now();
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const url = sanitizeUrl(rawUrl);
      const method = init?.method || 'GET';

      const isPolling = method === 'GET' && isPollingPath(rawUrl);
      const pollingKey = isPolling ? getPollingKey(rawUrl) : '';
      const now = Date.now();
      let shouldLog = true;

      if (isPolling) {
        const lastTime = lastPollingLogTime.current[pollingKey] || 0;
        shouldLog = now - lastTime >= POLLING_LOG_THROTTLE_MS;
      }

      let reqHeaders: Record<string, string> | undefined;
      if (init?.headers) {
        const h = init.headers;
        if (h instanceof Headers) {
          reqHeaders = sanitizeHeaders(Object.fromEntries(h.entries()));
        } else if (Array.isArray(h)) {
          reqHeaders = sanitizeHeaders(Object.fromEntries(h));
        } else {
          reqHeaders = sanitizeHeaders(h as Record<string, string>);
        }
      }

      const requestLog = {
        type: 'request' as const,
        source: 'client' as const,
        isPolling,
        method,
        url,
        headers: reqHeaders,
        body: init?.body ? sanitizeBody(String(init.body)) : undefined,
      };

      if (!isPolling) {
        addLog(requestLog);
      }

      try {
        const response = await originalFetch.current!(input, init);

        if (isPolling) {
          if (!response.ok) {
            addLog(requestLog);
            shouldLog = true;
          } else if (shouldLog) {
            addLog(requestLog);
            lastPollingLogTime.current[pollingKey] = Date.now();
          }
        }

        if (!shouldLog) {
          return response;
        }

        const duration = Date.now() - startTime;
        const contentType = response.headers.get('content-type') || '';
        const contentLength = response.headers.get('content-length');
        const tooLarge = contentLength ? Number(contentLength) > MAX_BODY_BYTES : false;

        const shouldSkipBody = SKIP_CONTENT_TYPES.some(t => contentType.includes(t)) || tooLarge;

        let responseBody: string | undefined;
        if (!shouldSkipBody) {
          try {
            const clone = response.clone();
            responseBody = await clone.text();
          } catch {}
        }

        addLog({
          type: 'response',
          source: 'client',
          isPolling,
          method,
          url,
          status: response.status,
          headers: sanitizeHeaders(Object.fromEntries(response.headers.entries())),
          body: responseBody ? sanitizeBody(responseBody) : undefined,
          duration,
        });

        return response;
      } catch (error) {
        if (isPolling) {
          addLog(requestLog);
        }
        addLog({
          type: 'error',
          source: 'client',
          message: error instanceof Error ? error.message : 'Fetch failed',
          url,
        });
        throw error;
      }
    };

    return () => {
      if (originalFetch.current) {
        window.fetch = originalFetch.current;
      }
    };
  }, [isDebugMode, isAdmin, addLog]);

  useEffect(() => {
    if (!isDebugMode || !isAdmin) return;
    addLog({ type: 'navigation', source: 'client', message: `Navigated to ${pathname}` });
  }, [pathname, isDebugMode, isAdmin, addLog]);

  useEffect(() => {
    if (!isDebugMode || !isAdmin) return;

    const handleError = (event: ErrorEvent) => {
      addLog({ type: 'error', source: 'client', message: event.message });
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      addLog({ type: 'error', source: 'client', message: String(event.reason) });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [isDebugMode, isAdmin, addLog]);

  useEffect(() => {
    if (!isDebugMode) {
      setViewerOpen(false);
    }
  }, [isDebugMode]);

  // SSE connection for server logs
  useEffect(() => {
    if (!isDebugMode || !isAdmin) return;

    let eventSource: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryCount = 0;

    const connect = () => {
      eventSource = new EventSource('/api/debug/logs/stream');

      eventSource.addEventListener('open', () => {
        setIsConnected(true);
        retryCount = 0;
      });

      eventSource.addEventListener('log', (event) => {
        try {
          const data = JSON.parse(event.data);
          const newLog: LogEntry = {
            ...data,
            id: data.id || generateId(),
            timestamp: data.timestamp || Date.now(),
            source: 'server',
            isPolling: data.isPolling || (data.url && isPollingPath(data.url)),
          };
          setServerLogs(prev => [newLog, ...prev].slice(0, MAX_LOGS));
        } catch {}
      });

      eventSource.addEventListener('error', () => {
        setIsConnected(false);
        eventSource?.close();
        const timeout = Math.min(1000 * Math.pow(2, retryCount), 30000);
        retryTimeout = setTimeout(connect, timeout);
        retryCount++;
      });
    };

    connect();

    return () => {
      setIsConnected(false);
      eventSource?.close();
      clearTimeout(retryTimeout);
    };
  }, [isDebugMode, isAdmin]);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <DebugContext.Provider value={{ isDebugMode, setDebugMode, logs, serverLogs, clearLogs, isViewerOpen, setViewerOpen, isConnected }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (!context) {
    return {
      isDebugMode: false,
      setDebugMode: () => {},
      logs: [],
      serverLogs: [],
      clearLogs: () => {},
      isViewerOpen: false,
      setViewerOpen: () => {},
      isConnected: false,
    };
  }
  return context;
}
