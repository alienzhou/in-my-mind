# D06: 采集时间戳支持

## 决策

支持在 API 请求中传入采集时间戳 `collected_at`。

## 背景

目前 Gateway 在保存 Markdown 文件时自动使用当前时间作为 `collectedAt`。但对于某些数据源（如 GitHub Stars），我们有更精确的时间信息（如 `starred_at`），应该使用这些原始时间而非采集时间。

## 方案

### 字段设计

| 属性 | 值 |
|------|-----|
| 字段名 | `collected_at` |
| 类型 | `number` |
| 格式 | 毫秒时间戳 |
| 必填 | 否 |

### 处理逻辑

```typescript
// 优先使用传入的 collected_at，否则使用当前时间
const collectedAt = payload.collected_at 
  ? new Date(payload.collected_at)
  : new Date();
```

### 各数据源使用方式

| 数据源 | collected_at 取值 |
|--------|-------------------|
| GitHub Stars | `starred_at` 字段（Star 时间） |
| 浏览器书签 | `dateAdded` 字段（收藏时间） |
| 手动采集 | 不传，使用当前时间 |
| Twitter/X | `created_at` 字段（发布时间） |

## 示例

### Python Collector 发送请求

```python
import time
from datetime import datetime

# GitHub starred_at: "2026-04-10T08:30:00Z"
starred_at = datetime.fromisoformat("2026-04-10T08:30:00+00:00")
collected_at_ms = int(starred_at.timestamp() * 1000)

payload = {
    "title": "alienzhou/in-my-mind",
    "url": "https://github.com/alienzhou/in-my-mind",
    "content": "...",
    "source": "github",
    "collected_at": collected_at_ms  # 1744274200000
}
```

### Gateway 接收并处理

```typescript
// 请求: { ..., collected_at: 1744274200000 }
const collectedAt = new Date(1744274200000);
// 生成 frontmatter: collectedAt: "2026-04-10T08:30:00Z"
```

## 影响

1. **API 接口**: 新增可选字段 `collected_at`
2. **Gateway 存储逻辑**: 使用传入时间或当前时间
3. **文件日期目录**: 仍使用当前日期（采集日期），与 `collectedAt` 可能不同
4. **Collector 适配**: 需要传递原始时间戳

## 决策人

- AI Assistant (邪恶模式子会话)

## 日期

2026-04-14
