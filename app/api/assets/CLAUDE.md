# Assets API 路由模块

> 面包屑: [根](../../../CLAUDE.md) > [app/api/](../) > assets/

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-20 | 1.0.0 | 初始化文档，覆盖 6 个路由文件 |

---

## 模块概述

项目素材（角色/场景/道具）的独立操作 API，提供素材详情、更新、删除、图片生成、图片上传、主图设置、生成历史和数据导出功能。

- **认证方式**: 手动调用 `getServerSession(authOptions)` 进行认证
- **权限模型**: 通过素材关联的 projectId 调用 `checkProjectAccess()` 检查
- **响应格式**: `{ success: boolean, data?: T, error?: string }`
- **路由文件数**: 6 个

---

## 目录结构

```
app/api/assets/
└── [assetId]/
    ├── route.ts               # GET 详情 / PATCH 更新 / DELETE 软删除
    ├── generate-image/
    │   └── route.ts           # POST AI 图片生成
    ├── upload-image/
    │   └── route.ts           # POST 上传图片（base64）
    ├── primary-image/
    │   └── route.ts           # PATCH 设置主图
    ├── image-history/
    │   └── route.ts           # GET 生成历史 / DELETE 删除历史
    └── export/
        └── route.ts           # GET 导出素材数据
```

---

## API 端点详细说明

### 1. 素材 CRUD

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/assets/[assetId]` | GET | 获取素材详情 + 剧集关联（occurrences，limit 500） |
| `/api/assets/[assetId]` | PATCH | 更新素材（name, description, attributes, primaryImageUrl, sortOrder） |
| `/api/assets/[assetId]` | DELETE | 软删除素材 |

### 2. 图片生成

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/assets/[assetId]/generate-image` | POST | AI 生成素材图片 |

请求参数：
- `prompt`: 可选，默认从素材信息自动构建
- `channelId`: 可选，指定渠道（触发 `selectImageModel`）
- `aspectRatio`: 可选，默认按素材类型（character→9:16, scene→16:9, prop→1:1）
- `imageSize`: 可选
- `count`: 1-4，批量生成

处理流程：
1. 速率限制检查（`RateLimitConfig.GENERATE`）
2. 并发限制检查（`checkUserConcurrencyLimit`）
3. 余额预扣（`updateUserBalance` strict 模式）
4. 创建 generation + assetGenerationHistory 记录
5. 后台异步执行图片生成（`generateImage` → `saveMediaAsync`）
6. 第一张图自动设为主图
7. 失败时自动退款（`refundGenerationBalance`）

maxDuration: 60s

### 3. 图片上传

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/assets/[assetId]/upload-image` | POST | 上传 base64 图片并设为主图 |

请求参数：
- `base64Data`: 必填，base64 编码的图片数据
- `filename`: 可选
- `mimeType`: 可选（服务端会从 magic bytes 重新检测）

### 4. 主图管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/assets/[assetId]/primary-image` | PATCH | 设置主图（historyId 或 imageUrl） |

支持两种方式：
- `historyId`: 从生成历史中选择一张设为主图
- `imageUrl`: 直接指定图片 URL（含协议安全校验）

### 5. 生成历史

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/assets/[assetId]/image-history` | GET | 获取生成历史（?limit=20, offset=0，含分页信息） |
| `/api/assets/[assetId]/image-history` | DELETE | 删除历史（body.ids 数组，最多 100 条；或 body.all=true 全部删除） |

### 6. 数据导出

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/assets/[assetId]/export` | GET | 导出素材完整数据（?includeHistory=true, includeOccurrences=true） |

导出内容：
- `asset`: 素材基本信息
- `occurrences`: 剧集关联数据（默认包含）
- `history`: 生成历史（可选，最多 200 条，超出标记 truncated）

---

## 核心依赖

| 模块 | 用途 |
|------|------|
| `lib/db-comic.ts` | 素材 CRUD、生成历史、出现记录 |
| `lib/db.ts` | 用户查询、余额操作、并发限制、模型配置 |
| `lib/image-generator.ts` | 统一图像生成入口 |
| `lib/image-model-selector.ts` | 智能模型选择 |
| `lib/upload-service.ts` | base64 图片上传（含 MIME 检测） |
| `lib/media-storage.ts` | 生成结果异步存储 |
| `lib/rate-limit.ts` | 速率限制 |
| `lib/auth.ts` | NextAuth 认证配置 |

---

## 设计模式

1. **异步生成**: 图片生成采用"先响应后处理"模式，返回 pending 状态的 task 列表
2. **余额预扣+失败退款**: 生成前扣费，失败后通过 `refundGenerationBalance` 退款
3. **批量生成**: 支持 1-4 张批量生成，逐张扣费（余额不足时部分成功）
4. **MIME 安全检测**: 上传图片时服务端从 base64 magic bytes 重新检测 MIME 类型
5. **URL 安全校验**: 设置主图时校验 URL 协议（仅允许 http/https 或相对路径）
6. **软删除**: 素材使用 `softDeleteProjectAsset`，已删除素材返回 404
