# 架构设计与技术规范

这份文档描述了 `in-my-mind` 外置知识库的整体架构、数据流以及各组件的技术规范。

## 1. 核心理念与定位

`in-my-mind` 是一个个人外置知识库项目，用于：
- **采集**网络上收藏、点赞的各种内容（GitHub、Twitter、小红书、知乎、书签等）
- 作为原始内容（Markdown）的**存储仓库**
- 通过 **QMD (Query Markup Documents)** 提供高性能的本地全文/向量检索
- 向其他智能体（Agent）暴露搜索 **Skill**，实现跨仓库知识召回

## 2. 目录架构

项目采用"四层分离"架构设计，严格区分数据、网关、采集工具与服务接口。

```text
in-my-mind/
├── raw/                            # 1. 原始数据层
│   ├── github/{date}/              # 按来源和采集日期组织
│   ├── twitter/{date}/
│   ├── xiaohongshu/{date}/
│   ├── zhihu/{date}/
│   ├── bookmarks/{date}/
│   └── others/{date}/              # 未分类来源
│
├── gateway/                        # 2. 数据网关层 (TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                # Hono HTTP 服务入口
│       ├── config.ts               # 配置管理
│       ├── routes/
│       │   ├── collect.ts          # POST /api/v1/collect
│       │   └── health.ts           # GET /api/v1/health
│       ├── services/
│       │   ├── normalize.ts        # URL 规范化
│       │   ├── dedup.ts            # 去重管理 (SQLite)
│       │   ├── cleaner.ts          # 内容清洗 (Readability + Turndown)
│       │   ├── storage.ts          # 文件存储
│       │   └── indexer.ts          # QMD 索引触发 (debounce)
│       └── types/
│           └── payload.ts          # TypeScript 类型定义
│
├── collector/                      # 3. 程序驱动采集层 (Python)
│   ├── sync.py                     # 统一调度入口
│   ├── base.py                     # Collector 抽象基类 (调用 Gateway)
│   ├── github-stars/               # GitHub Stars 采集器
│   ├── twitter/
│   ├── xiaohongshu/
│   └── zhihu/
│
├── tools/                          # 4. 用户主动采集层 (交互触发)
│   └── browser/                    # 浏览器采集方案
│       └── extension/              # 浏览器插件 (调用 Gateway)
│
├── skills/                         # 5. 接口服务层
│   └── in-my-mind-search/          # Agent 搜索 Skill
│       └── SKILL.md
│
├── specs/                          # 6. 技术规格文档
│   └── gateway/                    # Gateway 模块规格
│
├── data/                           # 本地状态数据
│   └── dedup.sqlite                # 去重数据库 (需入 Git)
│
├── bin/
│   └── imm                         # 统一的 CLI 命令包装器
│
└── ARCHITECTURE.md
```

## 3. 核心机制设计

### 3.1 Gateway 统一入口

**Gateway** 是所有数据采集的**唯一写入入口**，所有采集源（浏览器插件、Python Collector、外部 API）都通过 HTTP 接口提交数据。

**技术栈**：TypeScript + Hono + better-sqlite3 + @mozilla/readability + turndown

**端口**：3020（固定）

**启动方式**：
```bash
./bin/imm gateway        # 生产模式
cd gateway && pnpm dev   # 开发模式
```

**核心流程**：
```text
采集源 (插件/Collector/API)
       │
       │ POST /api/v1/collect
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Gateway (TypeScript)                     │
│  normalize → dedup → cleaner → storage → indexer (debounce) │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
raw/{source}/{date}/{file}.md
```

详细设计见：[specs/gateway/](./specs/gateway/)

### 3.2 索引与组织方式

- **检索引擎**: QMD (本地 GGUF 向量化 + SQLite FTS5)
- **Index 名称**: `in-my-mind`（存储于 `~/.cache/qmd/in-my-mind.sqlite`）
- **Collection 映射**: `raw/` 下的每个子目录（如 `raw/github`）映射为一个独立的 Collection
- **索引触发**: Gateway 写入后 debounce 60 秒批量触发 `qmd update && qmd embed`

**Collection 初始化**：
```bash
qmd --index in-my-mind collection add github      ./raw/github      --pattern '**/*.md'
qmd --index in-my-mind collection add twitter     ./raw/twitter     --pattern '**/*.md'
qmd --index in-my-mind collection add bookmarks   ./raw/bookmarks   --pattern '**/*.md'
qmd --index in-my-mind collection add zhihu       ./raw/zhihu       --pattern '**/*.md'
qmd --index in-my-mind collection add xiaohongshu ./raw/xiaohongshu --pattern '**/*.md'
qmd --index in-my-mind collection add others      ./raw/others      --pattern '**/*.md'
```

### 3.3 去重机制 (Deduplication)

为了防止重复采集，建立基于 SQLite 的本地去重机制：
- **唯一标识**: 规范化后的内容 URL
- **存储位置**: `data/dedup.sqlite`，该文件**提交至 Git**，以实现多设备间的去重状态共享
- **管理位置**: Gateway（TypeScript）负责去重逻辑
- **更新策略**: "忽略更新"原则，内容只采集一次

**Schema 设计**:
```sql
CREATE TABLE collected_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,           -- 规范化后的 URL
    collection TEXT NOT NULL,           -- 来源类型 (如 'github')
    file_path TEXT,                     -- 落地的 Markdown 文件路径
    collected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_url ON collected_items(url);
CREATE INDEX idx_collection ON collected_items(collection);
```

### 3.4 URL 规范化 (Normalization)

入库去重前的关键步骤，保证同一内容的不同链接形式能被准确识别：
1. `scheme` 和 `netloc` 转换为小写
2. 移除路径末尾的斜杠 (`/`)
3. 移除常见的追踪参数 (`utm_*`, `ref`, `source`, `spm` 等)
4. 移除锚点片段 (`#fragment`)
5. 查询参数排序
6. **平台特定规则**: 如 `x.com` 转为 `twitter.com`，GitHub 移除 `/tree/main` 路由等

### 3.5 采集器接口规范 (Collector API)

`collector/` 目录下的 Python 采集器通过 HTTP 调用 Gateway：

```python
class BaseCollector(ABC):
    GATEWAY_URL = "http://localhost:3020/api/v1/collect"
    
    @property
    @abstractmethod
    def name(self) -> str:
        """返回采集器标识，需与 raw/ 下目录名一致"""
        pass
    
    def _send_to_gateway(self, payload: dict) -> bool:
        """发送数据到 Gateway"""
        resp = requests.post(self.GATEWAY_URL, json=payload)
        return resp.status_code in (200, 201)
    
    @abstractmethod
    def sync(self, since: date | None = None) -> int:
        """
        执行采集逻辑
        - 调用平台 API 获取数据
        - 组装 Payload
        - 调用 _send_to_gateway() 发送
        Returns: 本次新增采集数量
        """
        pass
```

### 3.6 Gateway Payload 规范

所有采集源提交到 Gateway 的数据格式：

```typescript
interface CollectPayload {
  // 必填
  title: string;                        // 文章标题
  url: string;                          // 来源 URL（用于去重）
  content: string;                      // 内容主体
  
  // 可选
  source?: string;                      // 来源标识，默认 'others'
  format?: 'markdown' | 'html';         // 内容格式，默认 'markdown'
  tags?: string[];                      // 标签
  author?: string;                      // 作者
}
```

## 4. 数据流 (Data Flow)

### 4.1 程序驱动采集 (如 GitHub Star)

```text
定时任务 / 执行 ./bin/imm sync github
       │
       ▼
调用 GitHub API 获取 Stars 列表
       │
       ▼
组装 Payload (title, url, content, source='github')
       │
       ▼
POST to Gateway (localhost:3020/api/v1/collect)
       │
       ▼
Gateway: URL 规范化 → 去重检查 → 写入 raw/ → 触发索引
```

### 4.2 用户主动采集 (浏览器书签)

```text
用户在浏览器点击插件 "采集"
       │
       ▼
插件提取页面信息 (title, url, HTML content)
       │
       ▼
POST to Gateway (source='bookmarks', format='html')
       │
       ▼
Gateway: Readability 清洗 → Turndown 转 Markdown → 写入 → 索引
```

## 5. 未来演进方向 (Future Optimizations)

*注：受 Garry Tan 的 GBrain 项目启发，以下特性作为远期规划，当前阶段不实现。*

1. **Compiled Truth + Timeline 结构**:
   - 现阶段：直接存储抓取的网页原文/README
   - 未来：引入 LLM 预处理流程。Markdown 顶部存储 "Compiled Truth"（最佳理解摘要），底部存储 "Timeline"（追加抓取记录和后续遇到的相关事件），使知识具备"复利"属性。
   
2. **Fat Skills (Skillpack) 理念**:
   - 在 `skills/in-my-mind-search/` 中编写极其详尽的 Agent 操作手册（Playbook），指导跨仓库的 Agent 在遇到不同场景时，如何最优地搜索该库、何时写入更新。

3. **Recipes 模式接入**:
   - 将各个平台数据源的 Token 获取、配置测试等流程写成结构化的 Markdown 指南，让 Agent 能够看懂并自动修复采集环境。

4. **夜间梦境循环 (Dream Cycle)**:
   - 设立定时任务，在夜间自动清理孤立的 Markdown 页面、修复死链、运行大模型融合知识并执行 QMD 重新 Embed，保持知识库的"鲜活"。

## 6. 配置系统

项目采用**分层配置设计**，支持灵活的本地覆盖和环境隔离。

### 6.1 配置优先级

配置文件按以下优先级从高到低加载：

```text
.local.json/.local.yaml    ← 最高优先级，不提交 Git
config.json/config.yaml    ← 项目级配置，可提交
default.json/default.yaml  ← 默认配置，作为兜底
```

### 6.2 Gateway 配置 (TypeScript)

配置文件位于 `gateway/src/config/`：

| 文件 | 用途 | Git 状态 |
|------|------|----------|
| `default.json` | 默认配置 | ✅ 提交 |
| `config.json` | 项目级覆盖 | ✅ 可提交 |
| `.local.json` | 本地开发配置 | ❌ gitignore |

当前支持的配置项参见 [docs/CONFIG.md](./docs/CONFIG.md)。

### 6.3 Collector 配置 (Python)

配置文件位于 `collector/config/`：

| 文件 | 用途 | Git 状态 |
|------|------|----------|
| `default.yaml` | 默认配置 | ✅ 提交 |
| `config.yaml` | 项目级覆盖 | ✅ 可提交 |
| `.local.yaml` | 本地开发配置 | ❌ gitignore |

## 7. 增量采集机制

### 7.1 设计背景

在 GitHub Stars 等场景中，完整同步可能耗时较长。利用 Gateway 的去重机制，我们实现了基于 `skipped` 状态的增量采集。

### 7.2 工作原理

```text
Collector 获取 Stars（按时间排序）
       │
       ▼
发送到 Gateway
       │
       ├── 新内容 → status: "collected" → 计数 +1
       │
       └── 已存在 → status: "skipped" → 连续 skipped +1
                      │
                      ├── < threshold → 继续处理下一个
                      │
                      └── >= threshold → 认为到达上次位置，停止采集
```

### 7.3 关键参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `incrementalThreshold` | 5 | 连续 skipped 达到该值时停止 |

### 7.4 优势

- **效率提升**：无需每次遍历全量数据
- **复用去重逻辑**：不引入新的状态存储
- **容错性**：连续阈值设计可容忍少量乱序

## 8. 日志系统

### 8.1 Gateway (TypeScript)

- **日志库**: [pino](https://github.com/pinojs/pino)
- **输出路径**: `logs/gateway.log`
- **日志级别**: 通过配置文件 `logging.level` 控制

**关键日志点**：
- `[COLLECT]` 采集请求入口
- `[DEDUP]` 去重检查结果
- `[STORAGE]` 文件写入
- `[INDEXER]` 索引触发

### 8.2 Collector (Python)

- **日志库**: Python 标准库 `logging`
- **输出路径**: `logs/collector.log`
- **日志级别**: 通过配置文件 `logging.level` 控制

**关键日志点**：
- `[SYNC]` 同步开始/结束
- `[FETCH]` API 请求
- `[GATEWAY]` Gateway 调用结果
- `[INCREMENTAL]` 增量停止点

### 8.3 日志目录结构

```text
logs/
├── gateway.log      # Gateway HTTP 服务日志
├── collector.log    # Collector 同步日志
└── .gitkeep         # 保持目录存在
```

> **注意**: `logs/` 目录已加入 `.gitignore`，日志文件不提交至 Git。

## 9. 相关文档

- [docs/CONFIG.md](./docs/CONFIG.md) - 配置项详细说明
- [specs/gateway/](./specs/gateway/) - Gateway 模块技术规格
- `.discuss/` - 架构讨论记录
