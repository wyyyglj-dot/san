# SanHub 生产就绪性审计 — 测试与调试计划

## 1. 背景与目标

SanHub 是一个基于 Next.js 14 的 AI 内容生成平台，计划通过 Docker 单机部署到生产环境。本计划旨在：

- 发现并修复潜在 BUG
- 识别屎山代码和不规范编码
- 消除重复造轮子行为
- 验证预部署可行性
- 建立可持续的质量保障机制

**审计范围**: 103 个 API 路由、62 个 lib 文件、80+ 个组件、Docker 配置
**目标覆盖率**: 核心路径 60%（lib/ + API 认证/权限 + 数据库操作）

---

## 2. 约束集（Constraint Sets）

### 2.1 硬约束（不可违反）

| ID | 约束 | 来源 |
|----|------|------|
| HC-01 | 所有数据库查询必须使用参数化查询（?占位符），禁止字符串拼接 SQL | db-adapter.ts |
| HC-02 | 所有需要认证的 API 路由必须使用 createHandler/authHandler/adminHandler | api-handler.ts |
| HC-03 | API 响应格式统一为 `{ success: boolean, data?: T, error?: string }` | 项目规范 |
| HC-04 | LLM 调用必须通过 `lib/llm-client.ts` 的 `generateLlmText()` | 项目规范 |
| HC-05 | Middleware 运行在 Edge Runtime，不可直接访问数据库 | Next.js 限制 |
| HC-06 | 生产环境不得暴露 error.stack 或内部实现细节 | 安全要求 |
| HC-07 | Docker 部署目标为单机模式（docker-compose） | 用户确认 |

### 2.2 软约束（建议遵循）

| ID | 约束 | 来源 |
|----|------|------|
| SC-01 | 组件不超过 300 行，函数不超过 50 行 | 代码质量 |
| SC-02 | 布尔状态命名使用 `isXxx`/`hasXxx` 前缀 | 命名规范 |
| SC-03 | 事件处理器命名使用 `handleXxx` 前缀 | 命名规范 |
| SC-04 | 魔法数字提取为命名常量 | 可维护性 |
| SC-05 | 日志使用 `[模块名]` 前缀标识来源 | 可追踪性 |

---

## 3. 审计发现汇总

### 3.1 按严重程度分级

#### 🔴 CRITICAL（5 项）— 部署前必须修复

| # | 问题 | 位置 | 描述 |
|---|------|------|------|
| C-01 | error.stack 泄露 | `app/api/generate/sora/route.ts:561` | 生产环境可能暴露堆栈信息 |
| C-02 | LIMIT/OFFSET 字符串插值 | `db-codes.ts:286`, `db.ts:1319` 等 10 处 | 虽有 Math.max 保护但不规范，应改为参数化 |
| C-03 | NULL/undefined 边界缺失 | `db-comic.ts:1177` | `name.trim()` 在 null 输入时崩溃 |
| C-04 | docker-compose 硬编码密钥 | `docker-compose.yml:20,40` | NEXTAUTH_SECRET 和 MYSQL_PASSWORD 明文 |
| C-05 | .env.local 含真实密码 | `.env.local:5,18` | 误提交 Git 会泄露生产密钥 |

#### 🟠 HIGH（12 项）— 部署前应修复

| # | 问题 | 位置 | 描述 |
|---|------|------|------|
| H-01 | 72 个路由未使用统一 handler | `app/api/` 多处 | 认证/错误处理/日志不一致 |
| H-02 | 错误信息泄露 | `image/route.ts:324`, `sora/route.ts:561`, `register/route.ts:72` | catch 块直接返回 error.message |
| H-03 | Webhook 无签名验证 | `app/api/webhook/kie/route.ts:15-57` | KIE-AI webhook 可被伪造 |
| H-04 | 调试端点保护不足 | `app/api/debug/quota/route.ts:84-86` | 仅依赖环境变量，未强制 admin 角色 |
| H-05 | 密码修改逻辑漏洞 | `app/api/user/password/route.ts:20-31` | 不提供 currentPassword 可直接修改 |
| H-06 | 122 处 `as any` 类型断言 | 所有 db-*.ts 文件 | 运行时类型错误风险 |
| H-07 | 数据库迁移无版本控制 | `db.ts:492-1032` | try-catch 静默处理，无法确定当前版本 |
| H-08 | 事务嵌套不支持 | `db-adapter.ts:51` | 嵌套调用直接抛错 |
| H-09 | 连接池无健康检查 | `db-connection.ts:8-14` | 连接失败后永不重置 |
| H-10 | create/page.tsx 1181 行 | `app/(dashboard)/create/page.tsx` | 30+ state 变量，严重违反 SRP |
| H-11 | workspace-store 649 行 | `lib/stores/workspace-store.ts` | 单 store 承担 episodes+assets+UI |
| H-12 | middleware 未实现路由保护 | `middleware.ts` | /admin 页面可直接访问 |

#### 🟡 MEDIUM（18 项）— 部署后迭代修复

| # | 问题 | 位置 | 描述 |
|---|------|------|------|
| M-01 | 生产环境 console.log 60+ 处 | `app/api/**`, `lib/**` | 敏感信息泄露风险 |
| M-02 | 健康检查暴露数据库错误 | `app/api/health/route.ts:6-24` | 公开端点返回详细错误 |
| M-03 | 缺少输入验证库 | 全局 | 手动验证易遗漏 |
| M-04 | JSON 解析错误处理不一致 | `projects/route.ts:76`, `assets/route.ts:74` | 部分用 .catch，部分直接 await |
| M-05 | 空 catch 块吞噬错误 | `db-codes.ts:57`, `task-scheduler.ts:50,59,96,134` | 索引创建失败无感知 |
| M-06 | SQLite 外键约束被移除 | `db-adapter.ts:175` | 数据一致性风险 |
| M-07 | MySQL queueLimit=0 | `db-adapter.ts:23` | 无限排队可能 OOM |
| M-08 | 查询结果映射代码重复 | `db-codes.ts:290-300` 与 `455-465` | 完全相同的 11 行代码 |
| M-09 | LIMIT/OFFSET 验证重复 15 处 | 所有 db-*.ts | 应提取为公共函数 |
| M-10 | 23 个组件重复 fetch 模式 | `components/` 多处 | 缺少统一 API 客户端 |
| M-11 | 30+ 处重复 toast 调用 | `components/` 多处 | 缺少语义化 toast 辅助函数 |
| M-12 | 3 种日期格式化实现 | `utils.ts`, `project-list.tsx:46`, `result-gallery.tsx` | 应统一使用 lib/utils |
| M-13 | 缺少 useCallback | `create/page.tsx` | 子组件不必要重渲染 |
| M-14 | 大列表未虚拟化 | `result-gallery.tsx` | 100+ 项时 DOM 节点过多 |
| M-15 | 多处使用原生 `<img>` | 多个组件 | 未利用 next/image 优化 |
| M-16 | 客户端组件过多 | 20+ 页面 `'use client'` | 可改为服务端组件减少 JS |
| M-17 | 缺少 Docker 健康检查 | `Dockerfile`, `docker-compose.yml` | 容器编排无法感知服务状态 |
| M-18 | NEXTAUTH_SECRET 容器重启后变化 | `docker-entrypoint.sh:4-9` | 所有 session 失效 |

#### 🟢 LOW（8 项）— 持续改进

| # | 问题 | 位置 | 描述 |
|---|------|------|------|
| L-01 | 缺少 CORS 配置 | `next.config.js` | 如需跨域需添加 |
| L-02 | 调试日志过多 | `announcement/route.ts:15-19` | 公开端点含详细日志 |
| L-03 | 魔法数字 | `create/page.tsx:441,641`, `result-gallery.tsx:39,67` | 15MB、12 等未命名 |
| L-04 | TODO/FIXME 未清理 | `suchuang-api.ts:107` | 未实现的功能标记 |
| L-05 | 不一致的命名风格 | 多处 | isLoading vs loading, handleClick vs onClick |
| L-06 | UUID 碰撞处理不一致 | `db-codes.ts` 有重试, `db-comic.ts` 无 | 策略不统一 |
| L-07 | 缓存模块已导入未使用 | `db.ts:8` | 频繁查询缺少缓存 |
| L-08 | 环境变量名不一致 | `.env.example` vs `docker-compose.yml` | MYSQL_DATABASE vs MYSQL_NAME |

---

## 4. 测试计划

### Phase 1: 安全修复与验证（P0 — 阻塞部署）

#### 4.1.1 安全漏洞修复验证

| 测试项 | 验证方法 | 通过标准 |
|--------|----------|----------|
| C-01: error.stack 不泄露 | 触发 API 500 错误，检查响应体 | 生产模式下响应不含 stack trace |
| C-04: 密钥不硬编码 | 检查 docker-compose.yml | 所有密钥通过 .env 或 Docker secrets 注入 |
| H-03: Webhook 签名验证 | 发送伪造 webhook 请求 | 无有效签名的请求返回 401 |
| H-04: 调试端点保护 | 非 admin 用户访问 /api/debug/* | 返回 403 |
| H-05: 密码修改需验证 | 不提供 currentPassword 修改密码 | 返回 400 错误 |
| H-12: 管理页面保护 | 未登录访问 /admin/* | 重定向到登录页 |

#### 4.1.2 API 路由统一化验证

| 测试项 | 验证方法 | 通过标准 |
|--------|----------|----------|
| H-01: 统一 handler | 扫描所有 route.ts | 需认证路由 100% 使用 createHandler/authHandler |
| H-02: 错误响应格式 | 触发各路由错误 | 所有错误响应格式为 `{ error: string }` |
| HC-03: 响应格式统一 | 检查所有成功响应 | 格式为 `{ success: true, data: T }` |

### Phase 2: 核心路径单元测试（P1 — 目标覆盖率 60%）

#### 4.2.1 数据库层测试 (`lib/__tests__/db*.test.ts`)

```
测试文件规划:
├── lib/__tests__/db.test.ts              # 用户 CRUD、系统配置、生成记录
├── lib/__tests__/db-comic.test.ts        # 项目/剧集/素材 CRUD
├── lib/__tests__/db-agent.test.ts        # Agent CRUD、版本控制、乐观锁
├── lib/__tests__/db-llm.test.ts          # LLM 模型/绑定 CRUD
├── lib/__tests__/db-codes.test.ts        # 邀请码/卡密 CRUD
└── lib/__tests__/db-adapter.test.ts      # SQLite/MySQL 适配器
```

关键测试场景:
- C-02: LIMIT/OFFSET 参数化查询（修复后验证）
- C-03: NULL/undefined 输入边界
- H-06: 类型安全（移除 as any 后验证）
- H-07: 数据库迁移版本控制
- H-08: 事务嵌套处理
- H-09: 连接池健康检查
- M-05: 错误不被静默吞噬

#### 4.2.2 API 认证/权限测试 (`app/api/__tests__/`)

```
测试文件规划:
├── app/api/__tests__/api-handler.test.ts  # createHandler/adminHandler/authHandler
├── app/api/__tests__/rate-limit.test.ts   # 速率限制
└── app/api/__tests__/auth-flow.test.ts    # 登录/注册/密码修改
```

关键测试场景:
- 未登录访问需认证路由 → 401
- 普通用户访问 admin 路由 → 403
- 速率限制触发 → 429 + Retry-After 头
- 密码修改需 currentPassword 验证

#### 4.2.3 核心业务逻辑测试

```
测试文件规划:
├── lib/__tests__/image-generator.test.ts   # 图像生成入口
├── lib/__tests__/video-generator.test.ts   # 视频生成入口
├── lib/__tests__/llm-client.test.ts        # LLM 调用客户端
├── lib/__tests__/prompt-service.test.ts    # 提示词模板
├── lib/__tests__/task-scheduler.test.ts    # 任务调度
└── lib/__tests__/rate-limit.test.ts        # 速率限制
```

### Phase 3: 代码质量修复（P2 — 部署后迭代）

#### 4.3.1 屎山代码重构清单

| 重构项 | 当前状态 | 目标状态 | 验证方法 |
|--------|----------|----------|----------|
| H-10: create/page.tsx | 1181 行, 30+ state | 拆分为 5 个组件, 各 <300 行 | 行数统计 + 功能回归 |
| H-11: workspace-store | 649 行, 18 字段 | 拆分为 3 个 store | 行数统计 + 状态同步测试 |
| M-08: 查询映射重复 | 2 处完全相同代码 | 提取 mapInviteCode() | grep 重复代码 = 0 |
| M-09: LIMIT/OFFSET 重复 | 15 处相同验证 | 提取 normalizePagination() | grep 重复代码 = 0 |
| M-10: fetch 模式重复 | 23 个组件 | 创建 lib/api-client.ts | 组件内无裸 fetch |
| M-11: toast 重复 | 30+ 处 | 创建 toastSuccess/toastError | 组件内无裸 toast |
| M-12: 日期格式化重复 | 3 种实现 | 统一使用 lib/utils | grep 重复实现 = 0 |

#### 4.3.2 类型安全提升

| 修复项 | 当前状态 | 目标状态 | 验证方法 |
|--------|----------|----------|----------|
| H-06: as any | 122 处 | <10 处 | grep "as any" 计数 |
| affectedRows 访问 | 3 种模式 | 统一 getAffectedRows() | grep 不同模式 = 0 |
| API 响应类型 | 无类型 | 定义 ApiResponse<T> | TypeScript 编译通过 |

### Phase 4: 预部署检查（P0 — 阻塞部署）

#### 4.4.1 构建验证

| 检查项 | 命令 | 通过标准 |
|--------|------|----------|
| TypeScript 编译 | `npx tsc --noEmit` | 0 errors |
| ESLint 检查 | `npm run lint` | 0 errors (warnings 可接受) |
| 生产构建 | `npm run build` | 构建成功，无错误 |
| 单元测试 | `npm run test` | 所有测试通过 |
| 依赖漏洞 | `npm audit --production` | 无 critical/high 漏洞 |

#### 4.4.2 Docker 部署验证

| 检查项 | 命令/方法 | 通过标准 |
|--------|-----------|----------|
| Docker 构建 | `docker-compose build` | 构建成功 |
| 容器启动 | `docker-compose up -d` | 容器状态 healthy |
| 健康检查 | `curl http://localhost:3000/api/health` | 返回 `{ status: "ok" }` |
| 数据持久化 | 重启容器后检查数据 | 数据不丢失 |
| 环境变量 | 检查 .env 注入 | 无硬编码密钥 |
| 日志输出 | `docker-compose logs` | 无敏感信息泄露 |

#### 4.4.3 功能冒烟测试

| 功能 | 测试步骤 | 通过标准 |
|------|----------|----------|
| 用户注册 | 注册新用户 → 登录 | 成功登录，积分正确 |
| 图像生成 | 提交图像生成请求 | 返回生成结果或任务 ID |
| 视频生成 | 提交 Sora 视频请求 | 返回任务 ID，轮询可获取状态 |
| 项目管理 | 创建/编辑/删除项目 | CRUD 操作正常 |
| 剧集管理 | 创建/编辑剧集 | 分镜保存正确 |
| 素材管理 | 上传/生成/导出素材 | 文件存储正确 |
| 管理后台 | 用户管理/模型配置 | 管理操作正常 |
| 积分系统 | 生成消耗积分 | 积分扣减正确 |

---

## 5. 执行顺序与依赖关系

```
Phase 1 (安全修复) ──┐
                     ├──→ Phase 4 (预部署检查) ──→ 🚀 部署
Phase 2 (单元测试) ──┘

Phase 3 (代码质量) ──→ 部署后持续迭代
```

**关键路径**: Phase 1 + Phase 4 是部署阻塞项
**并行路径**: Phase 2 可与 Phase 1 并行进行
**后续路径**: Phase 3 在部署后持续迭代

---

## 6. 成功判据（可验证）

| 判据 | 验证命令/方法 | 状态 |
|------|---------------|------|
| 所有 CRITICAL 问题已修复 | 逐项验证 C-01 ~ C-05 | ⬜ |
| 所有 HIGH 安全问题已修复 | 逐项验证 H-03 ~ H-05, H-12 | ⬜ |
| 72 个路由迁移到统一 handler | `grep -r "export.*function.*GET\|POST\|PUT\|DELETE" app/api/ --include="route.ts"` | ⬜ |
| 核心路径测试覆盖率 ≥ 60% | `npm run test:coverage` | ⬜ |
| `npm run build` 成功 | 构建日志无 error | ⬜ |
| `docker-compose up` 成功 | 容器状态 healthy | ⬜ |
| 冒烟测试全部通过 | 8 项功能测试 | ⬜ |
| 生产日志无敏感信息 | 检查 docker logs | ⬜ |
| `npm audit` 无 critical 漏洞 | 审计报告 | ⬜ |

---

## 7. 你没考虑到但我补充的方面

| 方面 | 说明 | 优先级 |
|------|------|--------|
| 数据库迁移版本控制 | 当前用 try-catch 静默处理 ALTER TABLE，无法追踪版本 | HIGH |
| 连接池健康检查 | 数据库连接失败后永不重置，需重启服务 | HIGH |
| 事务嵌套处理 | 嵌套事务直接抛错，业务逻辑可能触发 | HIGH |
| 速率限制持久化 | 基于内存，重启后丢失，分布式部署无法共享 | MEDIUM |
| 结构化日志 | 当前 console.log 混乱，生产环境难以排查问题 | MEDIUM |
| 错误追踪集成 | 无 Sentry 等工具，生产错误无法主动感知 | MEDIUM |
| CSP 安全头 | 缺少 Content-Security-Policy，XSS 防护不完整 | MEDIUM |
| 请求追踪 ID | 无 requestId，跨服务日志无法关联 | LOW |
| 数据库备份策略 | 无定时备份，数据丢失风险 | MEDIUM |
| Bundle 分析 | 无 bundle-analyzer，首屏加载可能过大 | LOW |
