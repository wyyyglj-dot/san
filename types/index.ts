// ========================================
// SanHub 类型定义
// ========================================

// 用户角色
// admin: 超级管理员，拥有所有权限
// moderator: 小管理员，只能管理用户（积分、密码、禁用），不能修改超级管理员
// user: 普通用户
export type UserRole = 'user' | 'admin' | 'moderator';

// 生成类型
export type GenerationType = 'sora-video' | 'sora-image' | 'gemini-image' | 'zimage-image' | 'gitee-image' | 'chat' | 'character-card';

// 聊天模型配置
export interface ChatModel {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  modelId: string;
  supportsVision: boolean;
  maxTokens: number;
  enabled: boolean;
  costPerMessage: number;
  createdAt: number;
}

// LLM 模型提供商类型
export type LlmProvider = 'gemini' | 'openai-compatible';

// 模型类型（用于功能绑定）
export type ModelType = 'image' | 'video' | 'llm';

// LLM 模型配置
export interface LlmModel {
  id: string;
  name: string;
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// 功能绑定配置
export interface FeatureBinding {
  featureKey: string;
  modelType: ModelType;
  modelId: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// 安全的 LLM 模型（不含 apiKey）
export type SafeLlmModel = Omit<LlmModel, 'apiKey'>;

// 聊天会话
export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  modelId: string;
  createdAt: number;
  updatedAt: number;
}

// 聊天消息
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[]; // base64 图片
  tokenCount: number;
  createdAt: number;
}

// 用户模型
export interface User {
  id: string;
  email: string;
  password: string; // bcrypt hashed
  name: string;
  role: UserRole;
  balance: number; // 积分余额
  disabled: boolean; // 是否禁用
  concurrencyLimit?: number | null; // 用户级并发限制 (null=继承全局, 0=无限制, >0=具体限制)
  createdAt: number;
  updatedAt: number;
}

// 用户 (不含密码，用于前端)
export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  balance: number;
  disabled: boolean;
  concurrencyLimit?: number | null; // 用户级并发限制
  createdAt: number;
  groupIds?: string[]; // 用户所属的用户组 ID 列表
}

// ========================================
// 用户组与权限
// ========================================

// 用户组
export interface UserGroup {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;   // 是否为默认组（新用户自动加入）
  createdAt: number;
  updatedAt: number;
}

// 用户组成员关联
export interface UserGroupMember {
  id: string;
  userId: string;
  groupId: string;
  createdAt: number;
}

// 用户组-渠道权限关联
export interface GroupChannelPermission {
  id: string;
  groupId: string;
  channelId: string;
  createdAt: number;
}

// 前端使用的用户组（含成员数和渠道数）
export interface SafeUserGroup {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  memberCount: number;
  channelCount: number;
  createdAt: number;
  updatedAt: number;
}

// 用户组模型定价覆盖
export interface GroupModelPricing {
  id: string;
  groupId: string;
  modelId: string;
  modelType: 'image' | 'video';
  customCost: number;
  createdAt: number;
  updatedAt: number;
}

// 生成记录
export interface Generation {
  id: string;
  userId: string;
  type: GenerationType;
  prompt: string;
  params: GenerationParams;
  resultUrl: string; // base64 data URL 或外链
  cost: number; // 消耗积分
  status: 'queued' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  balancePrecharged?: boolean;
  balanceRefunded?: boolean;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

// 生成参数
export interface GenerationParams {
  model?: string;
  modelId?: string;
  aspectRatio?: string;
  duration?: string;
  imageSize?: string;
  size?: string; // Z-Image 分辨率
  referenceImages?: string[]; // base64 数组
  loras?: string | Record<string, number>; // Z-Image LoRA 配置
  channel?: 'modelscope' | 'gitee'; // Z-Image 渠道
  imageCount?: number; // 参考图数量
  videoId?: string;
  videoChannelId?: string;
  videoChannelType?: string; // 视频渠道类型 (sora, kie-ai, openai-compatible, suchuang)
  permalink?: string;
  revised_prompt?: string;
  progress?: number; // 生成进度 0-100
  originalVideoUrl?: string; // 视频原始外部 URL（本地下载前）
  debugInfo?: {
    requestUrl?: string;
    requestMethod?: string;
    requestHeaders?: Record<string, string>;
    requestBody?: any;
    responseStatus?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: any;
    error?: string;
    [key: string]: any;
  };
}

// SORA 后台配置
export interface SoraBackendConfig {
  soraBackendUrl: string;
  soraBackendUsername: string;
  soraBackendPassword: string;
  soraBackendToken: string; // admin login token
}

// SORA 统计数据
export interface SoraStats {
  total_tokens: number;
  active_tokens: number;
  total_images: number;
  total_videos: number;
  today_images: number;
  today_videos: number;
  total_errors: number;
  today_errors: number;
}

// 公告配置
export interface AnnouncementConfig {
  title: string;
  content: string; // 支持 HTML
  enabled: boolean;
  updatedAt: number;
}

// 渠道启用配置
export interface ChannelEnabledConfig {
  sora: boolean;
  gemini: boolean;
  zimage: boolean;
  gitee: boolean;
}

// 每日请求限制配置
export interface DailyLimitConfig {
  imageLimit: number;      // 图像生成每日限制，0 表示不限制
  videoLimit: number;      // 视频生成每日限制，0 表示不限制
  characterCardLimit: number; // 角色卡每日限制，0 表示不限制
}

// 模型禁用配置
export interface ModelDisabledConfig {
  imageModels: string[];   // 禁用的图像模型 ID 列表
  videoModels: string[];   // 禁用的视频模型 ID 列表
}

// ========================================
// 渠道与模型配置（动态配置）
// ========================================

// 渠道类型 - 决定请求方式
export type ChannelType = 'openai-compatible' | 'modelscope' | 'gitee' | 'gemini' | 'sora' | 'kie-ai' | 'suchuang' | 'jimeng' | 'grok-video';

// API 端点类型 - 决定 openai-compatible 渠道的请求格式
export type ApiEndpointType = 'dalle' | 'chat';

// 模型功能特性
export interface ImageModelFeatures {
  textToImage: boolean;      // 文生图
  imageToImage: boolean;     // 图生图
  upscale: boolean;          // 超分辨率
  matting: boolean;          // 抠图
  multipleImages: boolean;   // 支持多张参考图
  imageSize: boolean;        // 支持分辨率选择 (1K/2K/4K)
}

// 图像渠道配置
export interface ImageChannel {
  id: string;
  name: string;              // 渠道名称，如 "NEWAPI", "ModelScope"
  type: ChannelType;         // 渠道类型，决定请求方式
  baseUrl: string;           // 默认 Base URL
  apiKey: string;            // 默认 API Key（支持多 key 逗号分隔）
  proxyUrl?: string;         // 渠道专用代理（覆盖全局代理）
  enabled: boolean;
  isListed: boolean;         // 是否在前端渠道选择下拉框中显示
  createdAt: number;
  updatedAt: number;
}

// 图像模型配置
export interface ImageModel {
  id: string;
  channelId: string;         // 关联渠道
  name: string;              // 显示名称
  description: string;
  apiModel: string;          // 实际调用的模型名
  apiEndpoint?: ApiEndpointType; // API 端点类型: dalle=/v1/images/generations, chat=/v1/chat/completions
  baseUrl?: string;          // 可选，覆盖渠道默认
  apiKey?: string;           // 可选，覆盖渠道默认
  features: ImageModelFeatures;
  aspectRatios: string[];    // 支持的画面比例
  resolutions: Record<string, string | Record<string, string>>; // 比例对应的分辨率
  imageSizes?: string[];     // 支持的分辨率档位 (1K/2K/4K)
  defaultAspectRatio: string;
  defaultImageSize?: string;
  requiresReferenceImage?: boolean; // 是否必须上传参考图
  allowEmptyPrompt?: boolean;       // 是否允许空提示词
  highlight?: boolean;              // 是否高亮显示
  enabled: boolean;
  costPerGeneration: number;
  sortOrder: number;         // 排序顺序
  createdAt: number;
  updatedAt: number;
}

// 前端使用的渠道（不含敏感信息）
export interface SafeImageChannel {
  id: string;
  name: string;
  type: ChannelType;
  enabled: boolean;
  isListed: boolean;         // 是否在前端渠道选择下拉框中显示
}

// 前端使用的模型（不含敏感信息）
export interface SafeImageModel {
  id: string;
  channelId: string;
  channelType: ChannelType;
  name: string;
  description: string;
  features: ImageModelFeatures;
  aspectRatios: string[];
  resolutions: Record<string, string | Record<string, string>>;
  imageSizes?: string[];
  defaultAspectRatio: string;
  defaultImageSize?: string;
  requiresReferenceImage?: boolean;
  allowEmptyPrompt?: boolean;
  highlight?: boolean;
  enabled: boolean;
  costPerGeneration: number;
}

// ========================================
// 视频渠道与模型配置
// ========================================

// 视频模型功能特性
export interface VideoModelFeatures {
  textToVideo: boolean;      // 文生视频
  imageToVideo: boolean;     // 图生视频
  referenceToVideo: boolean; // 双图参考生视频 (R2V)
  videoToVideo: boolean;     // 视频转视频
  supportStyles: boolean;    // 支持风格选择
  characterCreation: boolean; // 角色卡创建
  omniReference: boolean;    // 即梦-多主体（全能参考）
}

// 视频渠道配置
export interface VideoChannel {
  id: string;
  name: string;
  type: ChannelType;
  baseUrl: string;
  apiKey: string;
  proxyUrl?: string;         // 渠道专用代理（覆盖全局代理）
  enabled: boolean;
  isListed: boolean;    // 是否在前端渠道选择下拉框中显示
  /** @deprecated 已弃用，角色创建通过视频模型的 characterCreation 特性配置 */
  characterApiBaseUrl?: string;
  /** @deprecated 已弃用，角色创建通过视频模型的 characterCreation 特性配置 */
  characterApiKey?: string;
  createdAt: number;
  updatedAt: number;
}

// 视频时长选项
export interface VideoDuration {
  value: string;   // 如 "10s"
  label: string;   // 如 "10 秒"
  cost: number;    // 该时长的积分消耗
}

// 视频模型配置
export interface VideoModel {
  id: string;
  channelId: string;
  name: string;
  description: string;
  apiModel: string;
  baseUrl?: string;
  apiKey?: string;
  features: VideoModelFeatures;
  aspectRatios: Array<{ value: string; label: string }>;
  durations: VideoDuration[];
  defaultAspectRatio: string;
  defaultDuration: string;
  hdEnabled?: boolean;
  highlight?: boolean;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

// 前端使用的视频渠道
export interface SafeVideoChannel {
  id: string;
  name: string;
  type: ChannelType;
  enabled: boolean;
  isListed: boolean;    // 是否在前端渠道选择下拉框中显示
}

// 前端使用的视频模型
export interface SafeVideoModel {
  id: string;
  channelId: string;
  channelType: ChannelType;
  name: string;
  description: string;
  features: VideoModelFeatures;
  aspectRatios: Array<{ value: string; label: string }>;
  durations: VideoDuration[];
  defaultAspectRatio: string;
  defaultDuration: string;
  highlight?: boolean;
  enabled: boolean;
}

// 速率限制配置
export interface RateLimitConfigSettings {
  api: number;
  generate: number;
  chat: number;
  auth: number;
  windowSeconds?: number;
}

// 重试策略配置
export interface RetryStrategyConfig {
  enabled: boolean;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  maxElapsedMs?: number;
  jitterRatio?: number;
  respectRetryAfter?: boolean;
}

// 重试配置
export interface RetryConfig {
  http: RetryStrategyConfig;
  rateLimit: RetryStrategyConfig;
  soraPolling: RetryStrategyConfig & {
    maxPollDurationMs: number;
    stallThreshold: number;
  };
  soraFailed: RetryStrategyConfig;
}

// 网站配置
export interface SiteConfig {
  siteName: string;           // 网站名称，如 SANHUB
  siteTagline: string;        // 英文标语，如 Let Imagination Come Alive
  siteDescription: string;    // 中文描述
  siteSubDescription: string; // 中文副描述
  contactEmail: string;       // 联系邮箱
  copyright: string;          // 版权信息
  poweredBy: string;          // 技术支持信息
}

// 系统配置
export interface SystemConfig {
  soraApiKey: string;
  soraBaseUrl: string;
  // 角色创建 API 配置（已弃用，通过视频模型 characterCreation 特性配置）
  characterApiBaseUrl: string;
  characterApiKey: string;
  // SORA 后台配置
  soraBackendUrl: string;
  soraBackendUsername: string;
  soraBackendPassword: string;
  soraBackendToken: string;
  geminiApiKey: string;
  geminiBaseUrl: string;
  zimageApiKey: string;
  zimageBaseUrl: string;
  giteeFreeApiKey: string;
  giteeApiKey: string; // 支持多key，用逗号分隔
  giteeBaseUrl: string;
  // PicUI 图床配置
  picuiApiKey: string;
  picuiBaseUrl: string;
  pricing: PricingConfig;
  registerEnabled: boolean;
  defaultBalance: number;
  // 公告配置
  announcement: AnnouncementConfig;
  // 渠道启用配置
  channelEnabled: ChannelEnabledConfig;
  // 每日请求限制配置
  dailyLimit: DailyLimitConfig;
  // 速率限制配置
  rateLimit: RateLimitConfigSettings;
  // 模型禁用配置
  disabledModels: ModelDisabledConfig;
  // 网站配置
  siteConfig: SiteConfig;
  // 页面可见性配置（禁用的页面路径列表）
  disabledPages: string[];
  // 并发限制配置
  defaultConcurrencyLimit: number; // 全局默认并发限制 (0=无限制, >0=具体限制)
  // 重试配置
  retryConfig: RetryConfig;
  // CloudFlare-ImgBed 文件床配置
  imgbedEnabled: boolean;
  imgbedBaseUrl: string;
  imgbedApiToken: string;
  imgbedAuthCode: string;
  imgbedUploadChannel: string;
  imgbedBackupEnabled: boolean;
  imgbedBackupBaseUrl: string;
  imgbedBackupApiToken: string;
  imgbedBackupAuthCode: string;
  imgbedBackupUploadChannel: string;
  imgbedMaxFileSize: number;
  imgbedAllowedTypes: string;
  imgbedUploadFolder: string;
  soraLogVerbose: boolean;
  // 代理配置
  proxyEnabled: boolean;
  proxyUrl: string;
  // SMTP 邮件配置
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
}

// 定价配置
export interface PricingConfig {
  soraVideo10s: number;
  soraVideo15s: number;
  soraVideo25s: number;
  soraImage: number;
  geminiNano: number;
  geminiPro: number;
  zimageImage: number;
  giteeImage: number;
}

// API 响应
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Sora 生成请求
export interface SoraGenerateRequest {
  prompt: string;
  model: string; // sora2-landscape-10s, sora-image 等
  files?: { mimeType: string; data: string }[];
  referenceImageUrl?: string;
  style_id?: string; // 风格: festive, retro, news, selfie, handheld, anime, comic, golden, vintage
  remix_target_id?: string; // Remix 视频 ID
}

// 生成结果
export interface GenerateResult {
  type: GenerationType;
  url: string;
  cost: number;
  videoId?: string;
  videoChannelId?: string;
  videoChannelType?: string;
  permalink?: string;
  revised_prompt?: string;
}

// NextAuth 扩展
declare module 'next-auth' {
  interface Session {
    user: SafeUser;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    balance: number;
  }
}

// 角色卡
export interface CharacterCard {
  id: string;
  userId: string;
  characterName: string; // 角色名称 (如 @lotuswhisp719)
  avatarUrl: string; // 角色头像 URL
  sourceVideoUrl?: string; // 源视频 URL (可选)
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

// ========================================
// 邀请码系统
// ========================================

export interface InviteCode {
  id: string;
  code: string;
  creatorId: string;
  usedBy?: string;
  usedAt?: number;
  bonusPoints: number;    // 被邀请人获得的额外积分
  creatorBonus: number;   // 邀请人获得的积分奖励
  expiresAt?: number;
  createdAt: number;
}

// ========================================
// 卡密系统
// ========================================

export interface RedemptionCode {
  id: string;
  code: string;
  points: number;
  usedBy?: string;
  usedAt?: number;
  expiresAt?: number;
  batchId?: string;
  note?: string;
  createdAt: number;
}

// ========================================
// 数据统计
// ========================================

export interface DailyStats {
  date: string;           // YYYY-MM-DD
  generations: number;
  users: number;
  points: number;
}

export interface StatsOverview {
  totalUsers: number;
  totalGenerations: number;
  totalPoints: number;
  todayUsers: number;
  todayGenerations: number;
  dailyStats: DailyStats[];
}

// ========================================
// Art Styles
// ========================================

export interface SafeArtStyle {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverImageUrl: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  referenceImageUrl?: string;
}

export interface LlmPrompt {
  featureKey: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  defaultSystemPrompt: string;
  defaultUserPromptTemplate: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export type SafeLlmPrompt = Omit<LlmPrompt, 'defaultSystemPrompt' | 'defaultUserPromptTemplate'>;

// ========================================
// Agent 管理系统
// ========================================

// Agent 配置结构
export interface AgentConfig {
  role: string;
  rules: AgentRule[];
  workflow: AgentWorkflowStep[];
  examples: AgentExample[];
  returnFormat: string;
  placeholders: AgentPlaceholder[];
}

export interface AgentRule {
  id: string;
  title: string;
  content: string;
}

export interface AgentWorkflowStep {
  id: string;
  title: string;
  content: string;
}

export interface AgentExample {
  id: string;
  title: string;
  input: string;
  output: string;
}

export interface AgentPlaceholder {
  id: string;
  key: string;
  description: string;
  required: boolean;
}

// Agent 完整数据
export interface LlmAgent {
  featureKey: string;
  name: string;
  description: string;
  config: AgentConfig;
  systemPrompt: string;
  userPromptTemplate: string;
  defaultConfig: AgentConfig;
  defaultSystemPrompt: string;
  defaultUserPromptTemplate: string;
  currentVersion: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// 前端安全版本（不含默认值）
export type SafeLlmAgent = Omit<LlmAgent, 'defaultConfig' | 'defaultSystemPrompt' | 'defaultUserPromptTemplate'> & {
  jsonSchema?: object;
};

// Agent 版本记录
export interface AgentVersion {
  id: string;
  featureKey: string;
  version: number;
  config: AgentConfig;
  systemPrompt: string;
  userPromptTemplate: string;
  changeSummary: string;
  createdAt: number;
  createdBy: string;
}

// Agent 摘要（列表用）
export interface AgentSummary {
  featureKey: string;
  name: string;
  description: string;
  enabled: boolean;
  currentVersion: number;
  updatedAt: number;
}
