import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LlmModel } from '@/types';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Suppress console.log/error in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

import { generateLlmText } from '../llm-client';

const baseConfig: LlmModel = {
  id: 'm1',
  name: 'Test Model',
  provider: 'openai-compatible',
  modelName: 'gpt-4',
  baseUrl: 'https://api.example.com',
  apiKey: 'sk-test',
  maxTokens: 2048,
  temperature: 0.5,
  enabled: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- Config validation ----

describe('generateLlmText – config validation', () => {
  it('throws when apiKey is missing', async () => {
    await expect(
      generateLlmText({ ...baseConfig, apiKey: '' }, { systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow('API key is missing');
  });

  it('throws when baseUrl is missing', async () => {
    await expect(
      generateLlmText({ ...baseConfig, baseUrl: '' }, { systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow('base URL is missing');
  });

  it('throws when modelName is missing', async () => {
    await expect(
      generateLlmText({ ...baseConfig, modelName: '' }, { systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow('model name is missing');
  });

  it('throws for unsupported provider', async () => {
    await expect(
      generateLlmText(
        { ...baseConfig, provider: 'unknown' as any },
        { systemPrompt: 's', userPrompt: 'u' },
      ),
    ).rejects.toThrow('Unsupported LLM provider');
  });
});

// ---- OpenAI-compatible provider ----

describe('generateLlmText – openai-compatible', () => {
  it('returns text and usage on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello world' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const result = await generateLlmText(baseConfig, {
      systemPrompt: 'You are helpful',
      userPrompt: 'Say hello',
    });

    expect(result.text).toBe('Hello world');
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  it('falls back to reasoning_content when content is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '', reasoning_content: 'Thinking...' } }],
      }),
    });

    const result = await generateLlmText(baseConfig, {
      systemPrompt: 's',
      userPrompt: 'u',
    });
    expect(result.text).toBe('Thinking...');
    expect(result.reasoningText).toBe('Thinking...');
  });

  it('throws on empty response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '' } }] }),
    });

    await expect(
      generateLlmText(baseConfig, { systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow('response is empty');
  });

  it('throws on API error with parsed message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: 'Rate limited' } }),
    });

    await expect(
      generateLlmText(baseConfig, { systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow('Rate limited');
  });

  it('builds correct URL with trailing slash', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    });

    await generateLlmText(
      { ...baseConfig, baseUrl: 'https://api.example.com/' },
      { systemPrompt: 's', userPrompt: 'u' },
    );

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe('https://api.example.com/v1/chat/completions');
  });

  it('uses option temperature over config temperature', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    });

    await generateLlmText(baseConfig, {
      systemPrompt: 's',
      userPrompt: 'u',
      temperature: 0.9,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.9);
  });
});

// ---- Gemini provider ----

describe('generateLlmText – gemini', () => {
  const geminiConfig: LlmModel = {
    ...baseConfig,
    provider: 'gemini',
    modelName: 'gemini-pro',
    baseUrl: 'https://generativelanguage.googleapis.com',
  };

  function makeGeminiStream(chunks: unknown[]) {
    const text = JSON.stringify(chunks);
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    });
  }

  it('returns text from streamed chunks', async () => {
    const body = makeGeminiStream([
      {
        candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
        usageMetadata: { promptTokenCount: 8, totalTokenCount: 12 },
      },
    ]);

    mockFetch.mockResolvedValue({ ok: true, status: 200, body });

    const result = await generateLlmText(geminiConfig, {
      systemPrompt: 'sys',
      userPrompt: 'usr',
    });

    expect(result.text).toBe('Hello');
    expect(result.usage).toEqual({
      promptTokens: 8,
      completionTokens: 4,
      totalTokens: 12,
    });
  });

  it('concatenates text from multiple chunks', async () => {
    const body = makeGeminiStream([
      { candidates: [{ content: { parts: [{ text: 'A' }] } }] },
      { candidates: [{ content: { parts: [{ text: 'B' }] } }] },
      {
        candidates: [{ content: { parts: [{ text: 'C' }] } }],
        usageMetadata: { promptTokenCount: 5, totalTokenCount: 10 },
      },
    ]);

    mockFetch.mockResolvedValue({ ok: true, status: 200, body });

    const result = await generateLlmText(geminiConfig, {
      systemPrompt: 's',
      userPrompt: 'u',
    });
    expect(result.text).toBe('ABC');
  });

  it('extracts reasoning from thought parts', async () => {
    const body = makeGeminiStream([
      {
        candidates: [{
          content: {
            parts: [
              { text: 'thinking...', thought: true },
              { text: 'answer' },
            ],
          },
        }],
      },
    ]);

    mockFetch.mockResolvedValue({ ok: true, status: 200, body });

    const result = await generateLlmText(geminiConfig, {
      systemPrompt: 's',
      userPrompt: 'u',
    });
    expect(result.text).toBe('answer');
    expect(result.reasoningText).toBe('thinking...');
  });

  it('throws on empty Gemini response', async () => {
    const body = makeGeminiStream([
      { candidates: [{ content: { parts: [] } }] },
    ]);

    mockFetch.mockResolvedValue({ ok: true, status: 200, body });

    await expect(
      generateLlmText(geminiConfig, { systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow('empty');
  });

  it('throws on Gemini API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad request',
    });

    await expect(
      generateLlmText(geminiConfig, { systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow('Gemini API error (400)');
  });
});
