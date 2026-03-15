export function looksLikeHtml(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html');
}

export function parseJsonText<T>(text: string, apiName: string): T {
  if (looksLikeHtml(text)) {
    const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
    const label = titleMatch ? titleMatch[1].trim() : 'Unknown';
    throw new Error(`${apiName} 返回 HTML: ${label}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${apiName} JSON 解析失败: ${text.substring(0, 100)}`);
  }
}

type ResponseLike = {
  status: number;
  statusText?: string;
  text: () => Promise<string>;
};

export async function parseJsonResponse<T>(
  response: ResponseLike,
  apiName: string
): Promise<T> {
  const text = await response.text();
  return parseJsonText<T>(text, apiName);
}

export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
