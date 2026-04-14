# 浏览器插件采集器技术规格

> **版本**: v1.0.0  
> **创建日期**: 2026-04-14  
> **状态**: 设计完成

---

## 1. 项目概述

### 1.1 背景

用户原本通过 X API 采集 Likes/Bookmarks，但遇到两个阻碍：
1. API 需要 OAuth 2.0 用户授权（User Context Token）
2. 免费额度（credits）已用完，付费订阅 $100/月起

因此探索浏览器插件方案作为替代，实现无 API 依赖的内容采集。

### 1.2 项目定位

**通用网页收藏器 + X 增强**

| 功能类型 | 描述 | 存储位置 |
|---------|------|---------|
| X 增强 | 监听 Like/Bookmark 自动采集 | `raw/x/` |
| 通用采集 | 任意网页一键采集 | `raw/bookmarks/` |

### 1.3 核心价值

- **零成本**：无需 API 付费订阅
- **实时性**：用户操作即触发采集
- **通用性**：不限于 X 平台

---

## 2. 架构设计

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Extension                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Content Script │  │   Popup/UI      │  │  Background │ │
│  │   (X 增强)       │  │   (通用采集)     │  │  Service    │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                    │                   │        │
│           └────────────────────┼───────────────────┘        │
│                                │                            │
└────────────────────────────────┼────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Gateway Server       │
                    │   POST /api/v1/collect │
                    └────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Storage              │
                    │   raw/x/ | raw/bookmarks/│
                    └────────────────────────┘
```

### 2.2 数据流

```
用户操作 (Like/Bookmark/点击采集按钮)
    │
    ▼
Content Script / UI 捕获事件
    │
    ▼
提取页面数据 (结构化字段 + 原始 HTML)
    │
    ▼
POST /api/v1/collect
    │
    ▼
Gateway 处理 (HTML 清洗, 去重, 存储)
    │
    ▼
Toast 反馈采集结果
```

---

## 3. 模块设计

### 3.1 X 增强模块

#### 3.1.1 事件监听

**技术方案**: MutationObserver 监听 `data-testid` 属性变化

| 按钮类型 | 未触发状态 | 触发后状态 |
|---------|-----------|-----------|
| Like | `[data-testid="like"]` | `[data-testid="unlike"]` |
| Bookmark | `[data-testid="bookmark"]` | `[data-testid="removeBookmark"]` |

**实现要点**:
```javascript
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && 
        mutation.attributeName === 'data-testid') {
      const newValue = mutation.target.getAttribute('data-testid');
      if (newValue === 'unlike' || newValue === 'removeBookmark') {
        // 触发采集
        handleCollect(mutation.target);
      }
    }
  });
});

observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['data-testid'],
  subtree: true
});
```

#### 3.1.2 Tweet ID 提取

**方法**: 从 `a[href*="/status/"]` 链接提取

```javascript
function getTweetId(tweetElement) {
  const statusLink = tweetElement.querySelector('a[href*="/status/"]');
  if (statusLink) {
    const match = statusLink.href.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }
  return null;
}
```

#### 3.1.3 字段清单

| 字段 | 类型 | 说明 |
|------|------|------|
| `tweetId` | string | Tweet 唯一标识 |
| `tweetUrl` | string | 完整 URL |
| `author` | object | 作者信息 (handle, displayName) |
| `text` | string | 推文正文 |
| `timestamp` | string | 发布时间 |
| `mediaUrls` | string[] | 媒体链接数组 |
| `quotedTweet` | object | 引用推文 (嵌套结构) |

#### 3.1.4 长推文处理

**策略**: 用户确认式展开

```
检测到长推文 (存在 "Show more" 按钮)
    │
    ▼
在 Like/Bookmark 按钮附近弹出浮窗
"检测到长推文，是否展开完整内容？"
    │
    ├── 用户确认 → 自动点击展开 → 等待内容加载 → 采集
    │
    └── 用户取消 → 不处理
```

**技术要点**:
- 展开是异步操作，需要 MutationObserver 等待 DOM 更新
- Like 和 Bookmark 共用相同逻辑
- 浮窗位置：相对于触发按钮定位

### 3.2 通用采集模块

#### 3.2.1 UI 设计

**常驻浮窗**: 极简单按钮 (方案 A)

```
┌─────┐
│  📥 │  ← 右下角吸附
└─────┘
```

- **单击**: 采集当前页到 bookmarks
- **后续扩展**: 长按/右键展开分类选择

#### 3.2.2 采集流程

```javascript
async function collectCurrentPage() {
  const payload = {
    title: document.title,
    url: window.location.href,
    content: document.documentElement.outerHTML,
    source: 'bookmarks',
    format: 'html',
    tags: [],
    author: extractAuthor(),
    collect_type: 'manual'
  };
  
  const response = await fetch('/api/v1/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  showToast(response.ok ? '采集成功' : '采集失败');
}
```

### 3.3 UI 组件

#### 3.3.1 浮窗类型

| 类型 | 用途 | 位置 | 生命周期 |
|------|------|------|---------|
| 临时浮窗 | 长推文确认 | 按钮附近 | 操作后消失 |
| 常驻浮窗 | 快捷采集 | 右下角 | 持久显示 |

#### 3.3.2 反馈机制

- **采集成功**: Toast 提示 "✓ 已采集"
- **采集失败**: Toast 提示 "✗ 采集失败" + 错误信息

---

## 4. 接口定义

### 4.1 Gateway 集成

**接口**: `POST /api/v1/collect`

**Request Payload**:
```json
{
  "title": "Tweet 标题或网页标题",
  "url": "https://x.com/user/status/123456",
  "content": "<html>...</html>",
  "source": "x" | "bookmarks",
  "format": "html",
  "tags": ["tag1", "tag2"],
  "author": "username",
  "collect_type": "likes" | "bookmarks" | "manual"
}
```

**特性**:
- `format: 'html'` 时自动使用 Readability + Turndown 转换
- 基于 `normalizedUrl` 自动去重

### 4.2 分类存储规则

| source | collect_type | 存储路径 |
|--------|-------------|---------|
| `x` | `likes` | `raw/x/` |
| `x` | `bookmarks` | `raw/x/` |
| `bookmarks` | `manual` | `raw/bookmarks/` |

---

## 5. 设计决策 (ADR)

### ADR-001: 采用混合提取方案

**状态**: 已决定

**上下文**: 需要在"前端提取 vs 后端处理"之间选择

**决策**: 采用混合方案
- 前端提取关键字段 (text, author, id, images, timestamp 等)
- 同时保留原始 HTML 供 Gateway 深度处理

**理由**:
- 即时可用的结构化数据
- 不丢失原始信息，支持后续重新处理
- 降低对前端提取准确性的依赖

### ADR-002: MutationObserver 监听方案

**状态**: 已决定

**上下文**: 需要检测用户 Like/Bookmark 操作

**决策**: 使用 MutationObserver 监听 `data-testid` 属性变化

**备选方案**:
- 事件代理 (click 事件) - 无法可靠判断操作是否成功
- 轮询 DOM - 性能开销大

**理由**:
- X 页面使用 `data-testid` 明确标识按钮状态
- MutationObserver 是原生 API，性能优异
- 只在状态真正改变时触发，准确可靠

### ADR-003: 长推文用户确认式展开

**状态**: 已决定

**上下文**: 长推文默认折叠，需要决定如何处理

**决策**: 检测到长推文时弹窗询问用户

**备选方案**:
- 自动展开 - 可能触发大量请求，用户无感知
- 忽略 - 丢失完整内容

**理由**:
- 用户明确知道正在发生什么
- 避免意外的自动操作
- 保留获取完整内容的能力

---

## 6. 实现计划

### Phase 1: 核心功能 (MVP)

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 项目初始化 (manifest.json, 构建配置) | P0 | 待开发 |
| X Like/Bookmark 监听 | P0 | 待开发 |
| Tweet 数据提取 | P0 | 待开发 |
| Gateway 对接 | P0 | 待开发 |
| Toast 反馈 | P0 | 待开发 |

### Phase 2: 增强功能

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 长推文检测与确认浮窗 | P1 | 待开发 |
| 通用采集按钮 | P1 | 待开发 |
| 引用推文嵌套提取 | P1 | 待开发 |

### Phase 3: 体验优化

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 采集历史查看 | P2 | 待开发 |
| 分类选择扩展 | P2 | 待开发 |
| 离线队列 | P2 | 待开发 |

---

## 7. 验收检查清单

### 7.1 功能检查 (P0)

- [ ] Like 一条 Tweet 后自动触发采集
- [ ] Bookmark 一条 Tweet 后自动触发采集
- [ ] 采集数据正确存储到 `raw/x/`
- [ ] 通用采集按钮点击后正确存储到 `raw/bookmarks/`
- [ ] Toast 提示正常显示

### 7.2 边界场景 (P1)

- [ ] 长推文展开后内容完整
- [ ] 引用推文正确嵌套提取
- [ ] 重复采集正确去重
- [ ] 网络断开时的错误处理

### 7.3 兼容性检查 (P1)

- [ ] Chrome 浏览器支持
- [ ] X 页面 DOM 结构变化的兼容性
- [ ] 多语言页面支持

---

## 8. Backlog

### 8.1 功能 Backlog

- **批量导入**: 从 X 导出数据批量导入
- **多平台支持**: 扩展到其他社交平台 (Mastodon, Threads 等)
- **标签智能推荐**: 基于内容自动推荐标签

### 8.2 技术优化 Backlog

- **Service Worker**: 使用 Manifest V3 标准
- **离线支持**: IndexedDB 本地队列
- **性能监控**: 采集耗时统计

### 8.3 开放性问题

- X DOM 结构变化的长期维护策略
- 是否需要支持 Firefox/Safari
