import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { checkProjectAccess, getComicProjectById } from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

const DEFAULT_START_ORDER = 1;
const DEFAULT_TITLE_TEMPLATE = '第{n}集';
const MAX_EPISODES = 200;
const MAX_INPUT_LENGTH = 500000;

// 从标题模板动态生成识别正则
// 例如: "{n}集" → /^\s*(\d+|[零〇一二三四五六七八九十百千两]+)\s*集/iu
function buildPatternFromTemplate(template: string): RegExp {
  // 转义正则特殊字符，但保留 {n}
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, (char) => {
    if (char === '{' || char === '}') return char;
    return '\\' + char;
  });
  // 将 {n} 替换为数字捕获组（支持阿拉伯数字和中文数字）
  const pattern = escaped.replace(
    /\{n\}/g,
    '(?<num>\\d+|[零〇一二三四五六七八九十百千两]+)'
  );
  // 行首匹配，允许前后有空白
  return new RegExp(`^\\s*${pattern}`, 'iu');
}

type SplitItem = {
  orderNum: number;
  title: string;
  content: string;
  sourceType: 'split';
  mode: string;
};

type SplitStats = {
  total: number;
  emptySegments: number;
};

type SplitResult = {
  items: SplitItem[];
  stats: SplitStats;
};

type SplitOptions = {
  startOrderNum: number;
  titleTemplate: string;
  maxEpisodes: number;
  mode: string;
};

function normalizeInput(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parsePositiveInt(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : parseInt(String(value || ''), 10);
  if (!Number.isFinite(raw)) return null;
  const normalized = Math.floor(raw);
  if (normalized <= 0) return null;
  return normalized;
}

function parseStartOrderNum(value: unknown): number {
  const parsed = parsePositiveInt(value);
  return parsed ?? DEFAULT_START_ORDER;
}

function parseMaxEpisodes(value: unknown): number {
  const parsed = parsePositiveInt(value);
  if (!parsed) return MAX_EPISODES;
  return Math.min(MAX_EPISODES, parsed);
}

function parseTitleTemplate(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed && trimmed.includes('{n}')) {
      return trimmed;
    }
  }
  return DEFAULT_TITLE_TEMPLATE;
}

function normalizeMode(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  const normalizedFallback = typeof fallback === 'string' ? fallback.trim() : '';
  return normalizedFallback || 'ai_merge';
}

function formatTitle(template: string, orderNum: number): string {
  return template.replace('{n}', String(orderNum));
}

function parseNumber(token: string | undefined): number | null {
  if (!token) return null;
  if (/^\d+$/.test(token)) {
    return parseInt(token, 10);
  }
  return parseChineseNumber(token);
}

function parseChineseNumber(value: string): number | null {
  const digits: Record<string, number> = {
    '零': 0, '〇': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '两': 2,
  };

  const units: Record<string, number> = {
    '十': 10, '百': 100, '千': 1000,
  };

  let total = 0;
  let current = 0;

  for (const char of value) {
    if (digits[char] !== undefined) {
      current = digits[char];
      continue;
    }
    if (units[char] !== undefined) {
      const unit = units[char];
      if (current === 0) {
        current = 1;
      }
      total += current * unit;
      current = 0;
      continue;
    }
    return null;
  }

  return total + current;
}

function splitEpisodes(input: string, options: SplitOptions): SplitResult {
  const text = normalizeInput(input);
  const lines = text.split('\n');
  const items: SplitItem[] = [];
  let emptySegments = 0;
  let current: { orderNum: number; title: string; lines: string[] } | null = null;
  let nextOrder = options.startOrderNum;

  // 从标题模板动态生成识别正则
  const headingRegex = buildPatternFromTemplate(options.titleTemplate);

  const flushCurrent = (): boolean => {
    if (!current) return true;
    const content = current.lines.join('\n').trim();
    if (!content) emptySegments += 1;
    if (items.length >= options.maxEpisodes) {
      current = null;
      return false;
    }
    items.push({
      orderNum: current.orderNum,
      title: current.title,
      content,
      sourceType: 'split',
      mode: options.mode,
    });
    current = null;
    return true;
  };

  for (const line of lines) {
    const match = headingRegex.exec(line);
    if (match) {
      if (!flushCurrent()) break;
      const token = match.groups?.num;
      const parsed = parseNumber(token);
      let orderNum = parsed ?? nextOrder;
      if (orderNum < 1) orderNum = nextOrder;
      if (orderNum >= nextOrder) nextOrder = orderNum + 1;
      const title = formatTitle(options.titleTemplate, orderNum);
      current = { orderNum, title, lines: [] };
      continue;
    }

    if (!current) {
      if (items.length >= options.maxEpisodes) break;
      const orderNum = nextOrder;
      const title = formatTitle(options.titleTemplate, orderNum);
      nextOrder += 1;
      current = { orderNum, title, lines: [] };
    }
    current.lines.push(line);
  }

  if (current) {
    flushCurrent();
  }

  return { items, stats: { total: items.length, emptySegments } };
}

export const POST = authHandler(async (req, ctx, session) => {
    const { id } = ctx.params;
    const project = await getComicProjectById(id);
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const access = await checkProjectAccess(id, session.user.id);
    if (!access) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    if (project.deletedAt && access === 'member') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const rule =
      body && typeof body.rule === 'object' && body.rule !== null
        ? (body.rule as Record<string, unknown>)
        : {};

    const content = typeof body.content === 'string' ? body.content : '';
    if (!content.trim()) {
      return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
    }

    if (content.length > MAX_INPUT_LENGTH) {
      return NextResponse.json({ error: '内容过大' }, { status: 413 });
    }

    const startOrderNum = parseStartOrderNum(rule.startOrderNum ?? body.startOrderNum);
    const titleTemplate = parseTitleTemplate(rule.titleTemplate ?? body.titleTemplate);
    const maxEpisodes = parseMaxEpisodes(rule.maxEpisodes ?? body.maxEpisodes);
    const mode = normalizeMode(body.mode, project.mode || 'ai_merge');

    const result = splitEpisodes(content, { startOrderNum, titleTemplate, maxEpisodes, mode });

    return NextResponse.json({ success: true, data: result });
}, {
  fallbackMessage: '拆分失败',
  context: '[API] Episode split',
});
