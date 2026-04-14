# Gateway API 设计

## 1. API 概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/collect` | POST | 数据采集入口 |
| `/api/v1/health` | GET | 健康检查 |
| `/api/v1/stats` | GET | 统计信息（可选） |

## 2. 数据采集接口

### 2.1 请求

**端点**: `POST /api/v1/collect`

**Content-Type**: `application/json`

**Payload Schema**:

```typescript
interface CollectPayload {
  // 必填字段
  title: string;       // 文章标题
  url: string;         // 来源 URL（用于去重和溯源）
  content: string;     // 内容主体（HTML 或 Markdown）
  
  // 可选字段
  source?: string;     // 来源标识，默认 'others'
                       // 对应 raw/ 下的子目录：github, twitter, bookmarks 等
  format?: 'markdown' | 'html';  // 内容格式，默认 'markdown'
                                  // markdown: 直接存储
                                  // html: 经过 Readability 清洗后转为 Markdown
  tags?: string[];     // 标签
  author?: string;     // 作者
  collected_at?: number; // 采集时间（毫秒时间戳），不传则使用当前时间
}
```

**字段说明**:

| 字段 | 必填 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| `title` | ✅ | string | - | 文章标题，用于生成文件名和 frontmatter |
| `url` | ✅ | string | - | 来源 URL，规范化后用于去重 |
| `content` | ✅ | string | - | 内容主体 |
| `source` | ❌ | string | `'others'` | 来源标识，决定存储目录 |
| `format` | ❌ | enum | `'markdown'` | 内容格式，决定是否清洗 |
| `tags` | ❌ | string[] | `[]` | 标签，写入 frontmatter |
| `author` | ❌ | string | - | 作者，写入 frontmatter |
| `collected_at` | ❌ | number | - | 采集时间（毫秒时间戳），不传则使用当前时间 |

### 2.2 响应

**成功创建** (201 Created):
```json
{
  "success": true,
  "action": "created",
  "path": "raw/github/2026-04-13/example-repo.md",
  "url": "https://github.com/example/repo"
}
```

**去重跳过** (200 OK):
```json
{
  "success": true,
  "action": "skipped",
  "message": "URL already collected",
  "url": "https://github.com/example/repo"
}
```

**参数错误** (400 Bad Request):
```json
{
  "success": false,
  "error": "Missing required field: title"
}
```

**服务器错误** (500 Internal Server Error):
```json
{
  "success": false,
  "error": "Failed to write file"
}
```

### 2.3 处理流程

```text
收到请求
    │
    ▼
验证必填字段（title, url, content）
    │
    ├── 缺失 → 400 Bad Request
    │
    ▼
URL 规范化
    │
    ▼
查询去重数据库
    │
    ├── 已存在 → 200 OK (skipped)
    │
    ▼
判断 format
    │
    ├── format=html → Readability + Turndown
    │
    ▼
生成 Markdown 文件（含 frontmatter）
    │
    ▼
写入 raw/{source}/{date}/{slug}.md
    │
    ▼
记录到去重数据库
    │
    ▼
触发 QMD 索引（debounce）
    │
    ▼
201 Created
```

## 3. Markdown 文件格式

### 3.1 文件路径

```
raw/{source}/{date}/{slug}.md
```

示例：
```
raw/github/2026-04-13/in-my-mind.md
raw/bookmarks/2026-04-13/understanding-react-server-components.md
```

### 3.2 Slug 生成规则

1. 从 `title` 生成
2. 转为小写
3. 移除特殊字符
4. 空格/下划线转为连字符
5. 截断至 50 字符
6. 若冲突，追加序号 `-1`, `-2` 等

### 3.3 文件内容

```markdown
---
title: "文章标题"
url: "https://example.com/article"
source: "bookmarks"
tags:
  - tag1
  - tag2
author: "作者名"
collectedAt: "2026-04-13T12:00:00Z"
---

文章正文内容...
```

## 4. 健康检查接口

### 4.1 请求

**端点**: `GET /api/v1/health`

### 4.2 响应

```json
{
  "status": "ok",
  "timestamp": "2026-04-13T12:00:00Z",
  "version": "1.0.0"
}
```

## 5. 统计信息接口（可选）

### 5.1 请求

**端点**: `GET /api/v1/stats`

### 5.2 响应

```json
{
  "total": 1234,
  "bySource": {
    "github": 456,
    "twitter": 321,
    "bookmarks": 234,
    "others": 223
  },
  "lastCollected": "2026-04-13T11:30:00Z"
}
```

## 6. 请求示例

### 6.1 浏览器插件采集网页

```bash
curl -X POST http://localhost:3020/api/v1/collect \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Understanding React Server Components",
    "url": "https://example.com/blog/react-server-components",
    "content": "<html>...",
    "source": "bookmarks",
    "format": "html",
    "tags": ["react", "frontend"]
  }'
```

### 6.2 Python Collector 采集 GitHub Star

```bash
curl -X POST http://localhost:3020/api/v1/collect \
  -H "Content-Type: application/json" \
  -d '{
    "title": "alienzhou/in-my-mind",
    "url": "https://github.com/alienzhou/in-my-mind",
    "content": "# in-my-mind\n\nPersonal knowledge base...",
    "source": "github",
    "format": "markdown",
    "collected_at": 1744274200000
  }'
```

> 注：`collected_at` 使用 GitHub API 返回的 `starred_at` 时间戳（毫秒）。

### 6.3 最简请求

```bash
curl -X POST http://localhost:3020/api/v1/collect \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Article",
    "url": "https://example.com/test",
    "content": "# Test\n\nThis is a test."
  }'
```

## 7. URL 规范化规则

### 7.1 通用规则

1. `scheme` 和 `netloc` 转换为小写
2. 移除路径末尾的斜杠 (`/`)
3. 移除追踪参数：`utm_*`, `ref`, `source`, `spm`, `from` 等
4. 移除锚点片段 (`#fragment`)
5. 查询参数按字母排序

### 7.2 平台特定规则

| 平台 | 规则 |
|------|------|
| Twitter/X | `x.com` → `twitter.com` |
| GitHub | 移除 `/tree/main`、`/tree/master` |
| 知乎 | 移除 `?utm_*` 参数 |
| 小红书 | 保留 `xhslink.com` 短链（暂不展开） |

## 8. 错误处理

| HTTP 状态码 | 场景 | 说明 |
|-------------|------|------|
| 200 | 去重跳过 | URL 已采集，action=skipped |
| 201 | 创建成功 | 新文档已写入，action=created |
| 400 | 参数错误 | 缺少必填字段或格式错误 |
| 500 | 服务器错误 | 写入失败、数据库错误等 |
