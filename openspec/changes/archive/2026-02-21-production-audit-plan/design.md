## Context

SanHub 是基于 Next.js 14 的 AI 内容生成平台，计划通过 Docker 单机部署到生产环境。生产就绪性审计发现 5 个 CRITICAL、12 个 HIGH、18 个 MEDIUM、8 个 LOW 问题，涵盖安全、数据库可靠性、API 规范化、前端质量和部署配置。

当前代码基线：103 个 API 路由（72 个未接入统一 handler）、62 个 lib 文件、80+ 个组件。数据库支持 SQLite/MySQL 双模式，通过 db-adapter 适配。

## Goals / Non-Goals

**Goals:**
- 修复所有 CRITICAL 和 HIGH 安全问题（部署阻塞项）
- 建立统一的 API 响应契约和错误处理框架
- 实现数据库迁移版本控制和连接池健康检查
- 引入 Redis 限流、Webhook 签名验证、Zod 输入校验
- 建立 Vitest 测试基础设施，核心路径覆盖率 ≥60%
- Docker 部署安全加固（密钥注入、健康检查）

**Non-Goals:**
- 不迁移到 ORM 框架（保持手写 SQL + 自定义 adapter）
- 不重构前端目录结构（保持现有 /components, /hooks, /lib 组织）
- 不引入微服务架构（保持单体 Next.js 应用）
- 不做 MEDIUM/LOW 问题的全量修复（部署后迭代）

## Decisions

### D-01: API 客户端 — React Query + apiFetch wrapper
- 统一 `apiFetch()` 封装：响应契约 `{success, data?, error?, code?, requestId?}`
- 超时 10s + AbortController，超时映射为 `ApiError(code='UPSTREAM_TIMEOUT')`
- 鉴权 `credentials=same-origin`，401→跳登录，403→toast
- React Query 全局：`staleTime=30s, gcTime=5min, retry=2, refetchOnWindowFocus=false`
- Query key factory：`[module, resource, params]`，mutation 后按模块失效
- 替代方案：SWR（复杂 mutation 链不足）、纯 fetch wrapper（工作量大）

### D-02: 限流持久化 — Redis (Docker Compose 内置)
- 算法：sliding window + Lua 原子脚本
- Key 维度：`{scope}:{route}:{userId|ip}`，登录用户优先 userId
- 阈值：API=60/min, AUTH=5/min, GENERATE=10/min, CHAT=20/min
- Redis timeout=200ms，重试 1 次
- fail-open：仅限流子系统，不影响业务写路径，结构化告警 5min 去重
- X-Forwarded-For：`TRUST_PROXY=true` 时读首个可信 IP
- 替代方案：SQLite-backed（高并发写锁瓶颈）、内存（重启丢失）

### D-03: 测试框架 — Vitest + React Testing Library
- 门禁阈值：全局 ≥60%, lib/ ≥70%, api-handler ≥80%
- CI 矩阵：sqlite, mysql, mysql+redis-down 三套场景
- 必测失败路径：token 重放、token 过期、redis 不可用 fail-open、连接池 unhealthy 恢复
- 替代方案：Jest（生态成熟但 ESM 支持弱）

### D-04: Webhook 签名 — URL 一次性 token
- Token：32 bytes random + base64url
- 存储：仅存 SHA-256 哈希，禁止明文落库
- TTL：24h，过期返回 410 Gone
- 消费：单 SQL 原子 compare-and-set，避免并发双消费
- 重复回调：已消费返回 200 + 不修改状态（幂等）
- 无效 token：401，日志不打印原 token
- 替代方案：HMAC-SHA256 签名头（依赖供应商支持）

### D-05: 输入校验 — Zod
- strict 模式（拒绝未知 key）
- 空字符串视为空值
- coerce 仅用于 number/boolean
- 校验失败：422 Unprocessable Entity + `{error, details: ZodError.issues}`
- 替代方案：Joi（TS 类型推断弱）、手动校验（易遗漏）

### D-06: DB 迁移 — 自定义 migration runner
- 新增 `schema_migrations` 表：`{id, checksum, executed_at, success}`
- 迁移文件：`lib/db/migrations/*.ts`，ID 格式 `时间戳_slug`（如 `20260221_add_xxx`）
- 并发锁：MySQL `GET_LOCK` / SQLite 文件锁
- 事务：每个 migration 包事务，DDL 除外（MySQL DDL 隐式提交）
- checksum 漂移：启动失败 + 人工介入
- 基线：初始版本写入 schema_migrations，跳过已执行 DDL
- 失败：停止启动 + 保留失败记录 + 可重试入口
- 替代方案：knex/drizzle（无法消化已有 4000+ 行 SQL）

### D-07: 连接池健康检查
- 探针：`SELECT 1`，超时 2s
- 心跳间隔：30s（MySQL），SQLite 不做独立心跳
- 状态机：healthy → degraded(1-2 失败) → unhealthy(3+)
- unhealthy：拒绝新请求 + 触发重建（单飞保护）
- 重建失败冷却：30s
- 查询重试：仅连接类瞬时错误，事务内写不重试
- queueLimit：`connectionLimit * 4`，min=10, max=200，向下取整
- 重试策略：指数退避 1s→2s→4s + 20% jitter，最多 5 次

### D-08: 错误处理框架
- ApiError 映射矩阵：ValidationError→400, AuthError→401, ForbiddenError→403, NotFoundError→404, RateLimitError→429, InternalError→500
- 每个 route 必填 fallbackMessage，禁止模糊文案
- 异步任务失败持久化：`{taskId, errorCode, retryCount, lastError}`
- SSE 异常：发送 `event:error + {code, message}` 后关闭流
- 生产环境：响应不含 stack/file path/raw Error.message

### D-09: Docker 部署加固
- 必注变量：NEXTAUTH_URL, NEXTAUTH_SECRET, DB_TYPE, MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, ADMIN_EMAIL, ADMIN_PASSWORD, REDIS_URL
- 优先级：runtime env > secret file > 无默认值
- compose 格式：`${VAR:?required}`
- 统一命名：MYSQL_DATABASE（修复 MYSQL_NAME 漂移）
- 密钥轮换：公告维护窗口 → 更新 secret → 重启服务 → 用户重新登录
- 健康检查：`curl -f http://localhost:3000/api/health || exit 1`
- 上线前必须完成备份验证

### D-10: 路由迁移策略
- 按模块分批 PR：admin → generate → projects → episodes → assets → user → misc
- 每批最多 15 个路由
- 迁移期间新旧均输出统一 envelope
- 模块完成判定：100% 统一 handler + 无裸 error.message
- 每批必过：lint + test + typecheck
- 排除项：`[...nextauth]/route.ts`、SSE 流路由需特殊处理

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 72 路由迁移可能破坏前端 API 调用 | 先建 apiFetch wrapper 指向旧路由，迁移后更新映射 |
| NEXTAUTH_SECRET 轮换导致 session 失效 | 公告维护窗口，用户重新登录 |
| Redis 不可用导致全站不可用 | fail-open 策略，仅限流子系统降级 |
| MySQL DDL 大表锁时间 | 评估锁时间，必要时窗口执行 |
| 嵌套事务改 savepoint 后行为变化 | 业务代码审查，确保不假设"全回滚" |
| SQLite/MySQL 双库行为分叉 | 迁移文件显式标注 dialect 分支 SQL |

## Migration Plan

1. **Phase 1 (安全修复)**: C-01~C-05 + H-02~H-05 + H-12 → 部署阻塞项
2. **Phase 2 (基建)**: H-07(迁移) + H-08(事务) + H-09(连接池) + Redis + Zod + apiFetch
3. **Phase 3 (路由迁移)**: H-01 按模块分批 PR
4. **Phase 4 (类型债务)**: H-06 清理 as any
5. **Phase 5 (前端质量)**: H-10(组件拆分) + H-11(store 分离) + React Query 接入
6. **Phase 6 (测试)**: Vitest 基础设施 + 核心路径测试 + CI 矩阵

Phase 1+2 可并行。Phase 3 依赖 Phase 2 完成。Phase 4 依赖 Phase 3。Phase 5-6 可与 Phase 3-4 并行。

## Open Questions

无。所有 45 项歧义已通过用户决策消除。
