import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = path.join(process.cwd(), 'data', 'prompts');

// Validation constants
const MAX_NAME_LENGTH = 50;
const MAX_CONTENT_SIZE = 50000; // 50KB
const VALID_NAME_PATTERN = /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/;

async function ensureDir() {
  try {
    await fs.mkdir(PROMPTS_DIR, { recursive: true });
  } catch {}
}

// GET: List all prompt templates
export const GET = authHandler(async (req, ctx, session) => {
  await ensureDir();
  const files = await fs.readdir(PROMPTS_DIR);
  const templates = await Promise.all(
    files
      .filter((f) => f.endsWith('.txt'))
      .map(async (f) => {
        const content = await fs.readFile(path.join(PROMPTS_DIR, f), 'utf-8');
        return {
          id: f.replace('.txt', ''),
          name: f.replace('.txt', ''),
          content: content.trim(),
        };
      }),
  );

  return NextResponse.json({ success: true, data: templates });
});

// POST: Create or update a prompt template
export const POST = authHandler(async (req, ctx, session) => {
  const body = await req.json();
  const { name, content } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ success: false, error: '名称不能为空' }, { status: 400 });
  }
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ success: false, error: '内容不能为空' }, { status: 400 });
  }

  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { success: false, error: `名称不能超过 ${MAX_NAME_LENGTH} 个字符` },
      { status: 400 },
    );
  }

  if (content.length > MAX_CONTENT_SIZE) {
    return NextResponse.json(
      { success: false, error: `内容不能超过 ${MAX_CONTENT_SIZE} 个字符` },
      { status: 400 },
    );
  }

  const safeName = name.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, MAX_NAME_LENGTH);
  if (!safeName || !VALID_NAME_PATTERN.test(safeName)) {
    return NextResponse.json({ success: false, error: '名称包含无效字符' }, { status: 400 });
  }

  await ensureDir();
  const filePath = path.join(PROMPTS_DIR, `${safeName}.txt`);
  await fs.writeFile(filePath, content.trim(), 'utf-8');

  return NextResponse.json({
    success: true,
    data: { id: safeName, name: safeName, content: content.trim() },
  });
});

// DELETE: Delete a prompt template
export const DELETE = authHandler(async (req, ctx, session) => {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ success: false, error: '名称不能为空' }, { status: 400 });
  }

  const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  if (!safeName || !VALID_NAME_PATTERN.test(safeName)) {
    return NextResponse.json({ success: false, error: '名称格式无效' }, { status: 400 });
  }

  const filePath = path.join(PROMPTS_DIR, `${safeName}.txt`);

  try {
    await fs.unlink(filePath);
  } catch {
    return NextResponse.json({ success: false, error: '模板不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
});
