export const DEFAULT_URLS = {
  sora: 'http://localhost:8000',
  gemini: 'https://generativelanguage.googleapis.com',
  modelscope: 'https://api-inference.modelscope.cn/',
  gitee: 'https://ai.gitee.com/',
  picui: 'https://picui.cn/api/v1',
} as const;

export const DEFAULT_PRICING = {
  soraVideo10s: 100,
  soraVideo15s: 150,
  soraVideo25s: 200,
  soraImage: 50,
  geminiNano: 10,
  geminiPro: 30,
  zimageImage: 30,
  giteeImage: 30,
  chat: 1,
} as const;

export const DEFAULT_SYSTEM = {
  registerEnabled: true,
  defaultBalance: 100,
  defaultConcurrencyLimit: 2,
} as const;
