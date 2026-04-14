# D02: Payload Schema 设计

**状态**: ✅ Confirmed  
**日期**: 2026-04-13  
**决策者**: zhouhongxuan

## 背景

Gateway 需要定义一个统一的 Payload 格式，供所有采集源使用。需要平衡简洁性（减少采集端负担）和完整性（保留必要元信息）。

## 决策

### 1. 请求格式

**端点**: `POST /api/v1/collect`

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
}
```

### 2. 响应格式

```typescript
// 成功创建
{
  "success": true,
  "action": "created",
  "path": "raw/github/2026-04-13/example-repo.md"
}

// 去重跳过
{
  "success": true,
  "action": "skipped",
  "message": "URL already collected"
}

// 参数错误
{
  "success": false,
  "error": "Missing required field: title"
}
```

### 3. 字段处理规则

| 字段 | 处理规则 |
|------|----------|
| `url` | 规范化后用于去重检查 |
| `source` | 未传入时默认 `others`，用于确定存储目录 |
| `format` | 未传入时默认 `markdown`；若为 `html` 则走 Readability 清洗 |
| `createdAt` | 由 Gateway 自动生成（请求接收时间） |

### 4. 风险接受

- **漏传 format 导致 HTML 原文存储**: 可接受，采集端有责任正确标识格式
- **无鉴权**: 可接受，本地服务无需安全防护

## 示例

### 浏览器插件采集网页

```json
{
  "title": "Understanding React Server Components",
  "url": "https://example.com/blog/react-server-components",
  "content": "<html>...",
  "source": "bookmarks",
  "format": "html",
  "tags": ["react", "frontend"]
}
```

### Python Collector 采集 GitHub Star

```json
{
  "title": "alienzhou/in-my-mind",
  "url": "https://github.com/alienzhou/in-my-mind",
  "content": "# in-my-mind\n\nPersonal knowledge base...",
  "source": "github",
  "format": "markdown"
}
```

## 相关决策

- [D01-gateway-architecture.md](./D01-gateway-architecture.md) - Gateway 架构设计
