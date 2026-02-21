# Admin API 路由模块

> 面包屑: [根](../../../CLAUDE.md) > [app/api/](../) > admin/

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-20 | 1.0.0 | 初始化文档，覆盖 31 个路由文件 |

---

## 模块概述

后台管理 API 路由集合，提供用户管理、模型配置、渠道管理、Agent 管理、码券系统、系统设置等完整的管理后台接口。

- **认证方式**: 统一使用 `adminHandler` / `createHandler` 包装器（来自 `lib/api-handler.ts`），要求 `admin` 角色（部分接口支持 `moderator`）
- **响应格式**: `{ success: boolean, data?: T, error?: string }`
- **路由文件数**: 31 个

---

## 目录结构

```
app/api/admin/
├── agents/                    # Agent 管理
│   ├── route.ts               # GET 列表 / POST 创建
│   └── [featureKey]/
│       ├── route.ts           # GET 详情 / PUT 更新 / DELETE 删除
│       └── versions/
│           └── route.ts       # GET 版本历史 / POST 回滚
├── llm-models/                # LLM 模型管理
│   ├── route.ts               # GET 列表 / POST 创建
│   └── [id]/
│       └── route.ts           # GET 详情 / PUT 更新 / DELETE 删除
├── llm-prompts/
│   └── route.ts               # GET 列表 / PUT 更新 / POST 重置
├── feature-bindings/
│   └── route.ts               # GET 列表 / PUT 更新绑定
├── image-channels/
│   └── route.ts               # CRUD 图像渠道
├── image-models/
│   └── route.ts               # CRUD 图像模型
├── video-channels/
│   └── route.ts               # CRUD 视频渠道
├── video-models/
│   └── route.ts               # CRUD 视频模型
├── user-groups/               # 用户组管理
│   ├── route.ts               # CRUD 用户组
│   └── [id]/
│       ├── members/route.ts   # GET/POST/DELETE 成员管理
│       ├── channels/route.ts  # GET/PUT 渠道权限
│       └── pricing/route.ts   # GET/POST/DELETE 定价覆盖
├── users/                     # 用户管理
│   ├── route.ts               # GET 分页列表
│   ├── balance/route.ts       # POST 更新余额
│   └── [id]/route.ts          # GET 详情 / PUT 更新
├── art-styles/                # 画风管理
│   ├── route.ts               # GET 列表 / POST 创建
│   └── [id]/route.ts          # GET/PUT/DELETE 单个画风
├── invites/
│   └── route.ts               # GET/POST/DELETE 邀请码
├── redemption/
│   └── route.ts               # GET/POST/DELETE 卡密
├── sora-tokens/
│   └── route.ts               # GET 统计 / POST 批量导入 RT
├── stats/
│   └── route.ts               # GET 统计概览
├── generations/
│   └── route.ts               # GET 生成记录 / DELETE 删除
├── settings/
│   └── route.ts               # GET/POST 系统配置
├── migrate-models/
│   └── route.ts               # GET 检查 / POST 执行图像迁移
├── migrate-video-models/
│   └── route.ts               # GET 检查 / POST 执行视频迁移
├── proxy/test/
│   └── route.ts               # POST 代理连接测试
├── test-email/
│   └── route.ts               # POST SMTP 邮件测试
└── picui/clear/
    └── route.ts               # POST 清空 PicUI 图床
```

---

## API 端点详细说明

### 1. Agent 管理

| 路径 | 方法 | 说明 | 依赖 |
|------|------|------|------|
| `/api/admin/agents` | GET | 获取所有 Agent 列表 | `db-agent.getAgents` |
| `/api/admin/agents` | POST | 创建新 Agent（需 featureKey/name/config） | `db-agent.createAgent`, `agent-utils`, `prompt-service` |
| `/api/admin/agents/[featureKey]` | GET | 获取单个 Agent 详情（含 jsonSchema） | `db-agent.getAgentByKey`, `schema-registry` |
| `/api/admin/agents/[featureKey]` | PUT | 更新 Agent（支持版本控制、并发冲突检测 409） | `db-agent.updateAgent`, `prompt-service` |
| `/api/admin/agents/[featureKey]` | DELETE | 删除 Agent | `db-agent.deleteAgent` |
| `/api/admin/agents/[featureKey]/versions` | GET | 获取版本历史列表 | `db-agent.getAgentVersions` |
| `/api/admin/agents/[featureKey]/versions` | POST | 回滚到指定版本（targetVersion 正整数） | `db-agent.rollbackAgent` |

### 2. LLM 模型与提示词

| 路径 | 方法 | 说明 | 依赖 |
|------|------|------|------|
| `/api/admin/llm-models` | GET | 获取所有 LLM 模型（脱敏 apiKey） | `db-llm.getLlmModels` |
| `/api/admin/llm-models` | POST | 创建 LLM 模型（provider: gemini/openai-compatible） | `db-llm.createLlmModel` |
| `/api/admin/llm-models/[id]` | GET | 获取单个模型（脱敏） | `db-llm.getLlmModelById` |
| `/api/admin/llm-models/[id]` | PUT | 更新模型 | `db-llm.updateLlmModel` |
| `/api/admin/llm-models/[id]` | DELETE | 删除模型 | `db-llm.deleteLlmModel` |
| `/api/admin/llm-prompts` | GET | 获取所有提示词模板（脱敏 default 字段） | `db-llm.getLlmPrompts` |
| `/api/admin/llm-prompts` | PUT | 更新提示词（含模板占位符校验） | `db-llm.updateLlmPrompt`, `prompt-service.validateTemplate` |
| `/api/admin/llm-prompts` | POST | 重置提示词为默认值（action=reset） | `db-llm.resetLlmPrompt` |
| `/api/admin/feature-bindings` | GET | 获取功能绑定列表 | `db-llm.getFeatureBindings` |
| `/api/admin/feature-bindings` | PUT | 更新功能绑定（modelType: image/video/llm） | `db-llm.upsertFeatureBinding` |

### 3. 图像渠道与模型

| 路径 | 方法 | 说明 | 依赖 |
|------|------|------|------|
| `/api/admin/image-channels` | GET | 获取所有图像渠道 | `db.getImageChannels` |
| `/api/admin/image-channels` | POST | 创建渠道（name/type 必填） | `db.createImageChannel` |
| `/api/admin/image-channels` | PUT | 更新渠道（body.id 必填） | `db.updateImageChannel` |
| `/api/admin/image-channels` | DELETE | 删除渠道（?id=xxx） | `db.deleteImageChannel` |
| `/api/admin/image-models` | GET | 获取图像模型（可选 ?channelId 过滤） | `db.getImageModels` / `getImageModelsByChannel` |
| `/api/admin/image-models` | POST | 创建图像模型 | `db.createImageModel` |
| `/api/admin/image-models` | PUT | 更新图像模型 | `db.updateImageModel` |
| `/api/admin/image-models` | DELETE | 删除图像模型（?id=xxx） | `db.deleteImageModel` |

### 4. 视频渠道与模型

| 路径 | 方法 | 说明 | 依赖 |
|------|------|------|------|
| `/api/admin/video-channels` | GET/POST/PUT/DELETE | 视频渠道 CRUD（同图像渠道模式） | `db.get/create/update/deleteVideoChannel` |
| `/api/admin/video-models` | GET/POST/PUT/DELETE | 视频模型 CRUD（含 features/aspectRatios/durations） | `db.get/create/update/deleteVideoModel` |

### 5. 用户管理

| 路径 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/admin/users` | GET | 分页用户列表（?page/limit/q） | admin, moderator |
| `/api/admin/users/[id]` | GET | 用户详情 + 生成记录 + 用户组 | admin, moderator |
| `/api/admin/users/[id]` | PUT | 更新用户（密码/余额/禁用/角色/并发限制/用户组） | admin, moderator（moderator 不可改 admin） |
| `/api/admin/users/balance` | POST | 更新用户余额（userId + delta） | admin |

### 6. 用户组管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/user-groups` | GET/POST/PUT/DELETE | 用户组 CRUD |
| `/api/admin/user-groups/[id]/members` | GET | 获取组成员 |
| `/api/admin/user-groups/[id]/members` | POST | 批量添加成员（userIds 数组） |
| `/api/admin/user-groups/[id]/members` | DELETE | 移除成员（?userId=xxx） |
| `/api/admin/user-groups/[id]/channels` | GET | 获取组可见渠道 |
| `/api/admin/user-groups/[id]/channels` | PUT | 设置组可见渠道（channelIds 数组） |
| `/api/admin/user-groups/[id]/pricing` | GET | 获取组模型定价覆盖 |
| `/api/admin/user-groups/[id]/pricing` | POST | 批量设置定价（pricings 数组） |
| `/api/admin/user-groups/[id]/pricing` | DELETE | 删除定价覆盖（?modelId=xxx） |

### 7. 画风管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/art-styles` | GET | 获取画风列表 |
| `/api/admin/art-styles` | POST | 创建画风（slug/name/coverImageUrl 必填，slug 唯一） |
| `/api/admin/art-styles/[id]` | GET/PUT/DELETE | 单个画风 CRUD（slug 唯一约束检查） |

### 8. 码券系统

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/invites` | GET | 获取邀请码列表（?page/limit/showUsed） |
| `/api/admin/invites` | POST | 创建邀请码（bonusPoints/creatorBonus/expiresAt） |
| `/api/admin/invites` | DELETE | 删除邀请码（body.id） |
| `/api/admin/redemption` | GET | 获取卡密列表（?page/limit/batchId/showUsed） |
| `/api/admin/redemption` | POST | 批量创建卡密（count 1-100, points > 0） |
| `/api/admin/redemption` | DELETE | 删除卡密（body.id 或 body.batchId 批量删除） |

### 9. Sora Token 管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/sora-tokens` | GET | 获取 Sora 后台统计数据（自动刷新过期 token） |
| `/api/admin/sora-tokens` | POST | 批量导入 RT（action=import, rts 数组，RT→AT 转换后添加） |

### 10. 系统管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/settings` | GET | 获取系统配置 |
| `/api/admin/settings` | POST | 更新系统配置（含 retryConfig 校验、代理缓存清除） |
| `/api/admin/stats` | GET | 获取统计概览（?days=7-90，默认 30） |
| `/api/admin/generations` | GET | 获取生成记录（?page/limit/userId/type/status） |
| `/api/admin/generations` | DELETE | 删除生成记录（body.id） |

### 11. 工具与测试

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/proxy/test` | POST | 测试代理连接（proxyUrl → HEAD google.com） |
| `/api/admin/test-email` | POST | 测试 SMTP 邮件发送（smtp 配置对象） |
| `/api/admin/picui/clear` | POST | 清空 PicUI 图床所有图片（分页遍历删除） |

### 12. 数据迁移（一次性）

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/migrate-models` | GET | 检查图像模型迁移状态 |
| `/api/admin/migrate-models` | POST | 执行图像渠道+模型迁移（从 systemConfig 迁移到独立表） |
| `/api/admin/migrate-video-models` | GET | 检查视频模型迁移状态 |
| `/api/admin/migrate-video-models` | POST | 执行视频渠道+模型迁移 |

---

## 核心依赖

| 模块 | 用途 |
|------|------|
| `lib/api-handler.ts` | `adminHandler` / `createHandler` 统一认证+错误处理包装器 |
| `lib/api-error.ts` | `ApiError` 自定义错误类（支持 expose 控制） |
| `lib/db.ts` | 核心数据库操作（用户、渠道、模型、用户组、画风、系统配置） |
| `lib/db-llm.ts` | LLM 模型、提示词、功能绑定数据库操作 |
| `lib/db-agent.ts` | Agent CRUD、版本管理、回滚 |
| `lib/db-codes.ts` | 邀请码、卡密、统计概览、生成记录 |
| `lib/agent-utils.ts` | Agent 配置校验、prompt 编译、安全转换 |
| `lib/prompt-service.ts` | 提示词缓存管理、模板校验 |
| `lib/schema-registry.ts` | Agent JSON Schema 注册表 |
| `lib/proxy-agent.ts` | 代理 dispatcher 管理 |
| `lib/retry-config-validator.ts` | 重试配置校验与硬限制 |

---

## 设计模式

1. **统一处理器包装**: 所有路由使用 `adminHandler` 或 `createHandler` 包装，自动处理认证、错误捕获、日志
2. **API Key 脱敏**: LLM 模型返回时自动剥离 `apiKey` 字段
3. **分页标准化**: 统一 `page/limit/offset` 模式，limit 有上限保护
4. **并发冲突检测**: Agent 更新/回滚支持 409 Conflict 响应
5. **slug 唯一约束**: 画风管理同时做应用层和数据库层唯一性检查
