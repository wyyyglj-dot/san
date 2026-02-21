import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/api-handler';
import { getLlmModelById, updateLlmModel, deleteLlmModel } from '@/lib/db-llm';

// GET - 获取单个 LLM 模型
export const GET = adminHandler(async (_req, ctx) => {
  const { id } = ctx.params;
  const model = await getLlmModelById(id);

  if (!model) {
    return NextResponse.json({ error: '模型不存在' }, { status: 404 });
  }

  // 返回安全版本
  const { apiKey, ...safeModel } = model;
  return NextResponse.json({ success: true, data: safeModel });
}, { fallbackMessage: '获取失败', context: '[API] Get LLM model error' });

// PUT - 更新 LLM 模型
export const PUT = adminHandler(async (req, ctx) => {
  const { id } = ctx.params;
  const body = await req.json();

  const model = await updateLlmModel(id, body);

  if (!model) {
    return NextResponse.json({ error: '模型不存在' }, { status: 404 });
  }

  // 返回安全版本
  const { apiKey, ...safeModel } = model;
  return NextResponse.json({ success: true, data: safeModel });
}, { fallbackMessage: '更新失败', context: '[API] Update LLM model error' });

// DELETE - 删除 LLM 模型
export const DELETE = adminHandler(async (_req, ctx) => {
  const { id } = ctx.params;
  const deleted = await deleteLlmModel(id);

  if (!deleted) {
    return NextResponse.json({ error: '模型不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}, { fallbackMessage: '删除失败', context: '[API] Delete LLM model error' });
