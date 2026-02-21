export type LogType = 'request' | 'response' | 'error' | 'navigation';
export type LogSource = 'client' | 'server';

export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogType;
  source: LogSource;
  isPolling?: boolean;
  method?: string;
  url?: string;
  status?: number;
  duration?: number;
  headers?: Record<string, string>;
  body?: string;
  message?: string;
}

export interface DebugContextType {
  isDebugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  logs: LogEntry[];
  serverLogs: LogEntry[];
  clearLogs: () => void;
  isViewerOpen: boolean;
  setViewerOpen: (open: boolean) => void;
  isConnected: boolean;
}
