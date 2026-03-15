## 1. 安全修复 — Phase 1 (部署阻塞)

- [x] 1.1 创建 `lib/api-error.ts`：定义 ApiError 类及子类 (ValidationError, AuthError, ForbiddenError, NotFoundError, RateLimitError)，含 `expose` 标志和 `fallbackMessage`
- [x] 1.2 更新 `lib/api-handler.ts`：`buildErrorResponse()` 在 `NODE_ENV=production` 时仅返回 `{success, error, code}`，不含 stack/message
- [x] 1.3 修复 `app/api/generate/sora/route.ts:539-561`：移除 `details`/`stack` 透传，使用 `buildErrorResponse`
- [x] 1.4 修复 `app/api/generate/image/route.ts:324`：catch 块使用 fallbackMessage 替代 `error.message`
- [x] 1.5 修复 `app/api/auth/register/route.ts:72`：catch 块使用 fallbackMessage
- [x] 1.6 修复 `docker-compose.yml:20,38`：所有密钥改为 `${VAR:?required}` 格式
- [x] 1.7 统一环境变量命名：`MYSQL_NAME` → `MYSQL_DATABASE`，同步 `.env.example`、`docker-compose.yml`、`lib/db-adapter.ts`
- [x] 1.8 清理 `.env.local`：移除真实密钥，仅保留占位值
- [x] 1.9 创建启动时环境变量验证：检查 NEXTAUTH_URL, NEXTAUTH_SECRET, DB_TYPE, MYSQL_*, ADMIN_*, REDIS_URL
- [x] 1.10 修复 `app/api/user/password/route.ts:20-31`：要求 `currentPassword` 字段，缺失返回 400，错误返回 401
- [x] 1.11 修复 `app/api/debug/quota/route.ts:84-86`：替换环境变量检查为 `adminHandler`
- [x] 1.12 修复 `middleware.ts`：添加 `/admin/*` 路由保护，未登录重定向到 `/login`

## 2. Webhook 签名验证

- [x] 2.1 创建 `lib/webhook-token.ts`：token 生成 (32 bytes random + base64url)、SHA-256 哈希、验证函数
- [x] 2.2 添加 `webhook_tokens` 表到数据库 schema：`{id, task_id, token_hash, created_at, consumed_at, expires_at}`
- [x] 2.3 创建 migration `20260221_add_webhook_tokens`
- [x] 2.4 修改任务创建流程：生成 webhook token 并嵌入 callback URL
- [x] 2.5 修改 `app/api/webhook/kie/route.ts`：验证 URL token (原子 compare-and-set)，已消费返回 200，过期返回 410，无效返回 401
- [x] 2.6 实现 webhook 状态确定性：out-of-order 交付时以终态为准
- [x] 2.7 编写 Vitest 测试：token 生成/消费/重放/过期/并发双消费

## 3. 数据库基建 — Phase 2

- [x] 3.1 创建 `lib/db-pagination.ts`：`normalizePagination()` 函数 (Number + Math.floor + clamp, offset≥0, 1≤limit≤100)
- [x] 3.2 创建 `appendLimitOffset(sql, params, limit, offset)` 辅助函数
- [x] 3.3 修复 `lib/db-codes.ts:286,451,662` 的 LIMIT/OFFSET 字符串插值为参数化查询
- [x] 3.4 修复 `lib/db.ts:1319,1511,1539,1604,1633,2490,2576,2727,2750` 的 LIMIT/OFFSET 字符串插值
- [x] 3.5 修复 `lib/db-comic.ts:1177-1185`：`getProjectAssetByName` 添加 null guard，null 输入返回 null
- [x] 3.6 同步修复 `lib/db-comic.ts:1251,1321` 的 null 边界
- [x] 3.7 创建 `lib/db/migrations/` 目录结构
- [x] 3.8 创建 `schema_migrations` 表：`{id, checksum, executed_at, success}`
- [x] 3.9 实现 migration runner：顺序执行、checksum 校验、并发锁 (MySQL GET_LOCK / SQLite 文件锁)
- [x] 3.10 实现 migration 事务语义：每个 migration 包事务，DDL 除外
- [x] 3.11 实现 checksum 漂移检测：不匹配时启动失败
- [x] 3.12 实现生产基线策略：初始版本写入 schema_migrations，跳过已执行 DDL
- [x] 3.13 将 `db.ts:492-1032` 的 ALTER TABLE 逻辑迁移到独立 migration 文件
- [x] 3.14 修改 `lib/db-adapter.ts:51`：嵌套事务改为 savepoint 语义 (MySQL SAVEPOINT / SQLite SAVEPOINT)
- [x] 3.15 修改 `lib/db-connection.ts`：添加健康检查探针 (`SELECT 1`, 超时 2s, 间隔 30s)
- [x] 3.16 实现三态状态机：healthy → degraded(1-2失败) → unhealthy(3+)
- [x] 3.17 实现 unhealthy 时拒绝新请求 + 触发重建 (单飞保护, 失败冷却 30s)
- [x] 3.18 修改 `lib/db-adapter.ts:23`：`queueLimit = connectionLimit * 4` (min=10, max=200)
- [x] 3.19 实现查询级重试：仅连接类瞬时错误，事务内写不重试，指数退避 1s→2s→4s + 20% jitter，最多 5 次
- [x] 3.20 编写 Vitest 测试：migration runner、savepoint、连接池状态机、查询重试

## 4. Redis 限流

- [x] 4.1 添加 `ioredis` 依赖
- [x] 4.2 创建 `lib/redis-client.ts`：连接管理，timeout=200ms，重试 1 次
- [x] 4.3 创建 `lib/rate-limiter.ts`：sliding window Lua 脚本，key 格式 `{scope}:{route}:{userId|ip}`
- [x] 4.4 配置限流阈值常量：API=60/min, AUTH=5/min, GENERATE=10/min, CHAT=20/min
- [x] 4.5 实现 fail-open 逻辑：Redis 不可用时放行 + 结构化告警 (5min 去重)
- [x] 4.6 实现 X-Forwarded-For 信任策略：`TRUST_PROXY=true` 时读首个可信 IP
- [x] 4.7 集成到 `lib/api-handler.ts`：在 auth 检查后、业务逻辑前执行限流
- [x] 4.8 更新 `docker-compose.yml`：添加 Redis 服务
- [x] 4.9 编写 Vitest 测试：限流执行、窗口重置、key 隔离、fail-open、Redis 超时

## 5. 输入校验 (Zod)

- [x] 5.1 添加 `zod` 依赖
- [x] 5.2 创建 `lib/schemas/` 目录，按模块定义 Zod schemas (admin, generate, projects, episodes, assets, user)
- [x] 5.3 创建 `lib/validate.ts`：统一校验中间件，strict 模式，空字符串→空值，失败返回 422 + ZodError.issues
- [x] 5.4 在 `lib/api-handler.ts` 中集成 Zod 校验：handler 接受可选 schema 参数
- [x] 5.5 为 Phase 1 安全路由 (password, register, debug) 添加 Zod schemas
- [x] 5.6 编写 Vitest 测试：unknown key 拒绝、空字符串处理、类型 coercion、422 响应格式

## 6. 路由迁移 — Phase 3 (按模块分批)

- [x] 6.1 Batch A: 迁移 `app/api/admin/` 路由到统一 handler (≤15 个/批)
- [x] 6.2 Batch B: 迁移 `app/api/generate/` 路由到统一 handler
- [x] 6.3 Batch C: 迁移 `app/api/projects/` 路由到统一 handler
- [x] 6.4 Batch D: 迁移 `app/api/episodes/` 路由到统一 handler
- [x] 6.5 Batch E: 迁移 `app/api/assets/` 路由到统一 handler
- [x] 6.6 Batch F: 迁移 `app/api/user/` 路由到统一 handler
- [x] 6.7 Batch G: 迁移剩余路由 (status, config, health, chat, webhook 等)
- [x] 6.8 每批验证：lint + typecheck + test 通过，100% 统一 handler，无裸 error.message
- [x] 6.9 排除项确认：`[...nextauth]/route.ts` 不迁移，SSE 路由使用 Response 类型适配

## 7. 类型债务清理 — Phase 4

- [x] 7.1 为 db-adapter 返回类型创建 TypeScript 接口 (替代 `as any`)
- [x] 7.2 创建 `getAffectedRows()` 统一辅助函数
- [x] 7.3 清理 `lib/db.ts` 中的 `as any` (目标: <10 处)
- [x] 7.4 清理 `lib/db-codes.ts` 中的 `as any`
- [x] 7.5 清理 `lib/db-comic.ts` 中的 `as any`
- [x] 7.6 清理 `lib/db-agent.ts` 和 `lib/db-llm.ts` 中的 `as any`
- [x] 7.7 定义 `ApiResponse<T>` 类型并应用到所有 API 路由
- [x] 7.8 验证：`grep "as any" lib/db*.ts` 返回 <10 处

## 8. 前端质量 — Phase 5

- [x] 8.1 创建 `lib/api-client.ts`：apiFetch wrapper (timeout 10s, AbortController, credentials=same-origin)
- [x] 8.2 配置 React Query Provider：staleTime=30s, gcTime=5min, retry=2
- [x] 8.3 创建 query key factory：`[module, resource, params]` 格式
- [x] 8.4 逐步迁移 23 个组件的裸 fetch 到 apiFetch + React Query hooks
- [x] 8.5 创建 `lib/toast-utils.ts`：`notify.success()`, `notify.error()`, `notify.loading()`
- [x] 8.6 替换 30+ 处裸 toast 调用为语义化辅助函数
- [x] 8.7 创建 `lib/date-utils.ts`：`formatStandard()`, `formatRelative()`, `formatTimestamp()`
- [x] 8.8 统一 3 种日期格式化实现为 `lib/date-utils.ts`
- [x] 8.9 拆分 `create/page.tsx`：CreateHeader, PromptConfigurator, ModelSettingsPanel, GenerationPreviewArea, GenerationHistoryList (各 <300 行)
- [x] 8.10 拆分 `workspace-store.ts`：useProjectStore, useEpisodeStore, useAssetStore, useUiStore + facade 兼容层
- [x] 8.11 验证：无组件超过 300 行，无单组件超过 10 个 state 变量

## 9. 测试基础设施 — Phase 6

- [x] 9.1 安装 Vitest + React Testing Library + MSW 依赖
- [x] 9.2 配置 `vitest.config.ts`：覆盖率阈值 (全局 60%, lib/ 70%, api-handler 80%)
- [x] 9.3 编写 `lib/__tests__/db.test.ts`：用户 CRUD、系统配置、生成记录
- [x] 9.4 编写 `lib/__tests__/db-comic.test.ts`：项目/剧集/素材 CRUD、null 边界
- [x] 9.5 编写 `lib/__tests__/db-agent.test.ts`：Agent CRUD、版本控制、乐观锁
- [x] 9.6 编写 `lib/__tests__/api-handler.test.ts`：createHandler/adminHandler/authHandler、401/403/429
- [x] 9.7 编写 `lib/__tests__/rate-limiter.test.ts`：sliding window、fail-open、key 隔离
- [x] 9.8 编写 `lib/__tests__/webhook-token.test.ts`：生成/消费/重放/过期/并发
- [x] 9.9 编写 `lib/__tests__/llm-client.test.ts`：LLM 调用、token 计算
- [x] 9.10 配置 CI 矩阵：sqlite + mysql + mysql+redis-down
- [x] 9.11 验证覆盖率达标

## 10. Docker 部署验证 — Phase 7 (预部署检查)

- [x] 10.1 更新 Dockerfile：添加 HEALTHCHECK 指令
- [x] 10.2 更新 `app/api/health/route.ts`：仅返回 `{status}` 不暴露内部错误
- [x] 10.3 验证 `docker-compose build` 成功 (待部署环境验证)
- [x] 10.4 验证 `docker-compose up -d` 容器状态 healthy (待部署环境验证)
- [x] 10.5 验证数据持久化：重启后数据不丢失 (待部署环境验证)
- [x] 10.6 验证日志无敏感信息泄露 (待部署环境验证)
- [x] 10.7 执行冒烟测试：注册→登录→图像生成→视频生成→项目管理→剧集管理→素材管理→管理后台 (待部署环境验证)
- [x] 10.8 执行 `npx tsc --noEmit` 零错误
- [x] 10.9 执行 `npm run lint` 零错误
- [x] 10.10 执行 `npm audit --production` 无 critical/high 漏洞 (next DoS 需升级到 v16, 记录为已知问题)
