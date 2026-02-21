[根目录](../../../../CLAUDE.md) > [app](../../../) > [api](../../) > **generate**

# 生成 API 模块

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-06 | 1.0.0 | 初始化模块文档 |

---

## 模块职责

AI 内容生成的核心 API 模块，提供图像生成、视频生成、角色卡创建等功能的后端接口。采用异步任务模式，支持后台处理和状态轮询。

---

## 入口与启动

本模块为 Next.js API 路由，通过 HTTP 请求访问：

```
POST /api/generate/image         # 图像生成
POST /api/generate/sora          # Sora 视频生成
POST /api/generate/sora-image    # Sora 图像生成
POST /api/generate/character-card # 角色卡创建（base64 视频）
POST /api/generate/character-card/from-url   # 角色卡创建（URL）
POST /api/generate/character-card/from-task  # 角色卡创建（任务ID）
GET  /api/generate/status/[id]   # 查询任务状态
```

---

## 对外接口

### 1. 图像生成 (`/api/generate/image`)

**请求体**:
```typescript
{
  modelId: string;           // 必填，图像模型 ID
  prompt?: string;           // 提示词
  aspectRatio?: string;      // 宽高比
  imageSize?: string;        // 图像尺寸
  images?: Array<{ mimeType: string; data: string }>;  // 参考图（base64）
  referenceImages?: string[];  // 参考图 URL 数组
  referenceImageUrl?: string;  // 单个参考图 URL
}
```

**响应**:
```typescript
{
  success: true,
  data: {
    id: string;        // 任务 ID
    status: 'pending';
    message: string;
  }
}
```

### 2. Sora 视频生成 (`/api/generate/sora`)

**请求体**:
```typescript
{
  modelId?: string;          // 视频模型 ID
  channelId?: string;        // 渠道 ID（自动选择模型）
  prompt?: string;           // 提示词
  aspectRatio?: string;      // 宽高比
  duration?: string;         // 时长（如 "10s"）
  files?: Array<{ mimeType: string; data: string }>;  // 参考图
  referenceImageUrl?: string;
  style_id?: string;         // 风格 ID
  remix_target_id?: string;  // 混剪目标 ID
}
```

### 3. Sora 图像生成 (`/api/generate/sora-image`)

**请求体**:
```typescript
{
  prompt: string;            // 必填
  model?: string;            // 默认 'sora-image'
  size?: string;             // 图像尺寸
  input_image?: string;      // 参考图 base64
  referenceImageUrl?: string;
}
```

### 4. 角色卡创建 (`/api/generate/character-card`)

**请求体**:
```typescript
{
  videoBase64: string;       // 必填，视频 base64
  firstFrameBase64: string;  // 视频首帧
  username?: string;         // 角色用户名
  displayName?: string;      // 显示名称
  instructionSet?: string;   // 指令集
  timestamps?: string;       // 时间戳（如 "0,3"）
}
```

### 5. 角色卡创建 - URL 方式 (`/api/generate/character-card/from-url`)

**请求体**:
```typescript
{
  videoUrl: string;          // 必填，视频 URL
  timestamps: string;        // 必填，时间范围（1-3秒）
  firstFrameBase64?: string; // 首帧图片
}
```

### 6. 角色卡创建 - 任务方式 (`/api/generate/character-card/from-task`)

**请求体**:
```typescript
{
  generationId: string;      // 必填，视频生成任务 ID
  timestamps: string;        // 必填，时间范围
}
```

### 7. 任务状态查询 (`/api/generate/status/[id]`)

**响应**:
```typescript
{
  success: true,
  data: {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    type: string;
    url: string;             // 媒体 URL（可能是代理 URL）
    cost: number;
    progress: number;        // 0-100
    errorMessage?: string;
    params: object;
    createdAt: number;
    updatedAt: number;
  }
}
```

---

## 关键依赖与配置

### 内部依赖

| 模块 | 用途 |
|------|------|
| `@/lib/auth` | NextAuth 认证 |
| `@/lib/db` | 数据库操作 |
| `@/lib/image-generator` | 统一图像生成 |
| `@/lib/video-generator` | 统一视频生成 |
| `@/lib/sora-api` | Sora API 封装 |
| `@/lib/rate-limit` | 速率限制 |
| `@/lib/safe-fetch` | 安全外部请求 |
| `@/lib/media-storage` | 媒体存储 |
| `@/lib/picui` | PicUI 图床 |
| `@/lib/imgbed` | 图床配置 |

### 路由配置

```typescript
export const maxDuration = 60;  // 图像/视频 API
export const maxDuration = 300; // 角色卡 API（5分钟）
export const dynamic = 'force-dynamic';
```

---

## 核心流程

### 异步任务处理模式

```
1. 请求验证（认证、速率限制、参数校验）
2. 余额检查与预扣费
3. 创建生成记录（status: pending）
4. 启动后台任务（不等待）
5. 立即返回任务 ID
6. 后台任务完成后更新状态
7. 失败时自动退款
```

### 速率限制重试（视频生成）

```typescript
// 支持 429 错误自动重试
const retryConfig = {
  enabled: true,
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  jitterRatio: 0.25,
  maxElapsedMs: 60000
};
```

---

## 数据模型

### Generation 记录

```typescript
{
  id: string;
  userId: string;
  type: 'gemini-image' | 'sora-image' | 'sora-video' | ...;
  prompt: string;
  params: object;
  resultUrl: string;
  cost: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  balancePrecharged: boolean;
  balanceRefunded: boolean;
}
```

### CharacterCard 记录

```typescript
{
  id: string;
  userId: string;
  characterName: string;
  avatarUrl: string;
  sourceVideoUrl?: string;
  status: 'processing' | 'completed' | 'failed';
}
```

---

## 错误处理

| HTTP 状态码 | 含义 |
|-------------|------|
| 400 | 参数错误 |
| 401 | 未登录 |
| 402 | 余额不足 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 状态冲突（如视频未完成） |
| 429 | 请求过于频繁 / 并发限制 |
| 500 | 服务器错误 |

---

## 测试与质量

**当前状态**: 无测试文件

**建议**:
- 单元测试：参数校验、费用计算、时间戳解析
- 集成测试：完整生成流程（mock 外部 API）
- 压力测试：并发限制、速率限制

---

## 常见问题 (FAQ)

### Q: 如何查询任务进度？

轮询 `/api/generate/status/[id]`，响应中的 `progress` 字段表示进度（0-100）。

### Q: 视频 URL 为什么是代理地址？

部分视频 URL 需要 API Key 认证，通过 `/api/media/[id]` 代理访问以保护密钥。

### Q: 角色卡创建的时间范围限制？

时间范围必须是 1-3 秒的整数区间，如 "0,3" 或 "5,7"。

### Q: 如何处理生成失败？

失败时自动退款（`refundGenerationBalance`），错误信息存储在 `errorMessage` 字段。

---

## 相关文件清单

```
app/api/generate/
  image/
    route.ts                  # 图像生成 API
  sora/
    route.ts                  # Sora 视频生成 API
  sora-image/
    route.ts                  # Sora 图像生成 API
  character-card/
    route.ts                  # 角色卡创建（base64）
    from-url/
      route.ts                # 角色卡创建（URL）
    from-task/
      route.ts                # 角色卡创建（任务ID）
  status/
    [id]/
      route.ts                # 任务状态查询
```
