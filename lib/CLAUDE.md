# lib/ - 核心业务逻辑库

[根目录](../CLAUDE.md) > **lib**

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-20 | 1.1.0 | 新增 Agent 系统、AI 分镜、素材分析、任务调度、即梦 API 等 23 个文件 |
| 2026-02-06 | 1.0.0 | 初始化模块文档 |

---

## 模块职责

`lib/` 目录是 SanHub 平台的核心业务逻辑层，包含：
- 数据库操作与适配器（多表、多数据库）
- AI 内容生成服务（图像、视频、LLM）
- Agent 提示词系统（db-agent、agent-utils、prompt-service）
- AI 分镜与素材分析服务
- 认证、邮件、验证码
- HTTP 重试、轮询、任务调度
- 缓存、工具函数、配置默认值

---

## 入口与启动

| 文件 | 职责 |
|------|------|
| `db.ts` | 数据库操作核心入口，包含所有表的 CRUD 操作 |
| `auth.ts` | NextAuth.js 配置，认证入口 |
| `image-generator.ts` | 统一图像生成入口 |
| `video-generator.ts` | 统一视频生成入口 |
| `llm-client.ts` | LLM 调用客户端 |

---

## 对外接口

### 数据库操作 (db.ts)

**用户管理**
```typescript
createUser(email, password, name, role?, balance?): Promise<User>
getUserById(id): Promise<User | null>
getUserByEmail(email): Promise<User | null>
verifyPassword(email, password): Promise<User | null>
updateUser(id, updates): Promise<User | null>
updateUserBalance(id, amount): Promise<boolean>
getAllUsers(options): Promise<SafeUser[]>
deleteUser(id): Promise<boolean>
```

**生成记录**
```typescript
saveGeneration(generation): Promise<Generation>
updateGeneration(id, updates): Promise<Generation | null>
getGeneration(id): Promise<Generation | null>
getUserGenerations(userId, options): Promise<Generation[]>
deleteGeneration(id, userId): Promise<boolean>
```

**系统配置**
```typescript
getSystemConfig(): Promise<SystemConfig>
updateSystemConfig(updates): Promise<SystemConfig>
```

**渠道与模型**
```typescript
getImageChannels(enabledOnly?): Promise<ImageChannel[]>
getImageModels(enabledOnly?): Promise<ImageModel[]>
getImageModelWithChannel(modelId): Promise<ModelConfig | null>
getVideoChannels(enabledOnly?): Promise<VideoChannel[]>
getVideoModels(enabledOnly?): Promise<VideoModel[]>
getVideoModelWithChannel(modelId): Promise<ModelConfig | null>
```

### 图像生成 (image-generator.ts)

```typescript
generateImage(request: ImageGenerateRequest): Promise<GenerateResult>
```

**支持的渠道类型**: `openai-compatible`, `gemini`, `modelscope`, `gitee`, `sora`

### 视频生成 (video-generator.ts)

```typescript
generateVideo(request, onProgress?, context?): Promise<GenerateResult>
```

**支持的渠道类型**: `sora`, `openai-compatible`, `kie-ai`, `suchuang`, `jimeng`

### LLM 客户端 (llm-client.ts)

```typescript
generateLlmText(config: LlmModel, options: LlmGenerateOptions): Promise<LlmResponse>
```

**支持的 Provider**: `gemini`, `openai-compatible`

### Agent 系统 (db-agent.ts)

```typescript
getAgentByKey(featureKey): Promise<LlmAgent | null>
getAllAgents(): Promise<AgentSummary[]>
upsertAgent(featureKey, data): Promise<LlmAgent>
createAgentVersion(featureKey, data): Promise<AgentVersion>
getAgentVersions(featureKey): Promise<AgentVersion[]>
```

### AI 分镜服务 (ai-storyboard-service.ts)

```typescript
generateStoryboard(content: string): Promise<StoryboardResult>
// StoryboardResult = { shots: StoryboardShot[] }
```

### 素材分析服务 (asset-analyzer.ts)

```typescript
analyzeAssets(content: string): Promise<AssetAnalysisResult>
// AssetAnalysisResult = { characters, scenes, props }
```

### 功能绑定 (feature-binding.ts)

```typescript
resolveFeatureBinding(featureKey, modelType): Promise<{ modelId, config } | null>
resolveStoryLlmConfig(): Promise<LlmConfig | null>
```

### 任务调度 (task-scheduler.ts)

```typescript
// 处理排队中的图像/视频生成任务
processQueuedImageTask(gen: Generation): Promise<void>
processQueuedVideoTask(gen: Generation): Promise<void>
```

### API 处理器 (api-handler.ts)

```typescript
createHandler(options, handler): RouteHandler
adminHandler(handler, options?): RouteHandler   // 仅 admin
authHandler(handler, options?): RouteHandler     // 需登录
```

### 认证 (auth.ts)

```typescript
export const authOptions: NextAuthOptions
// CredentialsProvider, JWT 策略, 7 天有效期
```

---

## 关键依赖与配置

### 数据库适配器 (db-adapter.ts + db-connection.ts)

支持双数据库切换：
- **SQLite**: 使用 `better-sqlite3`，WAL 模式
- **MySQL**: 使用 `mysql2/promise`，连接池

`db-connection.ts` 提供全局单例 `getSharedAdapter()`。

### 缓存系统 (cache.ts)

```typescript
cache.get<T>(key): T | null
cache.set<T>(key, value, ttlSeconds): void
cache.delete(key): void
cache.deleteByPrefix(prefix): void
```

### HTTP 工具

| 文件 | 用途 |
|------|------|
| `http-retry.ts` | HTTP 请求重试（指数退避、Retry-After） |
| `http-json.ts` | JSON 响应解析（HTML 检测） |
| `safe-fetch.ts` | 安全外部请求 |
| `backend-poller.ts` | 后端任务轮询（双频率策略） |
| `polling-utils.ts` | 轮询工具函数 |
| `retry-utils.ts` | 重试判断工具 |
| `retry-config-validator.ts` | 重试配置验证 |

### 提示词系统

| 文件 | 用途 |
|------|------|
| `prompt-service.ts` | 提示词模板获取（Agent 优先，fallback 到 llm_prompts） |
| `agent-utils.ts` | Agent 配置编译（compileSystemPrompt） |
| `schema-registry.ts` | JSON Schema 注册表（asset_analyze, storyboard 等） |

### 其他服务

| 文件 | 用途 |
|------|------|
| `email.ts` | SMTP 邮件发送（验证码） |
| `captcha.ts` | 验证码生成与验证 |
| `media-storage.ts` | 媒体文件本地存储 |
| `upload-service.ts` | 文件上传服务 |
| `picui.ts` | PicUI 图床 |
| `imgbed.ts` | 图床配置 |
| `image-compression.ts` | 图片压缩（WebP） |
| `image-model-selector.ts` | 图像模型智能选择 |
| `page-registry.ts` | 页面注册表（禁用检测） |
| `config-defaults.ts` | 默认配置常量 |
| `api-endpoints.ts` | API 端点常量映射 |
| `api-error.ts` | API 错误响应构建 |
| `proxy-agent.ts` | SOCKS 代理 |
| `log-verbose.ts` | 详细日志工具 |
| `debug.ts` | 调试工具 |
| `debug-utils.ts` | 调试辅助（脱敏） |
| `server-log-capture.ts` | 服务端日志捕获 |
| `server-log-store.ts` | 服务端日志存储 |
| `hidden-generations.ts` | 隐藏生成记录 |
| `download.ts` | 资源下载 |
| `status-poller.ts` | 状态轮询 |

---

## 数据模型

### 核心表结构

| 表名 | 说明 | 主要字段 |
|------|------|----------|
| `users` | 用户信息 | id, email, password, name, role, balance, disabled |
| `generations` | 生成记录 | id, user_id, type, prompt, result_url, status, cost |
| `system_config` | 系统配置 | API keys, pricing, limits, smtp |
| `image_channels` | 图像渠道 | id, name, type, base_url, api_key |
| `image_models` | 图像模型 | id, channel_id, name, api_model, cost, features |
| `video_channels` | 视频渠道 | id, name, type, base_url, api_key |
| `video_models` | 视频模型 | id, channel_id, name, api_model |
| `llm_models` | LLM 模型 | id, provider, base_url, api_key, model_name |
| `llm_agents` | Agent 配置 | feature_key, config_json, system_prompt |
| `llm_agent_versions` | Agent 版本 | id, feature_key, version, config_json |
| `feature_bindings` | 功能绑定 | feature_key, model_type, model_id |
| `workspaces` | 工作空间 | id, user_id, name, data |
| `character_cards` | 角色卡 | id, user_id, character_name, avatar_url |
| `user_groups` | 用户组 | id, name, permissions |
| `art_styles` | 画风配置 | id, slug, name, cover_image_url |
| `comic_projects` | 漫剧项目 | id, owner_user_id, name, aspect_ratio |
| `comic_episodes` | 漫剧剧集 | id, project_id, order_num, title, content |
| `project_assets` | 项目素材 | id, project_id, type, name, primary_image_url |
| `asset_occurrences` | 素材出现 | id, asset_id, episode_id, source_text |

---

## 子模块

| 子模块 | 路径 | 说明 |
|--------|------|------|
| Stores | `lib/stores/` | Zustand 状态管理（workspace-store） |
| Hooks | `lib/hooks/` | React Hooks（use-image-generation-config, use-admin-config） |
| Constants | `lib/constants/` | 常量定义（preferences） |

注: `lib/story-agents/` 目录当前为空，Agent 功能已迁移至 `db-agent.ts` + `agent-utils.ts` + `prompt-service.ts`。

---

## 测试与质量

**当前状态**: 无测试文件

**建议**:
- 为 `db.ts` 添加单元测试（mock 数据库适配器）
- 为 `image-generator.ts` 和 `video-generator.ts` 添加集成测试
- 为 `http-retry.ts` 添加重试逻辑测试
- 为 `prompt-service.ts` 添加模板渲染测试

---

## 常见问题 (FAQ)

**Q: 如何切换数据库类型？**
A: 设置环境变量 `DB_TYPE=mysql` 或 `DB_TYPE=sqlite`，并配置相应的连接参数。

**Q: 如何添加新的图像/视频渠道？**
A:
1. 在 `image-generator.ts` 或 `video-generator.ts` 中添加新的生成函数
2. 在 switch 语句中添加新的 case
3. 在数据库中创建对应的渠道和模型记录

**Q: API Key 轮询机制如何工作？**
A: 渠道的 `api_key` 字段支持逗号分隔的多个 Key，系统会自动轮询使用。

**Q: Agent 提示词如何工作？**
A: `prompt-service.ts` 优先从 `llm_agents` 表获取 Agent 配置，如果不存在或未启用则 fallback 到 `llm_prompts` 表，最终 fallback 到代码中的默认值。

---

## 相关文件清单

```
lib/
  db.ts                      # 数据库操作核心
  db-adapter.ts              # 数据库适配器
  db-connection.ts           # 数据库连接单例
  db-codes.ts                # 邀请码/卡密操作
  db-comic.ts                # 漫剧项目操作
  db-llm.ts                  # LLM 模型操作
  db-agent.ts                # Agent CRUD 操作
  auth.ts                    # NextAuth 配置
  image-generator.ts         # 图像生成统一入口
  video-generator.ts         # 视频生成统一入口
  sora-api.ts                # Sora API 封装
  sora.ts                    # Sora 工具
  kie-api.ts                 # KIE-AI API 封装
  suchuang-api.ts            # 速创 API 封装
  jimeng-api.ts              # 即梦 API 封装
  llm-client.ts              # LLM 客户端
  gemini-agent.ts            # Gemini Agent 服务
  ai-storyboard-service.ts   # AI 分镜服务
  asset-analyzer.ts          # 素材分析服务
  feature-binding.ts         # 功能绑定解析
  prompt-service.ts          # 提示词模板服务
  agent-utils.ts             # Agent 工具函数
  schema-registry.ts         # JSON Schema 注册表
  task-scheduler.ts          # 任务调度器
  api-handler.ts             # API 路由处理器
  api-endpoints.ts           # API 端点常量
  api-error.ts               # API 错误处理
  cache.ts                   # 内存缓存
  http-retry.ts              # HTTP 重试
  http-json.ts               # JSON 解析
  safe-fetch.ts              # 安全请求
  backend-poller.ts          # 后端轮询
  polling-utils.ts           # 轮询工具
  retry-utils.ts             # 重试工具
  retry-config-validator.ts  # 重试配置验证
  email.ts                   # 邮件发送
  captcha.ts                 # 验证码
  media-storage.ts           # 媒体存储
  upload-service.ts          # 上传服务
  picui.ts                   # PicUI 图床
  imgbed.ts                  # 图床配置
  image-compression.ts       # 图片压缩
  image-model-selector.ts    # 模型智能选择
  page-registry.ts           # 页面注册表
  config-defaults.ts         # 默认配置
  model-config.ts            # 模型配置
  rate-limit.ts              # 速率限制
  proxy-agent.ts             # SOCKS 代理
  utils.ts                   # 工具函数
  download.ts                # 资源下载
  status-poller.ts           # 状态轮询
  log-verbose.ts             # 详细日志
  debug.ts                   # 调试工具
  debug-utils.ts             # 调试辅助
  server-log-capture.ts      # 服务端日志捕获
  server-log-store.ts        # 服务端日志存储
  hidden-generations.ts      # 隐藏生成记录
  stores/
    workspace-store.ts       # 工作区 Zustand Store
  hooks/
    use-image-generation-config.ts  # 图像生成配置 Hook
    use-admin-config.ts             # 管理配置 Hook
  constants/
    preferences.ts           # 偏好常量
```
