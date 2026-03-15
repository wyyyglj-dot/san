import type { LogEntry } from '@/types/debug';

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
const SENSITIVE_KEYS = ['password', 'token', 'apikey', 'secret', 'credential'];
const SENSITIVE_QUERY_KEYS = ['password', 'token', 'apikey', 'api_key', 'secret', 'credential', 'access_token', 'refresh_token'];
const MAX_BODY_SIZE = 10 * 1024;

export function sanitizeUrl(input: string): string {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(input, base);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEYS.some(k => key.toLowerCase().includes(k))) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    return url.toString();
  } catch {
    return input;
  }
}

export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeObject(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitizeObject(value);
    }
  }
  return result;
}

function sanitizePlainText(value: string): string {
  return value.replace(
    /(\b(password|token|apikey|api_key|secret|credential)\b\s*[:=]\s*)([^&\s,]+)/gi,
    '$1[REDACTED]'
  );
}

export function sanitizeBody(body: string): string {
  let sanitized: string;
  try {
    const parsed = JSON.parse(body);
    sanitized = JSON.stringify(sanitizeObject(parsed));
  } catch {
    sanitized = sanitizePlainText(body);
  }
  if (sanitized.length > MAX_BODY_SIZE) {
    return sanitized.slice(0, MAX_BODY_SIZE) + '... [TRUNCATED]';
  }
  return sanitized;
}

export function exportLogs(logs: LogEntry[], format: 'json' | 'text' = 'json') {
  const content = format === 'json'
    ? JSON.stringify(logs, null, 2)
    : logs.map(l =>
        `[${new Date(l.timestamp).toISOString()}] ${l.type.toUpperCase()}: ${l.method || ''} ${l.url || l.message || ''}`
      ).join('\n');

  const blob = new Blob([content], {
    type: format === 'json' ? 'application/json' : 'text/plain'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `debug-logs-${Date.now()}.${format === 'json' ? 'json' : 'txt'}`;
  a.click();
  URL.revokeObjectURL(url);
}
