/* eslint-disable no-console */
import type { User, Generation, SystemConfig, SafeUser, PricingConfig, ChatModel, ChatSession, ChatMessage, CharacterCard, RetryConfig, AgentConfig } from '@/types';
import { generateId } from './utils';
import { compileSystemPrompt } from './agent-utils';
import bcrypt from 'bcryptjs';
import type { DatabaseAdapter } from './db-adapter';
import { getSharedAdapter } from './db-connection';
import { cache, CacheKeys, CacheTTL, withCache } from './cache';
import { applyHardLimits, getDefaultRetryConfig, mergeRetryConfig } from './retry-config-validator';
import { appendLimitOffset } from './db-pagination';
import { getAffectedRows } from './db-types';

// ========================================
// 数据库连接（支持 SQLite �?MySQL�?
// ========================================

function getAdapter(): DatabaseAdapter {
  return getSharedAdapter();
}

// ========================================
// 数据库初始化
// ========================================

const CREATE_TABLES_SQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(191) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role ENUM('user', 'admin', 'moderator') DEFAULT 'user',
  balance INT DEFAULT 100,
  disabled TINYINT(1) DEFAULT 0,
  concurrency_limit INT DEFAULT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_email (email)
);

-- 生成记录表
CREATE TABLE IF NOT EXISTS generations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type ENUM('sora-video', 'sora-image', 'gemini-image', 'zimage-image', 'gitee-image') NOT NULL,
  prompt TEXT,
  params TEXT,
  result_url LONGTEXT,
  cost INT DEFAULT 0,
  balance_precharged TINYINT(1) DEFAULT 0,
  balance_refunded TINYINT(1) DEFAULT 0,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  error_message TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  id INT PRIMARY KEY DEFAULT 1,
  sora_api_key VARCHAR(500) DEFAULT '',
  sora_base_url VARCHAR(500) DEFAULT 'http://localhost:8000',
  gemini_api_key VARCHAR(500) DEFAULT '',
  gemini_base_url VARCHAR(500) DEFAULT 'https://generativelanguage.googleapis.com',
  zimage_api_key VARCHAR(500) DEFAULT '',
  zimage_base_url VARCHAR(500) DEFAULT 'https://api-inference.modelscope.cn/',
  gitee_api_key TEXT,
  gitee_free_api_key TEXT,
  gitee_base_url VARCHAR(500) DEFAULT 'https://ai.gitee.com/',
  picui_api_key VARCHAR(500) DEFAULT '',
  picui_base_url VARCHAR(500) DEFAULT 'https://picui.cn/api/v1',
  sora_backend_url VARCHAR(500) DEFAULT '',
  sora_backend_username VARCHAR(100) DEFAULT '',
  sora_backend_password VARCHAR(100) DEFAULT '',
  sora_backend_token VARCHAR(500) DEFAULT '',
  pricing_sora_video_10s INT DEFAULT 100,
  pricing_sora_video_15s INT DEFAULT 150,
  pricing_sora_video_25s INT DEFAULT 200,
  pricing_sora_image INT DEFAULT 50,
  pricing_gemini_nano INT DEFAULT 10,
  pricing_gemini_pro INT DEFAULT 30,
  pricing_zimage_image INT DEFAULT 30,
  pricing_gitee_image INT DEFAULT 30,
  pricing_chat INT DEFAULT 1,
  register_enabled TINYINT(1) DEFAULT 1,
  default_balance INT DEFAULT 100,
  default_concurrency_limit INT DEFAULT 2
);

-- 聊天模型表
CREATE TABLE IF NOT EXISTS chat_models (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  api_url VARCHAR(500) NOT NULL,
  api_key VARCHAR(500) NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  supports_vision TINYINT(1) DEFAULT 0,
  max_tokens INT DEFAULT 128000,
  enabled TINYINT(1) DEFAULT 1,
  cost_per_message INT DEFAULT 1,
  created_at BIGINT NOT NULL,
  INDEX idx_enabled (enabled)
);

-- LLM 模型配置表
CREATE TABLE IF NOT EXISTS llm_models (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  base_url VARCHAR(500) NOT NULL,
  api_key TEXT NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  temperature FLOAT DEFAULT 0.7,
  max_tokens INT DEFAULT 4096,
  enabled TINYINT(1) DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 功能绑定表
CREATE TABLE IF NOT EXISTS feature_bindings (
  feature_key VARCHAR(100) PRIMARY KEY,
  model_type VARCHAR(16) NOT NULL,
  model_id VARCHAR(36) NOT NULL,
  enabled TINYINT(1) DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 聊天会话表
CREATE TABLE IF NOT EXISTS chat_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) DEFAULT '新对话',
  model_id VARCHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_updated_at (updated_at)
);

-- 聊天消息表
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content LONGTEXT NOT NULL,
  images TEXT,
  token_count INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  INDEX idx_session_id (session_id),
  INDEX idx_created_at (created_at)
);

-- 角色卡表
CREATE TABLE IF NOT EXISTS character_cards (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  character_name VARCHAR(200) DEFAULT '',
  avatar_url LONGTEXT,
  source_video_url TEXT,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  error_message TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

-- art styles table
CREATE TABLE IF NOT EXISTS art_styles (
  id VARCHAR(36) PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  cover_image_url VARCHAR(500) NOT NULL,
  reference_image_url VARCHAR(500) DEFAULT '',
  is_active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_is_active (is_active),
  INDEX idx_sort_order (sort_order)
);

-- LLM 提示词模板表
CREATE TABLE IF NOT EXISTS llm_prompts (
  feature_key VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  system_prompt LONGTEXT NOT NULL,
  user_prompt_template LONGTEXT NOT NULL,
  default_system_prompt LONGTEXT NOT NULL,
  default_user_prompt_template LONGTEXT NOT NULL,
  enabled TINYINT(1) DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Agent 管理表
CREATE TABLE IF NOT EXISTS llm_agents (
  feature_key VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  config_json LONGTEXT NOT NULL,
  system_prompt LONGTEXT NOT NULL,
  user_prompt_template LONGTEXT NOT NULL,
  default_config_json LONGTEXT NOT NULL,
  default_system_prompt LONGTEXT NOT NULL,
  default_user_prompt_template LONGTEXT NOT NULL,
  current_version INT DEFAULT 1,
  enabled TINYINT(1) DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Agent 版本历史表
CREATE TABLE IF NOT EXISTS llm_agent_versions (
  id VARCHAR(36) PRIMARY KEY,
  feature_key VARCHAR(100) NOT NULL,
  version INT NOT NULL,
  config_json LONGTEXT NOT NULL,
  system_prompt LONGTEXT NOT NULL,
  user_prompt_template LONGTEXT NOT NULL,
  change_summary VARCHAR(500) DEFAULT '',
  created_at BIGINT NOT NULL,
  created_by VARCHAR(100) DEFAULT 'system',
  INDEX idx_feature_key (feature_key),
  UNIQUE INDEX idx_feature_version (feature_key, version)
);

-- Webhook token 表
CREATE TABLE IF NOT EXISTS webhook_tokens (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  task_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  consumed_at DATETIME DEFAULT NULL,
  expires_at DATETIME NOT NULL,
  INDEX idx_task_token (task_id, token_hash)
);
`;

let initialized = false;
let initPromise: Promise<void> | null = null;

function isDuplicateColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  const code = (error as { code?: string }).code;
  const errno = (error as { errno?: number }).errno;

  if (code === 'ER_DUP_FIELDNAME' || errno === 1060) return true;
  if (normalized.includes('duplicate column')) return true;
  return normalized.includes('column already exists');
}

function handleSchemaChangeError(error: unknown): void {
  if (!isDuplicateColumnError(error)) throw error;
}

async function seedDefaultPrompts(db: DatabaseAdapter): Promise<void> {
  const defaults = [
    {
      featureKey: 'storyboard',
      name: 'AI 分镜',
      description: '将剧本内容拆分为分镜画面描述和图像生成提示词',
      systemPrompt:
        'You are a strict JSON generator. Split the episode script into storyboard shots. ' +
        'Return only valid JSON that matches the schema. Do not include markdown or extra text. ' +
        'Each shot must include index, description, and an English image generation prompt.',
      userPromptTemplate: [
        '将以下剧本内容拆分为分镜。',
        '返回 JSON，包含 shots 数组。',
        '每个分镜包含：',
        '- index (number, 从 1 开始)',
        '- description (string, 该分镜的剧情描述)',
        '- prompt (string, 英文图像生成提示词，描述画面构图、角色、场景、光影)',
        '- durationSeconds (number, 可选, 建议时长)',
        '',
        '剧本内容:',
        '"""',
        '{{CONTENT}}',
        '"""',
      ].join('\n'),
    },
    {
      featureKey: 'asset_analyze',
      name: '资产分析',
      description: '从剧本内容中提取角色、场景和道具',
      systemPrompt:
        'You are a strict JSON generator. Analyze the episode content and extract assets. ' +
        'Return only valid JSON that matches the schema. Do not include markdown or extra text.',
      userPromptTemplate: [
        '从以下剧本内容中提取所有角色、场景和道具。',
        '返回 JSON，包含 characters、scenes、props 三个数组。',
        '每个元素包含：',
        '- name (string, 必填)',
        '- description (string, 简短描述)',
        '- attributes (object, 类型特有属性):',
        '  角色: { gender, age, personality, descriptors }',
        '  场景: { timeOfDay, atmosphere }',
        '  道具: { importance }',
        '- sourceText (string, 原文引用片段)',
        '- confidence (number, 0-1 置信度)',
        '',
        '剧本内容:',
        '"""',
        '{{CONTENT}}',
        '"""',
      ].join('\n'),
    },
    {
      featureKey: 'prompt_enhance',
      name: '提示词增强',
      description: '优化和扩展用户输入的图像/视频生成提示词',
      systemPrompt: [
        '你是一个专业的AI视频/图像生成提示词优化专家。你的任务是将用户的简单描述扩展为更详细、更具表现力的提示词，以便AI能生成更高质量的视频或图像。',
        '',
        '要求：',
        '1. {{EXPANSION_GUIDE}}',
        '2. 保持原始创意和主题不变',
        '3. 添加具体的视觉细节：场景、光线、色彩、氛围、镜头角度等',
        '4. 使用专业的视觉描述术语',
        '5. {{DURATION_GUIDE}}',
        '6. 直接输出增强后的提示词，不要添加任何解释、前缀或思考过程',
        '',
        '重要：只输出最终的增强提示词文本，不要输出你的思考过程、分析步骤或任何其他内容。',
      ].join('\n'),
      userPromptTemplate: '{{PROMPT}}',
    },
  ];

  const now = Date.now();
  for (const item of defaults) {
    try {
      const [rows] = await db.execute(
        'SELECT feature_key FROM llm_prompts WHERE feature_key = ?',
        [item.featureKey]
      );
      if ((rows as unknown[]).length > 0) continue;

      await db.execute(
        `INSERT INTO llm_prompts (
          feature_key, name, description, system_prompt, user_prompt_template,
          default_system_prompt, default_user_prompt_template, enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.featureKey,
          item.name,
          item.description,
          item.systemPrompt,
          item.userPromptTemplate,
          item.systemPrompt,
          item.userPromptTemplate,
          1,
          now,
          now,
        ]
      );
    } catch {
      // Ignore duplicate key errors from concurrent initialization
    }
  }
}

async function seedDefaultAgents(db: DatabaseAdapter): Promise<void> {
  const defaults = [
    {
      featureKey: 'storyboard',
      name: 'AI 分镜',
      description: '将剧本内容拆分为分镜画面描述和图像生成提示词',
      role: [
        'You are a strict JSON generator.',
        'Split the episode script into storyboard shots.',
        'Return only valid JSON that matches the schema. Do not include markdown or extra text.',
        'The user message contains the episode content.',
        'Each shot must include index (starting at 1), description, and an English image generation prompt.',
        'durationSeconds is optional.',
      ].join('\n'),
      returnFormat: [
        'Return a JSON object with a "shots" array.',
        'Each item: { index: number, description: string, prompt: string, durationSeconds?: number }.',
      ].join('\n'),
      userPromptTemplate: '{{CONTENT}}',
      placeholders: [{ key: 'CONTENT', description: '剧集内容', required: true }],
    },
    {
      featureKey: 'asset_analyze',
      name: '资产分析',
      description: '从剧本内容中提取角色、场景和道具',
      role: [
        'You are a strict JSON generator. Analyze the episode content and extract assets.',
        'Return only valid JSON that matches the schema. Do not include markdown or extra text.',
        'The user message contains the episode content.',
        'Extract all characters, scenes, and props.',
        'Each item must include name (required). Include description, attributes, sourceText, and confidence when available.',
        'Confidence should be a number between 0 and 1.',
        'Attributes by type: character { gender, age, personality, descriptors }, scene { timeOfDay, atmosphere }, prop { importance }.',
      ].join('\n'),
      returnFormat: [
        'Return a JSON object with arrays: characters, scenes, props.',
        'Each item: { name: string, description?: string, attributes?: object, sourceText?: string, confidence?: number }.',
      ].join('\n'),
      userPromptTemplate: '{{CONTENT}}',
      placeholders: [{ key: 'CONTENT', description: '剧集内容', required: true }],
    },
    {
      featureKey: 'prompt_enhance',
      name: '提示词增强',
      description: '优化和扩展用户输入的图像/视频生成提示词',
      role: [
        '你是一个专业的AI视频/图像生成提示词优化专家。你的任务是将用户的简单描述扩展为更详细、更具表现力的提示词，以便AI能生成更高质量的视频或图像。',
        '',
        '要求：',
        '1. {{EXPANSION_GUIDE}}',
        '2. 保持原始创意和主题不变',
        '3. 添加具体的视觉细节：场景、光线、色彩、氛围、镜头角度等',
        '4. 使用专业的视觉描述术语',
        '5. {{DURATION_GUIDE}}',
        '6. 直接输出增强后的提示词，不要添加任何解释、前缀或思考过程',
        '',
        '重要：只输出最终的增强提示词文本，不要输出你的思考过程、分析步骤或任何其他内容。',
      ].join('\n'),
      returnFormat: '',
      userPromptTemplate: '{{PROMPT}}',
      placeholders: [
        { key: 'PROMPT', description: '原始提示词', required: true },
        { key: 'EXPANSION_GUIDE', description: '扩展级别说明', required: true },
        { key: 'DURATION_GUIDE', description: '视频时长说明', required: true },
      ],
    },
  ];

  const now = Date.now();
  for (const item of defaults) {
    try {
      const [rows] = await db.execute(
        'SELECT feature_key FROM llm_agents WHERE feature_key = ?',
        [item.featureKey]
      );
      if ((rows as unknown[]).length > 0) continue;

      const configObj: AgentConfig = {
        role: item.role,
        rules: [],
        workflow: [],
        examples: [],
        returnFormat: item.returnFormat,
        placeholders: item.placeholders.map((p) => ({ id: '', ...p })),
      };
      const config = JSON.stringify(configObj);

      const systemPrompt = compileSystemPrompt(configObj);

      await db.execute(
        `INSERT INTO llm_agents (
          feature_key, name, description, config_json, system_prompt, user_prompt_template,
          default_config_json, default_system_prompt, default_user_prompt_template,
          current_version, enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.featureKey,
          item.name,
          item.description,
          config,
          systemPrompt,
          item.userPromptTemplate,
          config,
          systemPrompt,
          item.userPromptTemplate,
          1,
          1,
          now,
          now,
        ]
      );

      // 创建初始版本记录
      await db.execute(
        `INSERT INTO llm_agent_versions (
          id, feature_key, version, config_json, system_prompt, user_prompt_template,
          change_summary, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          item.featureKey,
          1,
          config,
          systemPrompt,
          item.userPromptTemplate,
          '初始版本',
          now,
          'system',
        ]
      );
    } catch {
      // Ignore duplicate key errors from concurrent initialization
    }
  }
}

export async function initializeDatabase(): Promise<void> {
  const db = getAdapter();

  // 渠道表始终尝试创建（幂等操作，确保新表被创建）
  await initializeImageChannelsTablesInternal(db);
  await initializeVideoChannelsTablesInternal(db);

  if (initialized) return;

  // Promise 单例锁：防止并发初始化导致主键冲突
  if (initPromise) return initPromise;
  initPromise = doInitializeDatabase(db);
  return initPromise;
}

async function doInitializeDatabase(db: ReturnType<typeof getAdapter>): Promise<void> {

  const statements = CREATE_TABLES_SQL.split(';').filter((s) => s.trim());

  for (const statement of statements) {
    if (statement.trim()) {
      await db.execute(statement);
    }
  }

  const dbType = process.env.DB_TYPE || 'sqlite';

  // 迁移：确保 avatar_url 列是 LONGTEXT（仅 MySQL 需要，SQLite 不支持 MODIFY COLUMN）
  if (dbType === 'mysql') {
    try {
      await db.execute(`
        ALTER TABLE character_cards MODIFY COLUMN avatar_url LONGTEXT
      `);
    } catch (e) {
      // 忽略错误（列可能已经是正确类型或表不存在）
    }
  }

  // 初始化系统配置（INSERT IGNORE 防止并发竞态冲突）
  const insertIgnore = dbType === 'mysql' ? 'INSERT IGNORE INTO' : 'INSERT OR IGNORE INTO';
  await db.execute(`
    ${insertIgnore} system_config (id, sora_api_key, sora_base_url, gemini_api_key, gemini_base_url)
    VALUES (1, ?, ?, ?, ?)
  `, [
    process.env.SORA_API_KEY || '',
    process.env.SORA_BASE_URL || 'http://localhost:8000',
    process.env.GEMINI_API_KEY || '',
    process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
  ]);

  // 初始化管理员账号
  await initializeAdmin();

  // 添加 disabled 字段（如果不存在�?
  try {
    await db.execute('ALTER TABLE users ADD COLUMN disabled BOOLEAN DEFAULT FALSE');
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加 email_verified 字段（如果不存在）
  try {
    await db.execute('ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE');
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加 generations 表的新字段（如果不存在）
  try {
    if (dbType === 'mysql') {
      await db.execute('ALTER TABLE generations ADD COLUMN status ENUM("pending", "processing", "completed", "failed") DEFAULT "pending"');
    } else {
      // SQLite: ENUM 转为 TEXT
      await db.execute('ALTER TABLE generations ADD COLUMN status TEXT DEFAULT "pending"');
    }
  } catch (error) {
    handleSchemaChangeError(error);
  }

  try {
    await db.execute('ALTER TABLE generations ADD COLUMN error_message TEXT');
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加余额预扣/退款标记字段（如果不存在）
  try {
    await db.execute('ALTER TABLE generations ADD COLUMN balance_precharged TINYINT(1) DEFAULT 0');
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute('ALTER TABLE generations ADD COLUMN balance_refunded TINYINT(1) DEFAULT 0');
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 确保 generations.params 列存在（用于存储 permalink / revised_prompt 等扩展信息）
  try {
    if (dbType === 'mysql') {
      await db.execute('ALTER TABLE generations ADD COLUMN params TEXT');
    } else {
      await db.execute('ALTER TABLE generations ADD COLUMN params TEXT');
    }
  } catch (error) {
    handleSchemaChangeError(error);
  }

  try {
    if (dbType === 'mysql') {
      await db.execute('ALTER TABLE generations ADD COLUMN updated_at BIGINT NOT NULL DEFAULT 0');
    } else {
      // SQLite: 不支持 NOT NULL 和 DEFAULT 同时使用在 ALTER TABLE 中
      await db.execute('ALTER TABLE generations ADD COLUMN updated_at INTEGER DEFAULT 0');
    }
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 为已存在的记录设置默认值
  try {
    await db.execute('UPDATE generations SET status = "completed" WHERE status IS NULL OR status = ""');
    await db.execute('UPDATE generations SET updated_at = created_at WHERE updated_at = 0 OR updated_at IS NULL');
    await db.execute("UPDATE generations SET params = '{}' WHERE params IS NULL OR params = ''");
  } catch {
    // 忽略错误
  }

  // 添加 Z-Image 配置字段（如果不存在）
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN zimage_api_key VARCHAR(500) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN zimage_base_url VARCHAR(500) DEFAULT 'https://api-inference.modelscope.cn/'");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute('ALTER TABLE system_config ADD COLUMN pricing_zimage_image INT DEFAULT 30');
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加 Gitee 配置字段（如果不存在）
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN gitee_api_key TEXT");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN gitee_free_api_key TEXT");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN gitee_base_url VARCHAR(500) DEFAULT 'https://ai.gitee.com/'");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute('ALTER TABLE system_config ADD COLUMN pricing_gitee_image INT DEFAULT 30');
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加 25s 视频定价字段
  try {
    await db.execute('ALTER TABLE system_config ADD COLUMN pricing_sora_video_25s INT DEFAULT 200');
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加 SORA 后台配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN sora_backend_url VARCHAR(500) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN sora_backend_username VARCHAR(100) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN sora_backend_password VARCHAR(100) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN sora_backend_token VARCHAR(500) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加角色创建 API 配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN character_api_base_url VARCHAR(500) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN character_api_key VARCHAR(500) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加公告配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN announcement_title VARCHAR(200) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN announcement_content TEXT");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN announcement_enabled TINYINT(1) DEFAULT 0");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN announcement_updated_at BIGINT DEFAULT 0");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加 PicUI 图床配置字段（如果不存在）
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN picui_api_key VARCHAR(500) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN picui_base_url VARCHAR(500) DEFAULT 'https://picui.cn/api/v1'");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加渠道启用配置字段（如果不存在）
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN channel_sora_enabled TINYINT(1) DEFAULT 1");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN channel_gemini_enabled TINYINT(1) DEFAULT 1");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN channel_zimage_enabled TINYINT(1) DEFAULT 1");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN channel_gitee_enabled TINYINT(1) DEFAULT 1");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加每日请求限制配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN daily_limit_image INT DEFAULT 0");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN daily_limit_video INT DEFAULT 0");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN daily_limit_character_card INT DEFAULT 0");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加速率限制配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN rate_limit_api INT DEFAULT 60");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN rate_limit_generate INT DEFAULT 20");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN rate_limit_chat INT DEFAULT 30");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN rate_limit_auth INT DEFAULT 5");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加网站配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN site_name VARCHAR(100) DEFAULT 'SANHUB'");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN site_tagline VARCHAR(200) DEFAULT 'Let Imagination Come Alive'");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN site_description TEXT");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN site_sub_description TEXT");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN contact_email VARCHAR(200) DEFAULT 'support@sanhub.com'");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN site_copyright VARCHAR(200) DEFAULT 'Copyright © 2025 SANHUB'");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN site_powered_by VARCHAR(200) DEFAULT 'Powered by OpenAI Sora & Google Gemini'");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加模型禁用配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN disabled_image_models TEXT");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN disabled_video_models TEXT");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加页面可见性配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN disabled_pages TEXT");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加并发限制配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN default_concurrency_limit INT DEFAULT 2");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加重试配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN retry_config JSON");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // CloudFlare-ImgBed 文件床配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_enabled TINYINT(1) DEFAULT 0");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_base_url VARCHAR(500) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_api_token TEXT");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_auth_code VARCHAR(200) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_upload_channel VARCHAR(50) DEFAULT 'telegram'");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_backup_enabled TINYINT(1) DEFAULT 0");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_backup_base_url VARCHAR(500) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_backup_api_token TEXT");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_backup_auth_code VARCHAR(200) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_backup_upload_channel VARCHAR(50) DEFAULT 'telegram'");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_max_file_size INT DEFAULT 50");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_allowed_types VARCHAR(500) DEFAULT 'mp4,webm,mov'");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN imgbed_upload_folder VARCHAR(500) DEFAULT 'character-cards'");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN sora_log_verbose TINYINT(1) DEFAULT 0");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加用户并发限制字段
  try {
    await db.execute("ALTER TABLE users ADD COLUMN concurrency_limit INT DEFAULT NULL");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 更新 generations 表的 type 字段以支持 gitee-image（MySQL 需要修改 ENUM）
  if (dbType === 'mysql') {
    try {
      await db.execute("ALTER TABLE generations MODIFY COLUMN type ENUM('sora-video', 'sora-image', 'gemini-image', 'zimage-image', 'gitee-image') NOT NULL");
    } catch (error) {
      handleSchemaChangeError(error);
    }
  }

  // 更新 generations 表的 status 字段以支持 cancelled（MySQL 需要修改 ENUM）
  if (dbType === 'mysql') {
    try {
      await db.execute("ALTER TABLE generations MODIFY COLUMN status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending'");
    } catch (error) {
      handleSchemaChangeError(error);
    }
  }

  // 更新 users 表的 role 字段以支持 moderator（MySQL 需要修改 ENUM）
  if (dbType === 'mysql') {
    try {
      await db.execute("ALTER TABLE users MODIFY COLUMN role ENUM('user', 'admin', 'moderator') DEFAULT 'user'");
    } catch (error) {
      handleSchemaChangeError(error);
    }
  }

  await seedDefaultPrompts(db);
  await seedDefaultAgents(db);

  // 添加 SMTP 配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN smtp TEXT DEFAULT NULL");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加代理配置字段
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN proxy_enabled TINYINT(1) DEFAULT 0");
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE system_config ADD COLUMN proxy_url VARCHAR(500) DEFAULT ''");
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加邮箱验证码表
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        type VARCHAR(10) NOT NULL,
        expires_at BIGINT NOT NULL,
        used TINYINT(1) DEFAULT 0,
        attempts INT DEFAULT 0,
        created_at BIGINT NOT NULL,
        INDEX idx_email_type (email, type),
        INDEX idx_expires (expires_at)
      )
    `);
  } catch (error) {
    handleSchemaChangeError(error);
  }

  // 添加 queued 到 generations status ENUM (MySQL)
  if (dbType === 'mysql') {
    try {
      await db.execute("ALTER TABLE generations MODIFY COLUMN status ENUM('queued', 'pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending'");
    } catch (error) {
      handleSchemaChangeError(error);
    }
  }

  // 添加视频渠道角色创建 API 配置字段（如果不存在）
  try {
    await db.execute("ALTER TABLE video_channels ADD COLUMN character_api_base_url VARCHAR(500) DEFAULT ''");
    console.log('[DB Migration] Added character_api_base_url to video_channels');
  } catch (error) {
    handleSchemaChangeError(error);
  }
  try {
    await db.execute("ALTER TABLE video_channels ADD COLUMN character_api_key TEXT");
    console.log('[DB Migration] Added character_api_key to video_channels');
  } catch (error) {
    handleSchemaChangeError(error);
  }

  initialized = true;
  console.log('Database initialized successfully');
}

// ========================================
// 用户操作
// ========================================

export async function createUser(
  email: string,
  password: string,
  name: string,
  role: 'user' | 'admin' = 'user',
  balance?: number
): Promise<User> {
  await initializeDatabase();
  const db = getAdapter();

  // 检查邮箱是否已存在
  const [existing] = await db.execute(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  if ((existing as unknown[]).length > 0) {
    throw new Error('该邮箱已被注册');
  }

  const config = await getSystemConfig();
  const hashedPassword = await bcrypt.hash(password, 10);
  const now = Date.now();

  const user: User = {
    id: generateId(),
    email,
    password: hashedPassword,
    name,
    role,
    balance: balance ?? config.defaultBalance,
    disabled: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.execute(
    `INSERT INTO users (id, email, password, name, role, balance, disabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.email, user.password, user.name, user.role, user.balance, user.disabled, user.createdAt, user.updatedAt]
  );

  // 将新用户添加到默认用户组
  try {
    // 延迟导入避免循环依赖，使用动态调用
    const defaultGroup = await getDefaultUserGroupLazy();
    if (defaultGroup) {
      await addUserToGroupLazy(user.id, defaultGroup.id);
    }
  } catch (e) {
    // 忽略用户组相关错误，不影响用户创建
    console.warn('[DB] Failed to add user to default group:', e);
  }

  return user;
}

// 延迟获取默认用户组（避免循环依赖）
async function getDefaultUserGroupLazy(): Promise<UserGroup | null> {
  try {
    await initializeUserGroupsTables();
    const db = getAdapter();
    const [rows] = await db.execute('SELECT * FROM user_groups WHERE is_default = 1 LIMIT 1');
    const groups = rows;
    if (groups.length === 0) return null;
    const row = groups[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      isDefault: Boolean(row.is_default),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  } catch {
    return null;
  }
}

// 延迟添加用户到用户组（避免循环依赖）
async function addUserToGroupLazy(userId: string, groupId: string): Promise<void> {
  try {
    await initializeUserGroupsTables();
    const db = getAdapter();
    const id = generateId();
    const now = Date.now();
    await db.execute(
      'INSERT INTO user_group_members (id, user_id, group_id, created_at) VALUES (?, ?, ?, ?)',
      [id, userId, groupId, now]
    );
  } catch {
    // 忽略错误
  }
}

export async function getUserById(id: string): Promise<User | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT * FROM users WHERE id = ?',
    [id]
  );

  const users = rows;
  if (users.length === 0) return null;

  const row = users[0];
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    name: row.name,
    role: row.role,
    balance: row.balance,
    disabled: Boolean(row.disabled),
    concurrencyLimit: row.concurrency_limit !== null ? Number(row.concurrency_limit) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function getUserByEmail(email: string): Promise<User | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );

  const users = rows;
  if (users.length === 0) return null;

  const row = users[0];
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    name: row.name,
    role: row.role,
    balance: row.balance,
    disabled: Boolean(row.disabled),
    concurrencyLimit: row.concurrency_limit !== null ? Number(row.concurrency_limit) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function verifyPassword(
  email: string,
  password: string
): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  // 禁用用户不能登录
  if (user.disabled) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  return user;
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<User, 'id' | 'email' | 'createdAt'>>
): Promise<User | null> {
  await initializeDatabase();
  const db = getAdapter();

  const user = await getUserById(id);
  if (!user) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.password !== undefined) {
    fields.push('password = ?');
    values.push(await bcrypt.hash(updates.password, 10));
  }
  if (updates.role !== undefined) {
    fields.push('role = ?');
    values.push(updates.role);
  }
  if (updates.balance !== undefined) {
    fields.push('balance = ?');
    values.push(updates.balance);
  }
  if (updates.disabled !== undefined) {
    fields.push('disabled = ?');
    values.push(updates.disabled);
  }
  if (updates.concurrencyLimit !== undefined) {
    fields.push('concurrency_limit = ?');
    values.push(updates.concurrencyLimit);
  }

  if (fields.length === 0) return user;

  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  await db.execute(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getUserById(id);
}

export type BalanceUpdateMode = 'strict' | 'clamp';

export async function updateUserBalance(
  id: string,
  delta: number,
  mode: BalanceUpdateMode = 'strict'
): Promise<number> {
  await initializeDatabase();
  const db = getAdapter();

  const safeDelta = Number(delta);
  if (!Number.isFinite(safeDelta)) {
    throw new Error('Invalid balance delta');
  }

  const now = Date.now();
  if (mode === 'clamp') {
    const [result] = await db.execute(
      'UPDATE users SET balance = CASE WHEN balance + ? < 0 THEN 0 ELSE balance + ? END, updated_at = ? WHERE id = ?',
      [safeDelta, safeDelta, now, id]
    );
    if (!getAffectedRows(result)) {
      throw new Error('User not found');
    }
    const user = await getUserById(id);
    if (!user) throw new Error('User not found');
    return user.balance;
  }

  const [result] = await db.execute(
    'UPDATE users SET balance = balance + ?, updated_at = ? WHERE id = ? AND balance + ? >= 0',
    [safeDelta, now, id, safeDelta]
  );

  if (!getAffectedRows(result)) {
    const user = await getUserById(id);
    if (!user) throw new Error('User not found');
    throw new Error('Insufficient balance');
  }

  const user = await getUserById(id);
  if (!user) throw new Error('User not found');
  return user.balance;
}

export async function getAllUsers(options: {
  limit?: number;
  offset?: number;
  search?: string;
} = {}): Promise<SafeUser[]> {
  await initializeDatabase();
  const db = getAdapter();
  const limit = Math.max(Number(options.limit) || 200, 1);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const search = options.search?.trim();

  let sql = 'SELECT id, email, name, role, balance, disabled, concurrency_limit, created_at FROM users';
  const params: unknown[] = [];

  if (search) {
    sql += ' WHERE email LIKE ? OR name LIKE ?';
    const term = `%${search}%`;
    params.push(term, term);
  }

  sql += ' ORDER BY created_at DESC';
  sql = appendLimitOffset(sql, params, limit, offset);

  const [rows] = await db.execute(sql, params);

  return (rows).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    balance: row.balance,
    disabled: Boolean(row.disabled),
    concurrencyLimit: row.concurrency_limit !== null ? Number(row.concurrency_limit) : null,
    createdAt: Number(row.created_at),
  }));
}

export async function getUsersCount(search?: string): Promise<number> {
  await initializeDatabase();
  const db = getAdapter();
  const term = search?.trim();

  let sql = 'SELECT COUNT(1) as count FROM users';
  const params: unknown[] = [];

  if (term) {
    sql += ' WHERE email LIKE ? OR name LIKE ?';
    const like = `%${term}%`;
    params.push(like, like);
  }

  const [rows] = await db.execute(sql, params);
  const row = (rows)[0];
  return Number(row?.count || 0);
}

export async function deleteUser(id: string): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();

  const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);
  return getAffectedRows(result) > 0;
}

// ========================================
// 生成记录操作
// ========================================

export async function saveGeneration(
  generation: Omit<Generation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Generation> {
  await initializeDatabase();
  const db = getAdapter();

  const now = Date.now();
  const gen: Generation = {
    ...generation,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    balancePrecharged: generation.balancePrecharged ?? false,
    balanceRefunded: generation.balanceRefunded ?? false,
  };

  await db.execute(
    `INSERT INTO generations (id, user_id, type, prompt, params, result_url, cost, balance_precharged, balance_refunded, status, error_message, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      gen.id,
      gen.userId,
      gen.type,
      gen.prompt,
      JSON.stringify(gen.params),
      gen.resultUrl,
      gen.cost,
      gen.balancePrecharged ? 1 : 0,
      gen.balanceRefunded ? 1 : 0,
      gen.status,
      gen.errorMessage || null,
      gen.createdAt,
      gen.updatedAt,
    ]
  );

  return gen;
}

export async function updateGeneration(
  id: string,
  updates: Partial<Pick<Generation, 'status' | 'resultUrl' | 'errorMessage' | 'params' | 'balancePrecharged' | 'balanceRefunded'>>
): Promise<Generation | null> {
  await initializeDatabase();
  const db = getAdapter();

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.resultUrl !== undefined) {
    fields.push('result_url = ?');
    values.push(updates.resultUrl);
  }
  if (updates.params !== undefined) {
    fields.push('params = ?');
    values.push(JSON.stringify(updates.params));
  }
  if (updates.balancePrecharged !== undefined) {
    fields.push('balance_precharged = ?');
    values.push(updates.balancePrecharged ? 1 : 0);
  }
  if (updates.balanceRefunded !== undefined) {
    fields.push('balance_refunded = ?');
    values.push(updates.balanceRefunded ? 1 : 0);
  }
  if (updates.errorMessage !== undefined) {
    fields.push('error_message = ?');
    values.push(updates.errorMessage);
  }

  values.push(id);
  await db.execute(
    `UPDATE generations SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getGeneration(id);
}

// CAS 状态更新：仅当当前状态匹配时才更新
export async function updateGenerationStatusIfMatches(
  id: string,
  expectedStatus: Generation['status'],
  nextStatus: Generation['status']
): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();
  const [result] = await db.execute(
    'UPDATE generations SET status = ?, updated_at = ? WHERE id = ? AND status = ?',
    [nextStatus, Date.now(), id, expectedStatus]
  );
  return getAffectedRows(result) > 0;
}

export async function refundGenerationBalance(
  generationId: string,
  userId: string,
  cost: number
): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();

  const safeCost = Number(cost);
  const now = Date.now();

  const [markResult] = await db.execute(
    'UPDATE generations SET balance_refunded = 1, updated_at = ? WHERE id = ? AND user_id = ? AND balance_precharged = 1 AND balance_refunded = 0',
    [now, generationId, userId]
  );

  if (!getAffectedRows(markResult)) {
    return false;
  }

  if (!Number.isFinite(safeCost) || safeCost <= 0) {
    return true;
  }

  try {
    await updateUserBalance(userId, safeCost, 'strict');
    return true;
  } catch (error) {
    await db.execute(
      'UPDATE generations SET balance_refunded = 0, updated_at = ? WHERE id = ? AND user_id = ?',
      [Date.now(), generationId, userId]
    ).catch(() => {});
    throw error;
  }
}

export async function getUserGenerations(
  userId: string,
  limit = 50,
  offset = 0
): Promise<Generation[]> {
  await initializeDatabase();
  const db = getAdapter();
  const safeLimit = Math.max(Number(limit) || 50, 1);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const params: unknown[] = [userId, safeLimit, safeOffset];
  const [rows] = await db.execute(
    `SELECT * FROM generations WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params
  );

  return (rows).map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    prompt: row.prompt,
    params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
    resultUrl: row.result_url,
    cost: row.cost,
    status: row.status || 'completed',
    balancePrecharged: Boolean(row.balance_precharged),
    balanceRefunded: Boolean(row.balance_refunded),
    errorMessage: row.error_message || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at || row.created_at),
  }));
}

// 获取用户正在进行的任务（pending 或 processing）
export async function getPendingGenerations(userId: string, limit = 50): Promise<Generation[]> {
  await initializeDatabase();
  const db = getAdapter();
  const safeLimit = Math.max(Number(limit) || 50, 1);

  const [rows] = await db.execute(
    `SELECT * FROM generations WHERE user_id = ? AND status IN ('queued', 'pending', 'processing') ORDER BY created_at DESC LIMIT ?`,
    [userId, safeLimit]
  );

  return (rows).map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    prompt: row.prompt,
    params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
    resultUrl: row.result_url,
    cost: row.cost,
    status: row.status,
    balancePrecharged: Boolean(row.balance_precharged),
    balanceRefunded: Boolean(row.balance_refunded),
    errorMessage: row.error_message || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at || row.created_at),
  }));
}

export async function getPendingGenerationsCount(userId?: string): Promise<number> {
  await initializeDatabase();
  const db = getAdapter();

  if (userId) {
    const [rows] = await db.execute(
      `SELECT COUNT(1) as count FROM generations WHERE user_id = ? AND status IN ('queued', 'pending', 'processing')`,
      [userId]
    );
    return Number((rows)[0]?.count || 0);
  }

  const [rows] = await db.execute(
    `SELECT COUNT(1) as count FROM generations WHERE status IN ('queued', 'pending', 'processing')`
  );

  return Number((rows)[0]?.count || 0);
}

export async function getUserIdsWithRecentSoraVideos(sinceMs: number): Promise<string[]> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute(
    `SELECT DISTINCT user_id FROM generations
     WHERE type = 'sora-video'
     AND (created_at >= ? OR status IN ('pending', 'processing'))`,
    [sinceMs]
  );

  return (rows).map((row) => String(row.user_id));
}

export async function getRecentSoraVideoGenerationsByUser(
  userId: string,
  limit = 20
): Promise<Generation[]> {
  await initializeDatabase();
  const db = getAdapter();
  const safeLimit = Math.max(Number(limit) || 20, 1);

  const [rows] = await db.execute(
    `SELECT * FROM generations
     WHERE user_id = ? AND type = 'sora-video'
     ORDER BY created_at DESC LIMIT ?`,
    [userId, safeLimit]
  );

  return (rows).map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    prompt: row.prompt,
    params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
    resultUrl: row.result_url,
    cost: row.cost,
    status: row.status || 'completed',
    balancePrecharged: Boolean(row.balance_precharged),
    balanceRefunded: Boolean(row.balance_refunded),
    errorMessage: row.error_message || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at || row.created_at),
  }));
}

export async function getRecentSoraVideoGenerations(limit = 20): Promise<Generation[]> {
  await initializeDatabase();
  const db = getAdapter();
  const safeLimit = Math.max(Number(limit) || 20, 1);

  const [rows] = await db.execute(
    `SELECT * FROM generations
     WHERE type = 'sora-video'
     ORDER BY created_at DESC LIMIT ?`,
    [safeLimit]
  );

  return (rows).map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    prompt: row.prompt,
    params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
    resultUrl: row.result_url,
    cost: row.cost,
    status: row.status || 'completed',
    balancePrecharged: Boolean(row.balance_precharged),
    balanceRefunded: Boolean(row.balance_refunded),
    errorMessage: row.error_message || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at || row.created_at),
  }));
}

export async function getGeneration(id: string): Promise<Generation | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM generations WHERE id = ?', [id]);
  const gens = rows;
  if (gens.length === 0) return null;

  const row = gens[0];
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    prompt: row.prompt,
    params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
    resultUrl: row.result_url,
    cost: row.cost,
    status: row.status || 'completed',
    balancePrecharged: Boolean(row.balance_precharged),
    balanceRefunded: Boolean(row.balance_refunded),
    errorMessage: row.error_message || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at || row.created_at),
  };
}

// 删除单个生成记录
export async function deleteGeneration(id: string, userId: string): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();

  const [result] = await db.execute(
    'DELETE FROM generations WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  return getAffectedRows(result) > 0;
}

// 批量删除生成记录
export async function deleteGenerations(ids: string[], userId: string): Promise<number> {
  if (ids.length === 0) return 0;
  
  await initializeDatabase();
  const db = getAdapter();

  const placeholders = ids.map(() => '?').join(',');
  const [result] = await db.execute(
    `DELETE FROM generations WHERE id IN (${placeholders}) AND user_id = ?`,
    [...ids, userId]
  );

  return getAffectedRows(result);
}

// 清空用户所有已完成的生成记录
export async function deleteAllUserGenerations(userId: string): Promise<number> {
  await initializeDatabase();
  const db = getAdapter();

  // 只删除已完成或失败的，保留进行中的任务
  const [result] = await db.execute(
    `DELETE FROM generations WHERE user_id = ? AND status NOT IN ('pending', 'processing')`,
    [userId]
  );

  return getAffectedRows(result);
}

// 获取用户今日使用量统计
export interface DailyUsageStats {
  imageCount: number;
  videoCount: number;
  characterCardCount: number;
}

export async function getUserDailyUsage(userId: string): Promise<DailyUsageStats> {
  await initializeDatabase();
  const db = getAdapter();

  // 获取今天 0 点的时间戳
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // 统计今日图像生成数量（包括 pending/processing/completed）
  const [imageRows] = await db.execute(
    `SELECT COUNT(1) as count FROM generations 
     WHERE user_id = ? AND created_at >= ? 
     AND type IN ('sora-image', 'gemini-image', 'zimage-image', 'gitee-image')
     AND status != 'cancelled'`,
    [userId, todayStart]
  );
  const imageCount = Number(imageRows[0]?.count || 0);

  // 统计今日视频生成数量
  const [videoRows] = await db.execute(
    `SELECT COUNT(1) as count FROM generations 
     WHERE user_id = ? AND created_at >= ? 
     AND type = 'sora-video'
     AND status != 'cancelled'`,
    [userId, todayStart]
  );
  const videoCount = Number(videoRows[0]?.count || 0);

  // 统计今日角色卡生成数量
  const [cardRows] = await db.execute(
    `SELECT COUNT(1) as count FROM character_cards 
     WHERE user_id = ? AND created_at >= ?
     AND status != 'cancelled'`,
    [userId, todayStart]
  );
  const characterCardCount = Number(cardRows[0]?.count || 0);

  return { imageCount, videoCount, characterCardCount };
}

// ========================================
// 系统配置操作
// ========================================

function parseRetryConfig(value: unknown): RetryConfig {
  const defaults = getDefaultRetryConfig();
  if (!value) return defaults;

  let parsed: unknown = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return defaults;
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return defaults;
  }
  return applyHardLimits(mergeRetryConfig(defaults, parsed as Partial<RetryConfig>));
}

export async function getSystemConfig(): Promise<SystemConfig> {
  await initializeDatabase();
  return withCache(CacheKeys.SYSTEM_CONFIG, CacheTTL.SYSTEM_CONFIG, async () => {
    const db = getAdapter();

    const [rows] = await db.execute('SELECT * FROM system_config WHERE id = 1');
    const configs = rows;

    if (configs.length === 0) {
      // 返回默认配置
      return {
        soraApiKey: process.env.SORA_API_KEY || '',
        soraBaseUrl: process.env.SORA_BASE_URL || 'http://localhost:8000',
        characterApiBaseUrl: process.env.CHARACTER_API_BASE_URL || '',
        characterApiKey: process.env.CHARACTER_API_KEY || '',
        soraBackendUrl: '',
        soraBackendUsername: '',
        soraBackendPassword: '',
        soraBackendToken: '',
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        geminiBaseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
      zimageApiKey: process.env.ZIMAGE_API_KEY || '',
      zimageBaseUrl: process.env.ZIMAGE_BASE_URL || 'https://api-inference.modelscope.cn/',
      giteeFreeApiKey: process.env.GITEE_FREE_API_KEY || '',
      giteeApiKey: process.env.GITEE_API_KEY || '',
      giteeBaseUrl: process.env.GITEE_BASE_URL || 'https://ai.gitee.com/',
        picuiApiKey: process.env.PICUI_API_KEY || '',
        picuiBaseUrl: process.env.PICUI_BASE_URL || 'https://picui.cn/api/v1',
        pricing: {
          soraVideo10s: 100,
          soraVideo15s: 150,
          soraVideo25s: 200,
          soraImage: 50,
          geminiNano: 10,
          geminiPro: 30,
          zimageImage: 30,
          giteeImage: 30,
        },
        registerEnabled: true,
        defaultBalance: 100,
        announcement: {
          title: '',
          content: '',
          enabled: false,
          updatedAt: 0,
        },
        channelEnabled: {
          sora: true,
          gemini: true,
          zimage: true,
          gitee: true,
        },
        dailyLimit: {
          imageLimit: 0,
          videoLimit: 0,
          characterCardLimit: 0,
        },
        rateLimit: {
          api: 60,
          generate: 20,
          chat: 30,
          auth: 5,
        },
        siteConfig: {
          siteName: 'SANHUB',
          siteTagline: 'Let Imagination Come Alive',
          siteDescription: '「SANHUB」是专为 AI 创作打造的一站式平台',
          siteSubDescription: '我们融合了 Sora 视频生成、Gemini 图像创作与多模型 AI 对话。在这里，技术壁垒已然消融，你唯一的使命就是释放纯粹的想象。',
          contactEmail: 'support@sanhub.com',
          copyright: 'Copyright © 2025 SANHUB',
          poweredBy: 'Powered by OpenAI Sora & Google Gemini',
        },
        disabledModels: {
          imageModels: [],
          videoModels: [],
        },
        disabledPages: [],
        defaultConcurrencyLimit: 2,
        retryConfig: getDefaultRetryConfig(),
        imgbedEnabled: false,
        imgbedBaseUrl: '',
        imgbedApiToken: '',
        imgbedAuthCode: '',
        imgbedUploadChannel: 'telegram',
        imgbedBackupEnabled: false,
        imgbedBackupBaseUrl: '',
        imgbedBackupApiToken: '',
        imgbedBackupAuthCode: '',
        imgbedBackupUploadChannel: 'telegram',
        imgbedMaxFileSize: 50,
        imgbedAllowedTypes: 'mp4,webm,mov',
        imgbedUploadFolder: 'character-cards',
        soraLogVerbose: false,
        proxyEnabled: false,
        proxyUrl: '',
        smtp: { host: '', port: 465, secure: true, user: '', pass: '', from: '' },
      };
    }

    const row = configs[0];
    return {
      soraApiKey: row.sora_api_key || '',
      soraBaseUrl: row.sora_base_url || 'http://localhost:8000',
      characterApiBaseUrl: row.character_api_base_url || '',
      characterApiKey: row.character_api_key || '',
      soraBackendUrl: row.sora_backend_url || '',
      soraBackendUsername: row.sora_backend_username || '',
      soraBackendPassword: row.sora_backend_password || '',
      soraBackendToken: row.sora_backend_token || '',
      geminiApiKey: row.gemini_api_key || '',
    geminiBaseUrl: row.gemini_base_url || 'https://generativelanguage.googleapis.com',
    zimageApiKey: row.zimage_api_key || '',
    zimageBaseUrl: row.zimage_base_url || 'https://api-inference.modelscope.cn/',
    giteeFreeApiKey: row.gitee_free_api_key || '',
    giteeApiKey: row.gitee_api_key || '',
    giteeBaseUrl: row.gitee_base_url || 'https://ai.gitee.com/',
      picuiApiKey: row.picui_api_key || '',
      picuiBaseUrl: row.picui_base_url || 'https://picui.cn/api/v1',
      pricing: {
        soraVideo10s: row.pricing_sora_video_10s || 100,
        soraVideo15s: row.pricing_sora_video_15s || 150,
        soraVideo25s: row.pricing_sora_video_25s || 200,
        soraImage: row.pricing_sora_image || 50,
        geminiNano: row.pricing_gemini_nano || 10,
        geminiPro: row.pricing_gemini_pro || 30,
        zimageImage: row.pricing_zimage_image || 30,
        giteeImage: row.pricing_gitee_image || 30,
      },
      registerEnabled: Boolean(row.register_enabled),
      defaultBalance: row.default_balance || 100,
      announcement: {
        title: row.announcement_title || '',
        content: row.announcement_content || '',
        enabled: Boolean(row.announcement_enabled),
        updatedAt: Number(row.announcement_updated_at) || 0,
      },
      channelEnabled: {
        sora: row.channel_sora_enabled !== 0,
        gemini: row.channel_gemini_enabled !== 0,
        zimage: row.channel_zimage_enabled !== 0,
        gitee: row.channel_gitee_enabled !== 0,
      },
      dailyLimit: {
        imageLimit: row.daily_limit_image || 0,
        videoLimit: row.daily_limit_video || 0,
        characterCardLimit: row.daily_limit_character_card || 0,
      },
      rateLimit: {
        api: row.rate_limit_api ?? 60,
        generate: row.rate_limit_generate ?? 20,
        chat: row.rate_limit_chat ?? 30,
        auth: row.rate_limit_auth ?? 5,
      },
      siteConfig: {
        siteName: row.site_name || 'SANHUB',
        siteTagline: row.site_tagline || 'Let Imagination Come Alive',
        siteDescription: row.site_description || '「SANHUB」是专为 AI 创作打造的一站式平台',
        siteSubDescription: row.site_sub_description || '我们融合了 Sora 视频生成、Gemini 图像创作与多模型 AI 对话。在这里，技术壁垒已然消融，你唯一的使命就是释放纯粹的想象。',
        contactEmail: row.contact_email || 'support@sanhub.com',
        copyright: row.site_copyright || 'Copyright © 2025 SANHUB',
        poweredBy: row.site_powered_by || 'Powered by OpenAI Sora & Google Gemini',
      },
      disabledModels: {
        imageModels: row.disabled_image_models ? JSON.parse(row.disabled_image_models) : [],
        videoModels: row.disabled_video_models ? JSON.parse(row.disabled_video_models) : [],
      },
      disabledPages: row.disabled_pages ? JSON.parse(row.disabled_pages) : [],
      defaultConcurrencyLimit: row.default_concurrency_limit || 2,
      retryConfig: parseRetryConfig(row.retry_config),
      imgbedEnabled: Boolean(row.imgbed_enabled),
      imgbedBaseUrl: row.imgbed_base_url || '',
      imgbedApiToken: row.imgbed_api_token || '',
      imgbedAuthCode: row.imgbed_auth_code || '',
      imgbedUploadChannel: row.imgbed_upload_channel || 'telegram',
      imgbedBackupEnabled: Boolean(row.imgbed_backup_enabled),
      imgbedBackupBaseUrl: row.imgbed_backup_base_url || '',
      imgbedBackupApiToken: row.imgbed_backup_api_token || '',
      imgbedBackupAuthCode: row.imgbed_backup_auth_code || '',
      imgbedBackupUploadChannel: row.imgbed_backup_upload_channel || 'telegram',
      imgbedMaxFileSize: row.imgbed_max_file_size || 50,
      imgbedAllowedTypes: row.imgbed_allowed_types || 'mp4,webm,mov',
      imgbedUploadFolder: row.imgbed_upload_folder || 'character-cards',
      soraLogVerbose: Boolean(row.sora_log_verbose),
      proxyEnabled: Boolean(row.proxy_enabled),
      proxyUrl: row.proxy_url || '',
      smtp: row.smtp ? (typeof row.smtp === 'string' ? JSON.parse(row.smtp) : row.smtp) : { host: '', port: 465, secure: true, user: '', pass: '', from: '' },
    };
  });
}

export function sanitizeSystemConfig(config: SystemConfig): SystemConfig {
  return {
    ...config,
    soraApiKey: '',
    geminiApiKey: '',
    zimageApiKey: '',
    giteeApiKey: '',
    giteeFreeApiKey: '',
    picuiApiKey: '',
    characterApiKey: '',
    soraBackendPassword: '',
    soraBackendToken: '',
    imgbedApiToken: '',
    imgbedAuthCode: '',
    imgbedBackupApiToken: '',
    imgbedBackupAuthCode: '',
  };
}

export async function updateSystemConfig(
  updates: Partial<SystemConfig>
): Promise<SystemConfig> {
  await initializeDatabase();
  const db = getAdapter();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.soraApiKey !== undefined) {
    fields.push('sora_api_key = ?');
    values.push(updates.soraApiKey);
  }
  if (updates.soraBaseUrl !== undefined) {
    fields.push('sora_base_url = ?');
    values.push(updates.soraBaseUrl);
  }
  if (updates.soraBackendUrl !== undefined) {
    fields.push('sora_backend_url = ?');
    values.push(updates.soraBackendUrl);
  }
  if (updates.soraBackendUsername !== undefined) {
    fields.push('sora_backend_username = ?');
    values.push(updates.soraBackendUsername);
  }
  if (updates.soraBackendPassword !== undefined) {
    fields.push('sora_backend_password = ?');
    values.push(updates.soraBackendPassword);
  }
  if (updates.soraBackendToken !== undefined) {
    fields.push('sora_backend_token = ?');
    values.push(updates.soraBackendToken);
  }
  if (updates.geminiApiKey !== undefined) {
    fields.push('gemini_api_key = ?');
    values.push(updates.geminiApiKey);
  }
  if (updates.geminiBaseUrl !== undefined) {
    fields.push('gemini_base_url = ?');
    values.push(updates.geminiBaseUrl);
  }
  if (updates.zimageApiKey !== undefined) {
    fields.push('zimage_api_key = ?');
    values.push(updates.zimageApiKey);
  }
  if (updates.zimageBaseUrl !== undefined) {
    fields.push('zimage_base_url = ?');
    values.push(updates.zimageBaseUrl);
  }
  if (updates.giteeApiKey !== undefined) {
    fields.push('gitee_api_key = ?');
    values.push(updates.giteeApiKey);
  }
  if (updates.giteeFreeApiKey !== undefined) {
    fields.push('gitee_free_api_key = ?');
    values.push(updates.giteeFreeApiKey);
  }
  if (updates.giteeBaseUrl !== undefined) {
    fields.push('gitee_base_url = ?');
    values.push(updates.giteeBaseUrl);
  }
  if (updates.picuiApiKey !== undefined) {
    fields.push('picui_api_key = ?');
    values.push(updates.picuiApiKey);
  }
  if (updates.picuiBaseUrl !== undefined) {
    fields.push('picui_base_url = ?');
    values.push(updates.picuiBaseUrl);
  }
  if (updates.characterApiBaseUrl !== undefined) {
    fields.push('character_api_base_url = ?');
    values.push(updates.characterApiBaseUrl);
  }
  if (updates.characterApiKey !== undefined) {
    fields.push('character_api_key = ?');
    values.push(updates.characterApiKey);
  }
  if (updates.pricing) {
    const p = updates.pricing as Partial<PricingConfig>;
    if (p.soraVideo10s !== undefined) {
      fields.push('pricing_sora_video_10s = ?');
      values.push(p.soraVideo10s);
    }
    if (p.soraVideo15s !== undefined) {
      fields.push('pricing_sora_video_15s = ?');
      values.push(p.soraVideo15s);
    }
    if (p.soraVideo25s !== undefined) {
      fields.push('pricing_sora_video_25s = ?');
      values.push(p.soraVideo25s);
    }
    if (p.soraImage !== undefined) {
      fields.push('pricing_sora_image = ?');
      values.push(p.soraImage);
    }
    if (p.geminiNano !== undefined) {
      fields.push('pricing_gemini_nano = ?');
      values.push(p.geminiNano);
    }
    if (p.geminiPro !== undefined) {
      fields.push('pricing_gemini_pro = ?');
      values.push(p.geminiPro);
    }
    if (p.zimageImage !== undefined) {
      fields.push('pricing_zimage_image = ?');
      values.push(p.zimageImage);
    }
    if (p.giteeImage !== undefined) {
      fields.push('pricing_gitee_image = ?');
      values.push(p.giteeImage);
    }
  }
  if (updates.registerEnabled !== undefined) {
    fields.push('register_enabled = ?');
    values.push(updates.registerEnabled);
  }
  if (updates.defaultBalance !== undefined) {
    fields.push('default_balance = ?');
    values.push(updates.defaultBalance);
  }
  // 公告配置
  if (updates.announcement) {
    const a = updates.announcement;
    if (a.title !== undefined) {
      fields.push('announcement_title = ?');
      values.push(a.title);
    }
    if (a.content !== undefined) {
      fields.push('announcement_content = ?');
      values.push(a.content);
    }
    if (a.enabled !== undefined) {
      fields.push('announcement_enabled = ?');
      values.push(a.enabled);
    }
    fields.push('announcement_updated_at = ?');
    values.push(Date.now());
  }
  // 渠道启用配置
  if (updates.channelEnabled) {
    const c = updates.channelEnabled;
    if (c.sora !== undefined) {
      fields.push('channel_sora_enabled = ?');
      values.push(c.sora ? 1 : 0);
    }
    if (c.gemini !== undefined) {
      fields.push('channel_gemini_enabled = ?');
      values.push(c.gemini ? 1 : 0);
    }
    if (c.zimage !== undefined) {
      fields.push('channel_zimage_enabled = ?');
      values.push(c.zimage ? 1 : 0);
    }
    if (c.gitee !== undefined) {
      fields.push('channel_gitee_enabled = ?');
      values.push(c.gitee ? 1 : 0);
    }
  }
  // 每日请求限制配置
  if (updates.dailyLimit) {
    const d = updates.dailyLimit;
    if (d.imageLimit !== undefined) {
      fields.push('daily_limit_image = ?');
      values.push(d.imageLimit);
    }
    if (d.videoLimit !== undefined) {
      fields.push('daily_limit_video = ?');
      values.push(d.videoLimit);
    }
    if (d.characterCardLimit !== undefined) {
      fields.push('daily_limit_character_card = ?');
      values.push(d.characterCardLimit);
    }
  }
  // 速率限制配置
  if (updates.rateLimit) {
    const r = updates.rateLimit;
    if (r.api !== undefined) {
      fields.push('rate_limit_api = ?');
      values.push(r.api);
    }
    if (r.generate !== undefined) {
      fields.push('rate_limit_generate = ?');
      values.push(r.generate);
    }
    if (r.chat !== undefined) {
      fields.push('rate_limit_chat = ?');
      values.push(r.chat);
    }
    if (r.auth !== undefined) {
      fields.push('rate_limit_auth = ?');
      values.push(r.auth);
    }
  }
  // 网站配置
  if (updates.siteConfig) {
    const s = updates.siteConfig;
    if (s.siteName !== undefined) {
      fields.push('site_name = ?');
      values.push(s.siteName);
    }
    if (s.siteTagline !== undefined) {
      fields.push('site_tagline = ?');
      values.push(s.siteTagline);
    }
    if (s.siteDescription !== undefined) {
      fields.push('site_description = ?');
      values.push(s.siteDescription);
    }
    if (s.siteSubDescription !== undefined) {
      fields.push('site_sub_description = ?');
      values.push(s.siteSubDescription);
    }
    if (s.contactEmail !== undefined) {
      fields.push('contact_email = ?');
      values.push(s.contactEmail);
    }
    if (s.copyright !== undefined) {
      fields.push('site_copyright = ?');
      values.push(s.copyright);
    }
    if (s.poweredBy !== undefined) {
      fields.push('site_powered_by = ?');
      values.push(s.poweredBy);
    }
  }
  // 模型禁用配置
  if (updates.disabledModels) {
    const d = updates.disabledModels;
    if (d.imageModels !== undefined) {
      fields.push('disabled_image_models = ?');
      values.push(JSON.stringify(d.imageModels));
    }
    if (d.videoModels !== undefined) {
      fields.push('disabled_video_models = ?');
      values.push(JSON.stringify(d.videoModels));
    }
  }
  // 页面可见性配置
  if (updates.disabledPages !== undefined) {
    fields.push('disabled_pages = ?');
    values.push(JSON.stringify(updates.disabledPages));
  }
  // 并发限制配置
  if (updates.defaultConcurrencyLimit !== undefined) {
    fields.push('default_concurrency_limit = ?');
    values.push(updates.defaultConcurrencyLimit);
  }
  // 重试配置
  if (updates.retryConfig !== undefined) {
    const defaults = getDefaultRetryConfig();
    const merged = mergeRetryConfig(defaults, updates.retryConfig as Partial<RetryConfig>);
    const normalized = applyHardLimits(merged);
    fields.push('retry_config = ?');
    values.push(JSON.stringify(normalized));
  }
  // CloudFlare-ImgBed 文件床配置
  if (updates.imgbedEnabled !== undefined) {
    fields.push('imgbed_enabled = ?');
    values.push(updates.imgbedEnabled ? 1 : 0);
  }
  if (updates.imgbedBaseUrl !== undefined) {
    fields.push('imgbed_base_url = ?');
    values.push(updates.imgbedBaseUrl);
  }
  if (updates.imgbedApiToken !== undefined) {
    fields.push('imgbed_api_token = ?');
    values.push(updates.imgbedApiToken);
  }
  if (updates.imgbedAuthCode !== undefined) {
    fields.push('imgbed_auth_code = ?');
    values.push(updates.imgbedAuthCode);
  }
  if (updates.imgbedUploadChannel !== undefined) {
    fields.push('imgbed_upload_channel = ?');
    values.push(updates.imgbedUploadChannel);
  }
  if (updates.imgbedBackupEnabled !== undefined) {
    fields.push('imgbed_backup_enabled = ?');
    values.push(updates.imgbedBackupEnabled ? 1 : 0);
  }
  if (updates.imgbedBackupBaseUrl !== undefined) {
    fields.push('imgbed_backup_base_url = ?');
    values.push(updates.imgbedBackupBaseUrl);
  }
  if (updates.imgbedBackupApiToken !== undefined) {
    fields.push('imgbed_backup_api_token = ?');
    values.push(updates.imgbedBackupApiToken);
  }
  if (updates.imgbedBackupAuthCode !== undefined) {
    fields.push('imgbed_backup_auth_code = ?');
    values.push(updates.imgbedBackupAuthCode);
  }
  if (updates.imgbedBackupUploadChannel !== undefined) {
    fields.push('imgbed_backup_upload_channel = ?');
    values.push(updates.imgbedBackupUploadChannel);
  }
  if (updates.imgbedMaxFileSize !== undefined) {
    fields.push('imgbed_max_file_size = ?');
    values.push(updates.imgbedMaxFileSize);
  }
  if (updates.imgbedAllowedTypes !== undefined) {
    fields.push('imgbed_allowed_types = ?');
    values.push(updates.imgbedAllowedTypes);
  }
  if (updates.imgbedUploadFolder !== undefined) {
    fields.push('imgbed_upload_folder = ?');
    values.push(updates.imgbedUploadFolder);
  }
  if (updates.soraLogVerbose !== undefined) {
    fields.push('sora_log_verbose = ?');
    values.push(updates.soraLogVerbose ? 1 : 0);
  }
  // 代理配置
  if (updates.proxyEnabled !== undefined) {
    fields.push('proxy_enabled = ?');
    values.push(updates.proxyEnabled ? 1 : 0);
  }
  if (updates.proxyUrl !== undefined) {
    fields.push('proxy_url = ?');
    values.push(updates.proxyUrl);
  }
  if (updates.smtp !== undefined) {
    fields.push('smtp = ?');
    values.push(JSON.stringify(updates.smtp));
  }

  if (fields.length > 0) {
    await db.execute(
      `UPDATE system_config SET ${fields.join(', ')} WHERE id = 1`,
      values
    );
    cache.delete(CacheKeys.SYSTEM_CONFIG);
  }

  return getSystemConfig();
}

// ========================================
// 初始化管理员
// ========================================

async function initializeAdmin(): Promise<void> {
  const db = getAdapter();
  const dbType = process.env.DB_TYPE || 'sqlite';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@sanhub.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const [existing] = await db.execute(
    'SELECT id FROM users WHERE email = ?',
    [adminEmail]
  );

  if ((existing as unknown[]).length === 0) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const now = Date.now();
    const insertIgnore = dbType === 'mysql' ? 'INSERT IGNORE INTO' : 'INSERT OR IGNORE INTO';

    await db.execute(
      `${insertIgnore} users (id, email, password, name, role, balance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), adminEmail, hashedPassword, 'Admin', 'admin', 999999, now, now]
    );
    console.log('Admin account created:', adminEmail);
  }
}

// ========================================
// 聊天模型操作
// ========================================

export async function getChatModels(enabledOnly = false): Promise<ChatModel[]> {
  await initializeDatabase();
  const db = getAdapter();

  const sql = enabledOnly
    ? 'SELECT * FROM chat_models WHERE enabled = TRUE ORDER BY created_at ASC'
    : 'SELECT * FROM chat_models ORDER BY created_at ASC';

  const [rows] = await db.execute(sql);

  return (rows).map((row) => ({
    id: row.id,
    name: row.name,
    apiUrl: row.api_url,
    apiKey: row.api_key,
    modelId: row.model_id,
    supportsVision: Boolean(row.supports_vision),
    maxTokens: row.max_tokens,
    enabled: Boolean(row.enabled),
    costPerMessage: row.cost_per_message,
    createdAt: Number(row.created_at),
  }));
}

export async function getChatModel(id: string): Promise<ChatModel | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM chat_models WHERE id = ?', [id]);
  const models = rows;
  if (models.length === 0) return null;

  const row = models[0];
  return {
    id: row.id,
    name: row.name,
    apiUrl: row.api_url,
    apiKey: row.api_key,
    modelId: row.model_id,
    supportsVision: Boolean(row.supports_vision),
    maxTokens: row.max_tokens,
    enabled: Boolean(row.enabled),
    costPerMessage: row.cost_per_message,
    createdAt: Number(row.created_at),
  };
}

export async function createChatModel(model: Omit<ChatModel, 'id' | 'createdAt'>): Promise<ChatModel> {
  await initializeDatabase();
  const db = getAdapter();

  const id = generateId();
  const now = Date.now();

  await db.execute(
    `INSERT INTO chat_models (id, name, api_url, api_key, model_id, supports_vision, max_tokens, enabled, cost_per_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, model.name, model.apiUrl, model.apiKey, model.modelId, model.supportsVision, model.maxTokens, model.enabled, model.costPerMessage, now]
  );

  return { ...model, id, createdAt: now };
}

export async function updateChatModel(id: string, updates: Partial<Omit<ChatModel, 'id' | 'createdAt'>>): Promise<ChatModel | null> {
  await initializeDatabase();
  const db = getAdapter();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.apiUrl !== undefined) { fields.push('api_url = ?'); values.push(updates.apiUrl); }
  if (updates.apiKey !== undefined) { fields.push('api_key = ?'); values.push(updates.apiKey); }
  if (updates.modelId !== undefined) { fields.push('model_id = ?'); values.push(updates.modelId); }
  if (updates.supportsVision !== undefined) { fields.push('supports_vision = ?'); values.push(updates.supportsVision); }
  if (updates.maxTokens !== undefined) { fields.push('max_tokens = ?'); values.push(updates.maxTokens); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled); }
  if (updates.costPerMessage !== undefined) { fields.push('cost_per_message = ?'); values.push(updates.costPerMessage); }

  if (fields.length === 0) return getChatModel(id);

  values.push(id);
  await db.execute(`UPDATE chat_models SET ${fields.join(', ')} WHERE id = ?`, values);

  return getChatModel(id);
}

export async function deleteChatModel(id: string): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();

  const [result] = await db.execute('DELETE FROM chat_models WHERE id = ?', [id]);
  return getAffectedRows(result) > 0;
}

// ========================================
// 聊天会话操作
// ========================================

export async function createChatSession(userId: string, modelId: string, title = '新对话'): Promise<ChatSession> {
  await initializeDatabase();
  const db = getAdapter();

  const id = generateId();
  const now = Date.now();

  await db.execute(
    `INSERT INTO chat_sessions (id, user_id, title, model_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, title, modelId, now, now]
  );

  return { id, userId, title, modelId, createdAt: now, updatedAt: now };
}

export async function getUserChatSessions(userId: string, limit = 50): Promise<ChatSession[]> {
  await initializeDatabase();
  const db = getAdapter();
  const safeLimit = Math.max(Number(limit) || 50, 1);

  const [rows] = await db.execute(
    `SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?`,
    [userId, safeLimit]
  );

  return (rows).map((row) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    modelId: row.model_id,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM chat_sessions WHERE id = ?', [id]);
  const sessions = rows;
  if (sessions.length === 0) return null;

  const row = sessions[0];
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    modelId: row.model_id,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function updateChatSession(id: string, updates: { title?: string; modelId?: string }): Promise<ChatSession | null> {
  await initializeDatabase();
  const db = getAdapter();

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.modelId !== undefined) { fields.push('model_id = ?'); values.push(updates.modelId); }

  values.push(id);
  await db.execute(`UPDATE chat_sessions SET ${fields.join(', ')} WHERE id = ?`, values);

  return getChatSession(id);
}

export async function deleteChatSession(id: string): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();

  const [result] = await db.execute('DELETE FROM chat_sessions WHERE id = ?', [id]);
  return getAffectedRows(result) > 0;
}

// ========================================
// 聊天消息操作
// ========================================

export async function saveChatMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
  await initializeDatabase();
  const db = getAdapter();

  const id = generateId();
  const now = Date.now();

  await db.execute(
    `INSERT INTO chat_messages (id, session_id, role, content, images, token_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, message.sessionId, message.role, message.content, JSON.stringify(message.images || []), message.tokenCount, now]
  );

  // 更新会话时间
  await db.execute('UPDATE chat_sessions SET updated_at = ? WHERE id = ?', [now, message.sessionId]);

  return { ...message, id, createdAt: now };
}

export async function getSessionMessages(sessionId: string, limit = 100): Promise<ChatMessage[]> {
  await initializeDatabase();
  const db = getAdapter();
  const safeLimit = Math.max(Number(limit) || 100, 1);

  const [rows] = await db.execute(
    `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?`,
    [sessionId, safeLimit]
  );

  return (rows).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    images: typeof row.images === 'string' ? JSON.parse(row.images) : (row.images || []),
    tokenCount: row.token_count,
    createdAt: Number(row.created_at),
  }));
}

// 获取会话消息用于上下文（自动截断�?maxTokens 的一半）
export async function getSessionContext(sessionId: string, maxTokens = 128000): Promise<ChatMessage[]> {
  const messages = await getSessionMessages(sessionId, 200);
  
  // 截断�?maxTokens 的一半（64k for 128k context�?
  const targetTokens = Math.floor(maxTokens / 2);
  let totalTokens = 0;
  const result: ChatMessage[] = [];

  // 从最新消息开始，保留最近的对话
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (totalTokens + msg.tokenCount > targetTokens && result.length > 0) {
      break;
    }
    result.push(msg);
    totalTokens += msg.tokenCount;
  }

  return result.reverse();
}

export async function deleteSessionMessages(sessionId: string): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();

  const [result] = await db.execute('DELETE FROM chat_messages WHERE session_id = ?', [sessionId]);
  return getAffectedRows(result) > 0;
}

// ========================================
// 角色卡操作
// ========================================

export async function saveCharacterCard(
  card: Omit<CharacterCard, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CharacterCard> {
  await initializeDatabase();
  const db = getAdapter();

  const now = Date.now();
  const newCard: CharacterCard = {
    ...card,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  await db.execute(
    `INSERT INTO character_cards (id, user_id, character_name, avatar_url, source_video_url, status, error_message, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newCard.id,
      newCard.userId,
      newCard.characterName,
      newCard.avatarUrl,
      newCard.sourceVideoUrl || null,
      newCard.status,
      newCard.errorMessage || null,
      newCard.createdAt,
      newCard.updatedAt,
    ]
  );

  return newCard;
}

export async function updateCharacterCard(
  id: string,
  updates: Partial<Pick<CharacterCard, 'characterName' | 'avatarUrl' | 'status' | 'errorMessage'>>
): Promise<CharacterCard | null> {
  await initializeDatabase();
  const db = getAdapter();

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.characterName !== undefined) {
    fields.push('character_name = ?');
    values.push(updates.characterName);
  }
  if (updates.avatarUrl !== undefined) {
    fields.push('avatar_url = ?');
    values.push(updates.avatarUrl);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.errorMessage !== undefined) {
    fields.push('error_message = ?');
    values.push(updates.errorMessage);
  }

  values.push(id);
  await db.execute(
    `UPDATE character_cards SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getCharacterCard(id);
}

export async function getCharacterCard(id: string): Promise<CharacterCard | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM character_cards WHERE id = ?', [id]);
  const cards = rows;
  if (cards.length === 0) return null;

  const row = cards[0];
  return {
    id: row.id,
    userId: row.user_id,
    characterName: row.character_name || '',
    avatarUrl: row.avatar_url || '',
    sourceVideoUrl: row.source_video_url || undefined,
    status: row.status || 'pending',
    errorMessage: row.error_message || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at || row.created_at),
  };
}

export async function getUserCharacterCards(
  userId: string,
  limit = 50,
  offset = 0
): Promise<CharacterCard[]> {
  await initializeDatabase();
  const db = getAdapter();
  const safeLimit = Math.max(Number(limit) || 50, 1);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const [rows] = await db.execute(
    `SELECT * FROM character_cards WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, safeLimit, safeOffset]
  );

  return (rows).map((row) => ({
    id: row.id,
    userId: row.user_id,
    characterName: row.character_name || '',
    avatarUrl: row.avatar_url || '',
    sourceVideoUrl: row.source_video_url || undefined,
    status: row.status || 'pending',
    errorMessage: row.error_message || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at || row.created_at),
  }));
}

export async function getPendingCharacterCards(userId: string, limit = 50): Promise<CharacterCard[]> {
  await initializeDatabase();
  const db = getAdapter();
  const safeLimit = Math.max(Number(limit) || 50, 1);

  const [rows] = await db.execute(
    `SELECT * FROM character_cards WHERE user_id = ? AND status IN ('pending', 'processing') ORDER BY created_at DESC LIMIT ?`,
    [userId, safeLimit]
  );

  return (rows).map((row) => ({
    id: row.id,
    userId: row.user_id,
    characterName: row.character_name || '',
    avatarUrl: row.avatar_url || '',
    sourceVideoUrl: row.source_video_url || undefined,
    status: row.status,
    errorMessage: row.error_message || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at || row.created_at),
  }));
}

export async function deleteCharacterCard(id: string, userId: string): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();

  const [result] = await db.execute(
    'DELETE FROM character_cards WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  return getAffectedRows(result) > 0;
}


// ========================================
// 图像渠道操作
// ========================================

import type { ImageChannel, ImageModel, SafeImageChannel, SafeImageModel, ChannelType, ImageModelFeatures } from '@/types';

// 创建图像渠道表（在 initializeDatabase 中调用）
const CREATE_IMAGE_CHANNELS_SQL = `
CREATE TABLE IF NOT EXISTS image_channels (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  base_url VARCHAR(500) DEFAULT '',
  api_key TEXT,
  enabled TINYINT(1) DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_enabled (enabled),
  INDEX idx_type (type)
);

CREATE TABLE IF NOT EXISTS image_models (
  id VARCHAR(36) PRIMARY KEY,
  channel_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  api_model VARCHAR(200) NOT NULL,
  api_endpoint VARCHAR(20) DEFAULT 'dalle',
  base_url VARCHAR(500) DEFAULT '',
  api_key TEXT,
  features TEXT NOT NULL,
  aspect_ratios TEXT NOT NULL,
  resolutions TEXT NOT NULL,
  image_sizes TEXT,
  default_aspect_ratio VARCHAR(20) DEFAULT '1:1',
  default_image_size VARCHAR(20),
  requires_reference_image TINYINT(1) DEFAULT 0,
  allow_empty_prompt TINYINT(1) DEFAULT 0,
  highlight TINYINT(1) DEFAULT 0,
  enabled TINYINT(1) DEFAULT 1,
  cost_per_generation INT DEFAULT 10,
  sort_order INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_channel_id (channel_id),
  INDEX idx_enabled (enabled),
  INDEX idx_sort_order (sort_order)
);
`;

let imageChannelsInitialized = false;

// 内部初始化函数（供 initializeDatabase 调用，避免循环依赖）
async function initializeImageChannelsTablesInternal(db: DatabaseAdapter): Promise<void> {
  if (imageChannelsInitialized) return;

  const statements = CREATE_IMAGE_CHANNELS_SQL.split(';').filter((s) => s.trim());
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await db.execute(statement);
      } catch (e: any) {
        // 仅忽略"表已存在"错误，其他错误需要打印
        if (e?.code !== 'ER_TABLE_EXISTS_ERROR' && e?.errno !== 1050) {
          console.error('[DB] Failed to create image channels table:', e?.message || e);
        }
      }
    }
  }

  // 迁移：添加 is_listed 字段（如果不存在）
  try {
    await db.execute('ALTER TABLE image_channels ADD COLUMN is_listed TINYINT(1) DEFAULT 1');
  } catch (e: any) {
    if (!isDuplicateColumnError(e)) {
      console.error('[DB] Failed to add is_listed column to image_channels:', e?.message || e);
    }
  }

  // 迁移：添加 api_endpoint 字段（如果不存在）
  try {
    await db.execute("ALTER TABLE image_models ADD COLUMN api_endpoint VARCHAR(20) DEFAULT 'dalle'");
  } catch (e: any) {
    if (!isDuplicateColumnError(e)) {
      console.error('[DB] Failed to add api_endpoint column to image_models:', e?.message || e);
    }
  }

  imageChannelsInitialized = true;
}

// 初始化图像渠道和模型表
export async function initializeImageChannelsTables(): Promise<void> {
  await initializeDatabase();
  const db = getAdapter();
  await initializeImageChannelsTablesInternal(db);
}

// 获取所有图像渠道
export async function getImageChannels(enabledOnly = false): Promise<ImageChannel[]> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  const sql = enabledOnly
    ? 'SELECT * FROM image_channels WHERE enabled = 1 ORDER BY created_at ASC'
    : 'SELECT * FROM image_channels ORDER BY created_at ASC';

  const [rows] = await db.execute(sql);

  return (rows).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as ChannelType,
    baseUrl: row.base_url || '',
    apiKey: row.api_key || '',
    enabled: Boolean(row.enabled),
    isListed: row.is_listed !== undefined ? Boolean(row.is_listed) : true,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

// 获取单个图像渠道
export async function getImageChannel(id: string): Promise<ImageChannel | null> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM image_channels WHERE id = ?', [id]);
  const channels = rows;
  if (channels.length === 0) return null;

  const row = channels[0];
  return {
    id: row.id,
    name: row.name,
    type: row.type as ChannelType,
    baseUrl: row.base_url || '',
    apiKey: row.api_key || '',
    enabled: Boolean(row.enabled),
    isListed: row.is_listed !== undefined ? Boolean(row.is_listed) : true,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

// 创建图像渠道
export async function createImageChannel(
  channel: Omit<ImageChannel, 'id' | 'createdAt' | 'updatedAt' | 'isListed'> & { isListed?: boolean }
): Promise<ImageChannel> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  const id = generateId();
  const now = Date.now();
  const isListed = channel.isListed !== undefined ? channel.isListed : true;

  await db.execute(
    `INSERT INTO image_channels (id, name, type, base_url, api_key, enabled, is_listed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, channel.name, channel.type, channel.baseUrl, channel.apiKey, channel.enabled ? 1 : 0, isListed ? 1 : 0, now, now]
  );

  return { ...channel, id, isListed, createdAt: now, updatedAt: now };
}

// 更新图像渠道
export async function updateImageChannel(
  id: string,
  updates: Partial<Omit<ImageChannel, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ImageChannel | null> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type); }
  if (updates.baseUrl !== undefined) { fields.push('base_url = ?'); values.push(updates.baseUrl); }
  if (updates.apiKey !== undefined) { fields.push('api_key = ?'); values.push(updates.apiKey); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (updates.isListed !== undefined) { fields.push('is_listed = ?'); values.push(updates.isListed ? 1 : 0); }

  values.push(id);
  await db.execute(`UPDATE image_channels SET ${fields.join(', ')} WHERE id = ?`, values);

  return getImageChannel(id);
}

// 删除图像渠道
export async function deleteImageChannel(id: string): Promise<boolean> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  // 先删除该渠道下的所有模型
  await db.execute('DELETE FROM image_models WHERE channel_id = ?', [id]);
  
  const [result] = await db.execute('DELETE FROM image_channels WHERE id = ?', [id]);
  return getAffectedRows(result) > 0;
}

// 获取安全的渠道列表（不含敏感信息）
export async function getSafeImageChannels(enabledOnly = false): Promise<SafeImageChannel[]> {
  const channels = await getImageChannels(enabledOnly);
  return channels.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    enabled: c.enabled,
    isListed: c.isListed,
  }));
}

// 获取用户可见的图像渠道（基于用户组权限）
export async function getUserVisibleImageChannels(userId: string): Promise<ImageChannel[]> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const userGroups = await getUserGroups_ByUserId(userId);

  if (userGroups.length === 0) {
    return [];
  }

  const groupIds = userGroups.map(g => g.id);
  const placeholders = groupIds.map(() => '?').join(',');

  const [rows] = await db.execute(`
    SELECT DISTINCT c.*
    FROM image_channels c
    INNER JOIN group_channel_permissions p ON c.id = p.channel_id
    WHERE p.group_id IN (${placeholders})
      AND c.enabled = 1
      AND c.is_listed = 1
    ORDER BY c.created_at ASC
  `, groupIds);

  return (rows).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as ChannelType,
    baseUrl: row.base_url || '',
    apiKey: row.api_key || '',
    enabled: Boolean(row.enabled),
    isListed: row.is_listed !== undefined ? Boolean(row.is_listed) : true,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

// ========================================
// 图像模型操作
// ========================================

function parseFeatures(raw: unknown): ImageModelFeatures {
  const defaults: ImageModelFeatures = {
    textToImage: true,
    imageToImage: false,
    upscale: false,
    matting: false,
    multipleImages: false,
    imageSize: false,
  };
  if (!raw) return defaults;
  if (typeof raw === 'string') {
    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  }
  if (typeof raw === 'object') {
    return { ...defaults, ...(raw as ImageModelFeatures) };
  }
  return defaults;
}

function parseStringArray(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw;
  return [];
}

function parseResolutions(raw: unknown): Record<string, string | Record<string, string>> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, string | Record<string, string>>;
  return {};
}

// 获取所有图像模型
export async function getImageModels(enabledOnly = false): Promise<ImageModel[]> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  const sql = enabledOnly
    ? 'SELECT * FROM image_models WHERE enabled = 1 ORDER BY sort_order ASC, created_at ASC'
    : 'SELECT * FROM image_models ORDER BY sort_order ASC, created_at ASC';

  const [rows] = await db.execute(sql);

  return (rows).map((row) => ({
    id: row.id,
    channelId: row.channel_id,
    name: row.name,
    description: row.description || '',
    apiModel: row.api_model,
    apiEndpoint: row.api_endpoint || 'dalle',
    baseUrl: row.base_url || undefined,
    apiKey: row.api_key || undefined,
    features: parseFeatures(row.features),
    aspectRatios: parseStringArray(row.aspect_ratios),
    resolutions: parseResolutions(row.resolutions),
    imageSizes: row.image_sizes ? parseStringArray(row.image_sizes) : undefined,
    defaultAspectRatio: row.default_aspect_ratio || '1:1',
    defaultImageSize: row.default_image_size || undefined,
    requiresReferenceImage: Boolean(row.requires_reference_image),
    allowEmptyPrompt: Boolean(row.allow_empty_prompt),
    highlight: Boolean(row.highlight),
    enabled: Boolean(row.enabled),
    costPerGeneration: row.cost_per_generation || 10,
    sortOrder: row.sort_order || 0,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

// 获取渠道下的模型
export async function getImageModelsByChannel(channelId: string, enabledOnly = false): Promise<ImageModel[]> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  const sql = enabledOnly
    ? 'SELECT * FROM image_models WHERE channel_id = ? AND enabled = 1 ORDER BY sort_order ASC, created_at ASC'
    : 'SELECT * FROM image_models WHERE channel_id = ? ORDER BY sort_order ASC, created_at ASC';

  const [rows] = await db.execute(sql, [channelId]);

  return (rows).map((row) => ({
    id: row.id,
    channelId: row.channel_id,
    name: row.name,
    description: row.description || '',
    apiModel: row.api_model,
    apiEndpoint: row.api_endpoint || 'dalle',
    baseUrl: row.base_url || undefined,
    apiKey: row.api_key || undefined,
    features: parseFeatures(row.features),
    aspectRatios: parseStringArray(row.aspect_ratios),
    resolutions: parseResolutions(row.resolutions),
    imageSizes: row.image_sizes ? parseStringArray(row.image_sizes) : undefined,
    defaultAspectRatio: row.default_aspect_ratio || '1:1',
    defaultImageSize: row.default_image_size || undefined,
    requiresReferenceImage: Boolean(row.requires_reference_image),
    allowEmptyPrompt: Boolean(row.allow_empty_prompt),
    highlight: Boolean(row.highlight),
    enabled: Boolean(row.enabled),
    costPerGeneration: row.cost_per_generation || 10,
    sortOrder: row.sort_order || 0,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

// 获取单个图像模型
export async function getImageModel(id: string): Promise<ImageModel | null> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM image_models WHERE id = ?', [id]);
  const models = rows;
  if (models.length === 0) return null;

  const row = models[0];
  return {
    id: row.id,
    channelId: row.channel_id,
    name: row.name,
    description: row.description || '',
    apiModel: row.api_model,
    apiEndpoint: row.api_endpoint || 'dalle',
    baseUrl: row.base_url || undefined,
    apiKey: row.api_key || undefined,
    features: parseFeatures(row.features),
    aspectRatios: parseStringArray(row.aspect_ratios),
    resolutions: parseResolutions(row.resolutions),
    imageSizes: row.image_sizes ? parseStringArray(row.image_sizes) : undefined,
    defaultAspectRatio: row.default_aspect_ratio || '1:1',
    defaultImageSize: row.default_image_size || undefined,
    requiresReferenceImage: Boolean(row.requires_reference_image),
    allowEmptyPrompt: Boolean(row.allow_empty_prompt),
    highlight: Boolean(row.highlight),
    enabled: Boolean(row.enabled),
    costPerGeneration: row.cost_per_generation || 10,
    sortOrder: row.sort_order || 0,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

// 创建图像模型
export async function createImageModel(
  model: Omit<ImageModel, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ImageModel> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  const id = generateId();
  const now = Date.now();

  await db.execute(
    `INSERT INTO image_models (
      id, channel_id, name, description, api_model, api_endpoint, base_url, api_key,
      features, aspect_ratios, resolutions, image_sizes,
      default_aspect_ratio, default_image_size,
      requires_reference_image, allow_empty_prompt, highlight,
      enabled, cost_per_generation, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      model.channelId,
      model.name,
      model.description,
      model.apiModel,
      model.apiEndpoint || 'dalle',
      model.baseUrl || '',
      model.apiKey || '',
      JSON.stringify(model.features),
      JSON.stringify(model.aspectRatios),
      JSON.stringify(model.resolutions),
      model.imageSizes ? JSON.stringify(model.imageSizes) : null,
      model.defaultAspectRatio,
      model.defaultImageSize || null,
      model.requiresReferenceImage ? 1 : 0,
      model.allowEmptyPrompt ? 1 : 0,
      model.highlight ? 1 : 0,
      model.enabled ? 1 : 0,
      model.costPerGeneration,
      model.sortOrder,
      now,
      now,
    ]
  );

  return { ...model, id, createdAt: now, updatedAt: now };
}

// 更新图像模型
export async function updateImageModel(
  id: string,
  updates: Partial<Omit<ImageModel, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ImageModel | null> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.channelId !== undefined) { fields.push('channel_id = ?'); values.push(updates.channelId); }
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.apiModel !== undefined) { fields.push('api_model = ?'); values.push(updates.apiModel); }
  if (updates.apiEndpoint !== undefined) { fields.push('api_endpoint = ?'); values.push(updates.apiEndpoint); }
  if (updates.baseUrl !== undefined) { fields.push('base_url = ?'); values.push(updates.baseUrl || null); }
  if (updates.apiKey !== undefined) { fields.push('api_key = ?'); values.push(updates.apiKey || null); }
  if (updates.features !== undefined) { fields.push('features = ?'); values.push(JSON.stringify(updates.features)); }
  if (updates.aspectRatios !== undefined) { fields.push('aspect_ratios = ?'); values.push(JSON.stringify(updates.aspectRatios)); }
  if (updates.resolutions !== undefined) { fields.push('resolutions = ?'); values.push(JSON.stringify(updates.resolutions)); }
  if (updates.imageSizes !== undefined) { fields.push('image_sizes = ?'); values.push(updates.imageSizes ? JSON.stringify(updates.imageSizes) : null); }
  if (updates.defaultAspectRatio !== undefined) { fields.push('default_aspect_ratio = ?'); values.push(updates.defaultAspectRatio); }
  if (updates.defaultImageSize !== undefined) { fields.push('default_image_size = ?'); values.push(updates.defaultImageSize); }
  if (updates.requiresReferenceImage !== undefined) { fields.push('requires_reference_image = ?'); values.push(updates.requiresReferenceImage ? 1 : 0); }
  if (updates.allowEmptyPrompt !== undefined) { fields.push('allow_empty_prompt = ?'); values.push(updates.allowEmptyPrompt ? 1 : 0); }
  if (updates.highlight !== undefined) { fields.push('highlight = ?'); values.push(updates.highlight ? 1 : 0); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (updates.costPerGeneration !== undefined) { fields.push('cost_per_generation = ?'); values.push(updates.costPerGeneration); }
  if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder); }

  values.push(id);
  await db.execute(`UPDATE image_models SET ${fields.join(', ')} WHERE id = ?`, values);

  return getImageModel(id);
}

// 删除图像模型
export async function deleteImageModel(id: string): Promise<boolean> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  const [result] = await db.execute('DELETE FROM image_models WHERE id = ?', [id]);
  return getAffectedRows(result) > 0;
}

// 获取安全的模型列表（不含敏感信息，带渠道类型）
export async function getSafeImageModels(enabledOnly = false): Promise<SafeImageModel[]> {
  const models = await getImageModels(enabledOnly);
  const channels = await getImageChannels();
  const channelMap = new Map(channels.map((c) => [c.id, c]));

  return models
    .filter((m) => {
      const channel = channelMap.get(m.channelId);
      return channel && (!enabledOnly || channel.enabled);
    })
    .map((m) => {
      const channel = channelMap.get(m.channelId)!;
      return {
        id: m.id,
        channelId: m.channelId,
        channelType: channel.type,
        name: m.name,
        description: m.description,
        features: m.features,
        aspectRatios: m.aspectRatios,
        resolutions: m.resolutions,
        imageSizes: m.imageSizes,
        defaultAspectRatio: m.defaultAspectRatio,
        defaultImageSize: m.defaultImageSize,
        requiresReferenceImage: m.requiresReferenceImage,
        allowEmptyPrompt: m.allowEmptyPrompt,
        highlight: m.highlight,
        enabled: m.enabled,
        costPerGeneration: m.costPerGeneration,
      };
    });
}

// 获取模型的完整配置（包含渠道信息，用于生成时）
export async function getImageModelWithChannel(modelId: string): Promise<{
  model: ImageModel;
  channel: ImageChannel;
  effectiveBaseUrl: string;
  effectiveApiKey: string;
} | null> {
  const model = await getImageModel(modelId);
  if (!model) return null;

  const channel = await getImageChannel(model.channelId);
  if (!channel) return null;

  return {
    model,
    channel,
    effectiveBaseUrl: model.baseUrl || channel.baseUrl,
    effectiveApiKey: model.apiKey || channel.apiKey,
  };
}

// 检查是否有任何图像渠道/模型配置
export async function hasImageChannelsConfigured(): Promise<boolean> {
  await initializeDatabase();
  await initializeImageChannelsTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT COUNT(1) as count FROM image_channels');
  const count = Number((rows)[0]?.count || 0);
  return count > 0;
}

// ========================================
// 视频渠道操作
// ========================================

import type { VideoChannel, VideoModel, SafeVideoChannel, SafeVideoModel, VideoModelFeatures, VideoDuration } from '@/types';

// 创建视频渠道表
const CREATE_VIDEO_CHANNELS_SQL = `
CREATE TABLE IF NOT EXISTS video_channels (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  base_url VARCHAR(500) DEFAULT '',
  api_key TEXT,
  enabled TINYINT(1) DEFAULT 1,
  is_listed TINYINT(1) DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_enabled (enabled),
  INDEX idx_is_listed (is_listed)
);

CREATE TABLE IF NOT EXISTS video_models (
  id VARCHAR(36) PRIMARY KEY,
  channel_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  api_model VARCHAR(200) NOT NULL,
  base_url VARCHAR(500) DEFAULT '',
  api_key TEXT,
  features TEXT NOT NULL,
  aspect_ratios TEXT NOT NULL,
  durations TEXT NOT NULL,
  default_aspect_ratio VARCHAR(20) DEFAULT 'landscape',
  default_duration VARCHAR(20) DEFAULT '10s',
  highlight TINYINT(1) DEFAULT 0,
  enabled TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_channel_id (channel_id),
  INDEX idx_enabled (enabled)
);
`;

let videoChannelsInitialized = false;

// 内部初始化函数（供 initializeDatabase 调用，避免循环依赖）
async function initializeVideoChannelsTablesInternal(db: DatabaseAdapter): Promise<void> {
  if (videoChannelsInitialized) return;

  const statements = CREATE_VIDEO_CHANNELS_SQL.split(';').filter((s) => s.trim());
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await db.execute(statement);
      } catch (e: any) {
        // 仅忽略"表已存在"错误，其他错误需要打印
        if (e?.code !== 'ER_TABLE_EXISTS_ERROR' && e?.errno !== 1050) {
          console.error('[DB] Failed to create video channels table:', e?.message || e);
        }
      }
    }
  }

  // 迁移：添加 is_listed 字段（如果不存在）
  try {
    await db.execute('ALTER TABLE video_channels ADD COLUMN is_listed TINYINT(1) DEFAULT 1');
  } catch (e: any) {
    // 忽略"列已存在"错误
    if (!isDuplicateColumnError(e)) {
      console.error('[DB] Failed to add is_listed column:', e?.message || e);
    }
  }

  try {
    await db.execute('ALTER TABLE video_models ADD COLUMN hd_enabled TINYINT(1) DEFAULT 0');
  } catch (error) {
    handleSchemaChangeError(error);
  }

  videoChannelsInitialized = true;
}

// 初始化视频渠道表
export async function initializeVideoChannelsTables(): Promise<void> {
  await initializeDatabase();
  const db = getAdapter();
  await initializeVideoChannelsTablesInternal(db);
}

// 获取所有视频渠道
export async function getVideoChannels(enabledOnly = false): Promise<VideoChannel[]> {
  await initializeDatabase();
  await initializeVideoChannelsTables();
  const db = getAdapter();

  const sql = enabledOnly
    ? 'SELECT * FROM video_channels WHERE enabled = 1 ORDER BY created_at ASC'
    : 'SELECT * FROM video_channels ORDER BY created_at ASC';

  const [rows] = await db.execute(sql);

  return (rows).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as ChannelType,
    baseUrl: row.base_url || '',
    apiKey: row.api_key || '',
    enabled: Boolean(row.enabled),
    isListed: row.is_listed !== undefined ? Boolean(row.is_listed) : true,
    characterApiBaseUrl: row.character_api_base_url || '',
    characterApiKey: row.character_api_key || '',
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

// 获取单个视频渠道
export async function getVideoChannel(id: string): Promise<VideoChannel | null> {
  await initializeDatabase();
  await initializeVideoChannelsTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM video_channels WHERE id = ?', [id]);
  const channels = rows;
  if (channels.length === 0) return null;

  const row = channels[0];
  return {
    id: row.id,
    name: row.name,
    type: row.type as ChannelType,
    baseUrl: row.base_url || '',
    apiKey: row.api_key || '',
    enabled: Boolean(row.enabled),
    isListed: row.is_listed !== undefined ? Boolean(row.is_listed) : true,
    characterApiBaseUrl: row.character_api_base_url || '',
    characterApiKey: row.character_api_key || '',
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

// 创建视频渠道
export async function createVideoChannel(
  channel: Omit<VideoChannel, 'id' | 'createdAt' | 'updatedAt'>
): Promise<VideoChannel> {
  await initializeDatabase();
  await initializeVideoChannelsTables();
  const db = getAdapter();

  const id = generateId();
  const now = Date.now();
  const isListed = channel.isListed !== undefined ? channel.isListed : true;

  await db.execute(
    `INSERT INTO video_channels (id, name, type, base_url, api_key, enabled, is_listed, character_api_base_url, character_api_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      channel.name,
      channel.type,
      channel.baseUrl,
      channel.apiKey,
      channel.enabled ? 1 : 0,
      isListed ? 1 : 0,
      channel.characterApiBaseUrl || '',
      channel.characterApiKey || '',
      now,
      now
    ]
  );

  return { ...channel, id, isListed, createdAt: now, updatedAt: now };
}

// 更新视频渠道
export async function updateVideoChannel(
  id: string,
  updates: Partial<Omit<VideoChannel, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<VideoChannel | null> {
  await initializeDatabase();
  await initializeVideoChannelsTables();
  const db = getAdapter();

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type); }
  if (updates.baseUrl !== undefined) { fields.push('base_url = ?'); values.push(updates.baseUrl); }
  if (updates.apiKey !== undefined) { fields.push('api_key = ?'); values.push(updates.apiKey); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (updates.isListed !== undefined) { fields.push('is_listed = ?'); values.push(updates.isListed ? 1 : 0); }
  if (updates.characterApiBaseUrl !== undefined) { fields.push('character_api_base_url = ?'); values.push(updates.characterApiBaseUrl); }
  if (updates.characterApiKey !== undefined) { fields.push('character_api_key = ?'); values.push(updates.characterApiKey); }

  values.push(id);
  await db.execute(`UPDATE video_channels SET ${fields.join(', ')} WHERE id = ?`, values);

  return getVideoChannel(id);
}

// 删除视频渠道
export async function deleteVideoChannel(id: string): Promise<boolean> {
  await initializeDatabase();
  await initializeVideoChannelsTables();
  const db = getAdapter();

  await db.execute('DELETE FROM video_models WHERE channel_id = ?', [id]);
  const [result] = await db.execute('DELETE FROM video_channels WHERE id = ?', [id]);
  return getAffectedRows(result) > 0;
}

// 获取安全的视频渠道列表
export async function getSafeVideoChannels(enabledOnly = false): Promise<SafeVideoChannel[]> {
  const channels = await getVideoChannels(enabledOnly);
  return channels.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    enabled: c.enabled,
    isListed: c.isListed,
  }));
}

// ========================================
// 视频模型操作
// ========================================

function parseVideoFeatures(raw: unknown): VideoModelFeatures {
  const defaults: VideoModelFeatures = {
    textToVideo: true,
    imageToVideo: false,
    referenceToVideo: false,
    videoToVideo: false,
    supportStyles: false,
    characterCreation: false,
  };
  if (!raw) return defaults;
  if (typeof raw === 'string') {
    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  }
  if (typeof raw === 'object') {
    return { ...defaults, ...(raw as VideoModelFeatures) };
  }
  return defaults;
}

function parseAspectRatios(raw: unknown): Array<{ value: string; label: string }> {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw;
  return [];
}

function parseDurations(raw: unknown): VideoDuration[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw;
  return [];
}

// 获取所有视频模型
export async function getVideoModels(enabledOnly = false): Promise<VideoModel[]> {
  await initializeDatabase();
  await initializeVideoChannelsTables();
  const db = getAdapter();

  const sql = enabledOnly
    ? 'SELECT * FROM video_models WHERE enabled = 1 ORDER BY sort_order ASC, created_at ASC'
    : 'SELECT * FROM video_models ORDER BY sort_order ASC, created_at ASC';

  const [rows] = await db.execute(sql);

  return (rows).map((row) => ({
    id: row.id,
    channelId: row.channel_id,
    name: row.name,
    description: row.description || '',
    apiModel: row.api_model,
    baseUrl: row.base_url || undefined,
    apiKey: row.api_key || undefined,
    features: parseVideoFeatures(row.features),
    aspectRatios: parseAspectRatios(row.aspect_ratios),
    durations: parseDurations(row.durations),
    defaultAspectRatio: row.default_aspect_ratio || 'landscape',
    defaultDuration: row.default_duration || '10s',
    hdEnabled: Boolean(row.hd_enabled),
    highlight: Boolean(row.highlight),
    enabled: Boolean(row.enabled),
    sortOrder: row.sort_order || 0,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

// 获取单个视频模型
export async function getVideoModel(id: string): Promise<VideoModel | null> {
  await initializeDatabase();
  await initializeVideoChannelsTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM video_models WHERE id = ?', [id]);
  const models = rows;
  if (models.length === 0) return null;

  const row = models[0];
  return {
    id: row.id,
    channelId: row.channel_id,
    name: row.name,
    description: row.description || '',
    apiModel: row.api_model,
    baseUrl: row.base_url || undefined,
    apiKey: row.api_key || undefined,
    features: parseVideoFeatures(row.features),
    aspectRatios: parseAspectRatios(row.aspect_ratios),
    durations: parseDurations(row.durations),
    defaultAspectRatio: row.default_aspect_ratio || 'landscape',
    defaultDuration: row.default_duration || '10s',
    hdEnabled: Boolean(row.hd_enabled),
    highlight: Boolean(row.highlight),
    enabled: Boolean(row.enabled),
    sortOrder: row.sort_order || 0,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

// 创建视频模型
export async function createVideoModel(
  model: Omit<VideoModel, 'id' | 'createdAt' | 'updatedAt'>
): Promise<VideoModel> {
  await initializeDatabase();
  await initializeVideoChannelsTables();
  const db = getAdapter();

  const id = generateId();
  const now = Date.now();

  await db.execute(
    `INSERT INTO video_models (
      id, channel_id, name, description, api_model, base_url, api_key,
      features, aspect_ratios, durations,
      default_aspect_ratio, default_duration, hd_enabled, highlight,
      enabled, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      model.channelId,
      model.name,
      model.description,
      model.apiModel,
      model.baseUrl || '',
      model.apiKey || '',
      JSON.stringify(model.features),
      JSON.stringify(model.aspectRatios),
      JSON.stringify(model.durations),
      model.defaultAspectRatio,
      model.defaultDuration,
      model.hdEnabled ? 1 : 0,
      model.highlight ? 1 : 0,
      model.enabled ? 1 : 0,
      model.sortOrder,
      now,
      now,
    ]
  );

  return { ...model, id, createdAt: now, updatedAt: now };
}

// 更新视频模型
export async function updateVideoModel(
  id: string,
  updates: Partial<Omit<VideoModel, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<VideoModel | null> {
  await initializeDatabase();
  await initializeVideoChannelsTables();
  const db = getAdapter();

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.channelId !== undefined) { fields.push('channel_id = ?'); values.push(updates.channelId); }
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.apiModel !== undefined) { fields.push('api_model = ?'); values.push(updates.apiModel); }
  if (updates.baseUrl !== undefined) { fields.push('base_url = ?'); values.push(updates.baseUrl); }
  if (updates.apiKey !== undefined) { fields.push('api_key = ?'); values.push(updates.apiKey); }
  if (updates.features !== undefined) { fields.push('features = ?'); values.push(JSON.stringify(updates.features)); }
  if (updates.aspectRatios !== undefined) { fields.push('aspect_ratios = ?'); values.push(JSON.stringify(updates.aspectRatios)); }
  if (updates.durations !== undefined) { fields.push('durations = ?'); values.push(JSON.stringify(updates.durations)); }
  if (updates.defaultAspectRatio !== undefined) { fields.push('default_aspect_ratio = ?'); values.push(updates.defaultAspectRatio); }
  if (updates.defaultDuration !== undefined) { fields.push('default_duration = ?'); values.push(updates.defaultDuration); }
  if (updates.hdEnabled !== undefined) { fields.push('hd_enabled = ?'); values.push(updates.hdEnabled ? 1 : 0); }
  if (updates.highlight !== undefined) { fields.push('highlight = ?'); values.push(updates.highlight ? 1 : 0); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder); }

  values.push(id);
  await db.execute(`UPDATE video_models SET ${fields.join(', ')} WHERE id = ?`, values);

  return getVideoModel(id);
}

// 删除视频模型
export async function deleteVideoModel(id: string): Promise<boolean> {
  await initializeDatabase();
  await initializeVideoChannelsTables();
  const db = getAdapter();

  const [result] = await db.execute('DELETE FROM video_models WHERE id = ?', [id]);
  return getAffectedRows(result) > 0;
}

// 获取安全的视频模型列表
export async function getSafeVideoModels(enabledOnly = false): Promise<SafeVideoModel[]> {
  const models = await getVideoModels(enabledOnly);
  const channels = await getVideoChannels();
  const channelMap = new Map(channels.map((c) => [c.id, c]));

  return models
    .filter((m) => {
      const channel = channelMap.get(m.channelId);
      return channel && (!enabledOnly || channel.enabled);
    })
    .map((m) => {
      const channel = channelMap.get(m.channelId)!;
      return {
        id: m.id,
        channelId: m.channelId,
        channelType: channel.type,
        name: m.name,
        description: m.description,
        features: m.features,
        aspectRatios: m.aspectRatios,
        durations: m.durations,
        defaultAspectRatio: m.defaultAspectRatio,
        defaultDuration: m.defaultDuration,
        highlight: m.highlight,
        enabled: m.enabled,
      };
    });
}

// 获取视频模型的完整配置
export async function getVideoModelWithChannel(modelId: string): Promise<{
  model: VideoModel;
  channel: VideoChannel;
  effectiveBaseUrl: string;
  effectiveApiKey: string;
} | null> {
  const model = await getVideoModel(modelId);
  if (!model) return null;

  const channel = await getVideoChannel(model.channelId);
  if (!channel) return null;

  return {
    model,
    channel,
    effectiveBaseUrl: model.baseUrl || channel.baseUrl,
    effectiveApiKey: model.apiKey || channel.apiKey,
  };
}

// ========================================
// 并发限制检查
// ========================================

// 获取用户活跃任务数
export async function getUserActiveTasksCount(userId: string): Promise<number> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute(
    `SELECT COUNT(1) as count FROM generations
     WHERE user_id = ? AND status IN ('pending', 'processing')`,
    [userId]
  );

  return (rows)[0]?.count || 0;
}

// 检查用户并发限制
export async function checkUserConcurrencyLimit(userId: string): Promise<{
  allowed: boolean;
  shouldQueue: boolean;
  currentActive: number;
  limit: number;
  message?: string;
}> {
  const user = await getUserById(userId);
  if (!user) {
    return { allowed: false, shouldQueue: false, currentActive: 0, limit: 0, message: '用户不存在' };
  }

  const config = await getSystemConfig();

  // 确定有效限制：用户级覆盖 > 全局默认
  const limit = (user.concurrencyLimit !== null && user.concurrencyLimit !== undefined)
    ? user.concurrencyLimit
    : config.defaultConcurrencyLimit;

  // 0 表示无限制
  if (limit === 0) {
    return { allowed: true, shouldQueue: false, currentActive: 0, limit: 0 };
  }

  const currentActive = await getUserActiveTasksCount(userId);

  if (currentActive >= limit) {
    return {
      allowed: true,
      shouldQueue: true,
      currentActive,
      limit,
      message: `当前活跃任务：${currentActive}，限制：${limit}。新任务将排队等待。`
    };
  }

  return { allowed: true, shouldQueue: false, currentActive, limit };
}

// 获取用户最早的排队任务
export async function getOldestQueuedGeneration(userId: string): Promise<Generation | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute(
    `SELECT * FROM generations WHERE user_id = ? AND status = 'queued' ORDER BY created_at ASC LIMIT 1`,
    [userId]
  );

  const arr = rows;
  if (arr.length === 0) return null;

  const row = arr[0];
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    prompt: row.prompt,
    params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
    resultUrl: row.result_url || '',
    cost: row.cost,
    status: row.status,
    balancePrecharged: Boolean(row.balance_precharged),
    balanceRefunded: Boolean(row.balance_refunded),
    errorMessage: row.error_message || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

// 获取用户排队任务的位置（第几个）
export async function getUserQueuePosition(userId: string, generationId: string): Promise<number> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute(
    `SELECT id FROM generations WHERE user_id = ? AND status = 'queued' ORDER BY created_at ASC`,
    [userId]
  );

  const arr = rows;
  const index = arr.findIndex((r: any) => r.id === generationId);
  return index >= 0 ? index + 1 : 0;
}

// ========================================
// 用户组操作
// ========================================

import type { UserGroup, UserGroupMember, GroupChannelPermission, SafeUserGroup } from '@/types';

// 创建用户组表
const CREATE_USER_GROUPS_SQL = `
CREATE TABLE IF NOT EXISTS user_groups (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  is_default TINYINT(1) DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_name (name),
  INDEX idx_is_default (is_default)
);

CREATE TABLE IF NOT EXISTS user_group_members (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  group_id VARCHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uk_user_group (user_id, group_id),
  INDEX idx_user_id (user_id),
  INDEX idx_group_id (group_id)
);

CREATE TABLE IF NOT EXISTS group_channel_permissions (
  id VARCHAR(36) PRIMARY KEY,
  group_id VARCHAR(36) NOT NULL,
  channel_id VARCHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uk_group_channel (group_id, channel_id),
  INDEX idx_group_id (group_id),
  INDEX idx_channel_id (channel_id)
);

CREATE TABLE IF NOT EXISTS group_model_pricing (
  id VARCHAR(36) PRIMARY KEY,
  group_id VARCHAR(36) NOT NULL,
  model_id VARCHAR(36) NOT NULL,
  model_type VARCHAR(10) NOT NULL DEFAULT 'image',
  custom_cost DECIMAL(10, 2) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE KEY uk_group_model (group_id, model_id),
  INDEX idx_group_id (group_id),
  INDEX idx_model_id (model_id)
);
`;

let userGroupsInitialized = false;

async function initializeUserGroupsTablesInternal(db: DatabaseAdapter): Promise<void> {
  if (userGroupsInitialized) return;

  const statements = CREATE_USER_GROUPS_SQL.split(';').filter((s) => s.trim());
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await db.execute(statement);
      } catch (e: any) {
        if (e?.code !== 'ER_TABLE_EXISTS_ERROR' && e?.errno !== 1050) {
          console.error('[DB] Failed to create user groups table:', e?.message || e);
        }
      }
    }
  }

  userGroupsInitialized = true;
}

export async function initializeUserGroupsTables(): Promise<void> {
  await initializeDatabase();
  const db = getAdapter();
  await initializeUserGroupsTablesInternal(db);
}

// 获取所有用户组
export async function getUserGroups(): Promise<UserGroup[]> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM user_groups ORDER BY is_default DESC, created_at ASC');

  return (rows).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    isDefault: Boolean(row.is_default),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

// 获取用户组（含成员数和渠道数）
export async function getSafeUserGroups(): Promise<SafeUserGroup[]> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const [rows] = await db.execute(`
    SELECT
      g.*,
      (SELECT COUNT(*) FROM user_group_members WHERE group_id = g.id) as member_count,
      (SELECT COUNT(*) FROM group_channel_permissions WHERE group_id = g.id) as channel_count
    FROM user_groups g
    ORDER BY g.is_default DESC, g.created_at ASC
  `);

  return (rows).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    isDefault: Boolean(row.is_default),
    memberCount: Number(row.member_count || 0),
    channelCount: Number(row.channel_count || 0),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

// 获取单个用户组
export async function getUserGroup(id: string): Promise<UserGroup | null> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM user_groups WHERE id = ?', [id]);
  const groups = rows;
  if (groups.length === 0) return null;

  const row = groups[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    isDefault: Boolean(row.is_default),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

// 获取默认用户组
export async function getDefaultUserGroup(): Promise<UserGroup | null> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM user_groups WHERE is_default = 1 LIMIT 1');
  const groups = rows;
  if (groups.length === 0) return null;

  const row = groups[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    isDefault: Boolean(row.is_default),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

// 创建用户组
export async function createUserGroup(
  group: Omit<UserGroup, 'id' | 'createdAt' | 'updatedAt'>
): Promise<UserGroup> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const id = generateId();
  const now = Date.now();

  // 如果设置为默认组，先取消其他默认组
  if (group.isDefault) {
    await db.execute('UPDATE user_groups SET is_default = 0 WHERE is_default = 1');
  }

  await db.execute(
    `INSERT INTO user_groups (id, name, description, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, group.name, group.description || '', group.isDefault ? 1 : 0, now, now]
  );

  return { ...group, id, createdAt: now, updatedAt: now };
}

// 更新用户组
export async function updateUserGroup(
  id: string,
  updates: Partial<Omit<UserGroup, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<UserGroup | null> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.isDefault !== undefined) {
    // 如果设置为默认组，先取消其他默认组
    if (updates.isDefault) {
      await db.execute('UPDATE user_groups SET is_default = 0 WHERE is_default = 1 AND id != ?', [id]);
    }
    fields.push('is_default = ?');
    values.push(updates.isDefault ? 1 : 0);
  }

  values.push(id);
  await db.execute(`UPDATE user_groups SET ${fields.join(', ')} WHERE id = ?`, values);

  return getUserGroup(id);
}

// 删除用户组
export async function deleteUserGroup(id: string): Promise<boolean> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  // 先删除关联数据
  await db.execute('DELETE FROM user_group_members WHERE group_id = ?', [id]);
  await db.execute('DELETE FROM group_channel_permissions WHERE group_id = ?', [id]);

  const [result] = await db.execute('DELETE FROM user_groups WHERE id = ?', [id]);
  return getAffectedRows(result) > 0;
}

// 获取用户组成员
export async function getUserGroupMembers(groupId: string): Promise<SafeUser[]> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const [rows] = await db.execute(`
    SELECT u.id, u.email, u.name, u.role, u.balance, u.disabled, u.concurrency_limit, u.created_at
    FROM users u
    INNER JOIN user_group_members m ON u.id = m.user_id
    WHERE m.group_id = ?
    ORDER BY u.created_at DESC
  `, [groupId]);

  return (rows).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    balance: row.balance,
    disabled: Boolean(row.disabled),
    concurrencyLimit: row.concurrency_limit !== null ? Number(row.concurrency_limit) : null,
    createdAt: Number(row.created_at),
  }));
}

// 添加用户到用户组
export async function addUserToGroup(userId: string, groupId: string): Promise<boolean> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  try {
    const id = generateId();
    const now = Date.now();
    await db.execute(
      'INSERT INTO user_group_members (id, user_id, group_id, created_at) VALUES (?, ?, ?, ?)',
      [id, userId, groupId, now]
    );
    return true;
  } catch (e: any) {
    // 忽略重复键错误
    if (e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062) {
      return true;
    }
    throw e;
  }
}

// 从用户组移除用户
export async function removeUserFromGroup(userId: string, groupId: string): Promise<boolean> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const [result] = await db.execute(
    'DELETE FROM user_group_members WHERE user_id = ? AND group_id = ?',
    [userId, groupId]
  );
  return getAffectedRows(result) > 0;
}

// 获取用户所属的用户组
export async function getUserGroups_ByUserId(userId: string): Promise<UserGroup[]> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const [rows] = await db.execute(`
    SELECT g.*
    FROM user_groups g
    INNER JOIN user_group_members m ON g.id = m.group_id
    WHERE m.user_id = ?
    ORDER BY g.is_default DESC, g.created_at ASC
  `, [userId]);

  return (rows).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    isDefault: Boolean(row.is_default),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

// 获取用户组可见的渠道
export async function getGroupChannelPermissions(groupId: string): Promise<string[]> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT channel_id FROM group_channel_permissions WHERE group_id = ?',
    [groupId]
  );

  return (rows).map((row) => row.channel_id);
}

// 设置用户组可见的渠道
export async function setGroupChannelPermissions(groupId: string, channelIds: string[]): Promise<void> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  // 先删除现有权限
  await db.execute('DELETE FROM group_channel_permissions WHERE group_id = ?', [groupId]);

  // 添加新权限
  const now = Date.now();
  for (const channelId of channelIds) {
    const id = generateId();
    await db.execute(
      'INSERT INTO group_channel_permissions (id, group_id, channel_id, created_at) VALUES (?, ?, ?, ?)',
      [id, groupId, channelId, now]
    );
  }
}

// 获取用户可见的视频渠道（基于用户组权限）
export async function getUserVisibleVideoChannels(userId: string): Promise<VideoChannel[]> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  // 获取用户所属的所有用户组
  const userGroups = await getUserGroups_ByUserId(userId);

  if (userGroups.length === 0) {
    // 用户不属于任何组，返回空
    return [];
  }

  const groupIds = userGroups.map(g => g.id);
  const placeholders = groupIds.map(() => '?').join(',');

  // 获取这些用户组有权限的渠道（且 enabled=1 且 is_listed=1）
  const [rows] = await db.execute(`
    SELECT DISTINCT c.*
    FROM video_channels c
    INNER JOIN group_channel_permissions p ON c.id = p.channel_id
    WHERE p.group_id IN (${placeholders})
      AND c.enabled = 1
      AND c.is_listed = 1
    ORDER BY c.created_at ASC
  `, groupIds);

  return (rows).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as ChannelType,
    baseUrl: row.base_url || '',
    apiKey: row.api_key || '',
    enabled: Boolean(row.enabled),
    isListed: Boolean(row.is_listed),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

// 检查用户是否有权限访问指定渠道
export async function checkUserChannelPermission(userId: string, channelId: string): Promise<boolean> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  // 获取用户所属的所有用户组
  const userGroups = await getUserGroups_ByUserId(userId);

  if (userGroups.length === 0) {
    return false;
  }

  const groupIds = userGroups.map(g => g.id);
  const placeholders = groupIds.map(() => '?').join(',');

  const [rows] = await db.execute(`
    SELECT 1 FROM group_channel_permissions
    WHERE group_id IN (${placeholders}) AND channel_id = ?
    LIMIT 1
  `, [...groupIds, channelId]);

  return (rows).length > 0;
}

// 将用户添加到默认用户组
export async function addUserToDefaultGroup(userId: string): Promise<void> {
  const defaultGroup = await getDefaultUserGroup();
  if (defaultGroup) {
    await addUserToGroup(userId, defaultGroup.id);
  }
}

// 确保默认用户组存在
export async function ensureDefaultUserGroup(): Promise<UserGroup> {
  let defaultGroup = await getDefaultUserGroup();

  if (!defaultGroup) {
    // 创建默认用户组
    defaultGroup = await createUserGroup({
      name: '默认用户组',
      description: '所有新注册用户自动加入此组',
      isDefault: true,
    });

    // 为默认组授权所有已启用且可见的渠道
    const channels = await getVideoChannels(true);
    const listedChannels = channels.filter(c => c.isListed);
    if (listedChannels.length > 0) {
      await setGroupChannelPermissions(defaultGroup.id, listedChannels.map(c => c.id));
    }
  }

  return defaultGroup;
}

// ========================================
// Group Model Pricing (用户组模型定价覆盖)
// ========================================

// 获取用户对某模型的有效价格（取所属所有用户组中的最低价）
export async function getEffectiveCost(
  userId: string,
  modelId: string,
  modelType: 'image' | 'video',
  defaultCost: number
): Promise<{ cost: number; groupName?: string; isDiscounted: boolean }> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const userGroups = await getUserGroups_ByUserId(userId);
  if (userGroups.length === 0) return { cost: defaultCost, isDiscounted: false };

  const groupIds = userGroups.map(g => g.id);
  const placeholders = groupIds.map(() => '?').join(',');

  const [rows] = await db.execute(`
    SELECT p.custom_cost, g.name as group_name
    FROM group_model_pricing p
    INNER JOIN user_groups g ON p.group_id = g.id
    WHERE p.group_id IN (${placeholders}) AND p.model_id = ? AND p.model_type = ?
    ORDER BY p.custom_cost ASC
    LIMIT 1
  `, [...groupIds, modelId, modelType]);

  if ((rows).length === 0) return { cost: defaultCost, isDiscounted: false };

  const bestPrice = (rows)[0];
  return {
    cost: Number(bestPrice.custom_cost),
    groupName: bestPrice.group_name,
    isDiscounted: Number(bestPrice.custom_cost) < defaultCost,
  };
}

// 获取用户组的所有模型定价覆盖
export async function getGroupModelPricing(groupId: string): Promise<Array<{ id: string; groupId: string; modelId: string; modelType: string; customCost: number; createdAt: number; updatedAt: number }>> {
  await initializeUserGroupsTables();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT * FROM group_model_pricing WHERE group_id = ? ORDER BY model_type, model_id',
    [groupId]
  );

  return (rows).map((row) => ({
    id: row.id,
    groupId: row.group_id,
    modelId: row.model_id,
    modelType: row.model_type,
    customCost: Number(row.custom_cost),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

// 设置用户组模型定价（upsert）
export async function setGroupModelPricing(
  groupId: string,
  modelId: string,
  modelType: string,
  customCost: number
): Promise<void> {
  await initializeUserGroupsTables();
  const db = getAdapter();
  const now = Date.now();

  // Try update first
  const [result] = await db.execute(
    'UPDATE group_model_pricing SET custom_cost = ?, updated_at = ? WHERE group_id = ? AND model_id = ?',
    [customCost, now, groupId, modelId]
  );

  if (getAffectedRows(result) === 0) {
    const id = generateId();
    await db.execute(
      'INSERT INTO group_model_pricing (id, group_id, model_id, model_type, custom_cost, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, groupId, modelId, modelType, customCost, now, now]
    );
  }
}

// 删除用户组模型定价
export async function deleteGroupModelPricing(groupId: string, modelId: string): Promise<void> {
  await initializeUserGroupsTables();
  const db = getAdapter();
  await db.execute(
    'DELETE FROM group_model_pricing WHERE group_id = ? AND model_id = ?',
    [groupId, modelId]
  );
}

// 批量设置用户组模型定价
export async function batchSetGroupModelPricing(
  groupId: string,
  pricings: Array<{ modelId: string; modelType: string; customCost: number }>
): Promise<void> {
  for (const p of pricings) {
    await setGroupModelPricing(groupId, p.modelId, p.modelType, p.customCost);
  }
}

// ========================================
// Email Verification Codes (邮箱验证码)
// ========================================

// 保存验证码
export async function saveVerificationCode(
  email: string,
  code: string,
  type: 'register' | 'reset'
): Promise<void> {
  await initializeDatabase();
  const db = getAdapter();
  const id = generateId();
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes

  await db.execute(
    'INSERT INTO email_verification_codes (id, email, code, type, expires_at, used, attempts, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?)',
    [id, email.toLowerCase(), code, type, expiresAt, now]
  );
}

// 获取最近的验证码（用于频率限制）
export async function getRecentVerificationCode(
  email: string,
  type: 'register' | 'reset'
): Promise<{ createdAt: number } | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT created_at FROM email_verification_codes WHERE email = ? AND type = ? ORDER BY created_at DESC LIMIT 1',
    [email.toLowerCase(), type]
  );

  if ((rows).length === 0) return null;
  return { createdAt: Number((rows)[0].created_at) };
}

// 验证验证码
export async function verifyCode(
  email: string,
  code: string,
  type: 'register' | 'reset'
): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();
  const now = Date.now();

  const [rows] = await db.execute(
    'SELECT id, attempts FROM email_verification_codes WHERE email = ? AND code = ? AND type = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
    [email.toLowerCase(), code, type, now]
  );

  if ((rows).length === 0) return false;

  const row = (rows)[0];
  if (row.attempts >= 5) return false; // Max 5 attempts

  // Increment attempts
  await db.execute(
    'UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?',
    [row.id]
  );

  return true;
}

// 标记验证码已使用
export async function markCodeUsed(
  email: string,
  code: string,
  type: 'register' | 'reset'
): Promise<void> {
  await initializeDatabase();
  const db = getAdapter();

  await db.execute(
    'UPDATE email_verification_codes SET used = 1 WHERE email = ? AND code = ? AND type = ?',
    [email.toLowerCase(), code, type]
  );
}

// ========================================
// Art Styles
// ========================================

export interface ArtStyle {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverImageUrl: string;
  referenceImageUrl: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export type SafeArtStyle = Omit<ArtStyle, 'referenceImageUrl'> & {
  referenceImageUrl?: string;
};

function mapArtStyleRow(row: Record<string, unknown>): ArtStyle {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description ? String(row.description) : '',
    coverImageUrl: row.cover_image_url ? String(row.cover_image_url) : '',
    referenceImageUrl: row.reference_image_url ? String(row.reference_image_url) : '',
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order || 0),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function getArtStyleById(id: string): Promise<ArtStyle | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM art_styles WHERE id = ?', [id]);
  const styles = rows;
  if (styles.length === 0) return null;

  return mapArtStyleRow(styles[0]);
}

export async function getArtStyleBySlug(slug: string): Promise<ArtStyle | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM art_styles WHERE slug = ?', [slug]);
  const styles = rows;
  if (styles.length === 0) return null;

  return mapArtStyleRow(styles[0]);
}

export async function getArtStyles(): Promise<ArtStyle[]> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT * FROM art_styles ORDER BY sort_order ASC, created_at ASC'
  );
  return (rows).map(mapArtStyleRow);
}

export async function getActiveArtStyles(): Promise<SafeArtStyle[]> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT * FROM art_styles WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC'
  );
  return (rows).map((row) => {
    const style = mapArtStyleRow(row);
    const { referenceImageUrl: _, ...safeStyle } = style;
    return safeStyle;
  });
}

export async function createArtStyle(
  data: Omit<ArtStyle, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ArtStyle> {
  await initializeDatabase();
  const db = getAdapter();

  const id = generateId();
  const now = Date.now();

  await db.execute(
    `INSERT INTO art_styles (
      id, slug, name, description, cover_image_url, reference_image_url,
      is_active, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.slug,
      data.name,
      data.description || '',
      data.coverImageUrl,
      data.referenceImageUrl || '',
      data.isActive ? 1 : 0,
      data.sortOrder,
      now,
      now,
    ]
  );

  return {
    ...data,
    id,
    description: data.description || '',
    referenceImageUrl: data.referenceImageUrl || '',
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateArtStyle(
  id: string,
  updates: Partial<Omit<ArtStyle, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ArtStyle | null> {
  await initializeDatabase();
  const db = getAdapter();

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.slug !== undefined) { fields.push('slug = ?'); values.push(updates.slug); }
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.coverImageUrl !== undefined) { fields.push('cover_image_url = ?'); values.push(updates.coverImageUrl); }
  if (updates.referenceImageUrl !== undefined) { fields.push('reference_image_url = ?'); values.push(updates.referenceImageUrl); }
  if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
  if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder); }

  values.push(id);
  await db.execute(`UPDATE art_styles SET ${fields.join(', ')} WHERE id = ?`, values);

  return getArtStyleById(id);
}

export async function deleteArtStyle(id: string): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();

  // 使用软删除（设置 is_active = 0）而不是物理删除，避免悬空引用
  const now = Date.now();
  const [result] = await db.execute(
    'UPDATE art_styles SET is_active = 0, updated_at = ? WHERE id = ?',
    [now, id]
  );
  return getAffectedRows(result) > 0;
}
