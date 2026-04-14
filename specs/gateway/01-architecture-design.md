# Gateway 架构设计

> 本文档描述 Gateway 模块的实现细节。整体系统架构见 [ARCHITECTURE.md](../../ARCHITECTURE.md)。

## 1. 模块定位

Gateway 是 `in-my-mind` 的**数据写入网关**，详见 [ARCHITECTURE.md#31-gateway-统一入口](../../ARCHITECTURE.md#31-gateway-统一入口)。

## 2. 技术选型

| 维度 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | Readability 生态原生、类型安全 |
| 框架 | Hono | 轻量、高性能、现代化 API |
| 去重存储 | SQLite (`better-sqlite3`) | 复用现有 data/dedup.sqlite |
| 内容清洗 | `@mozilla/readability` + `turndown` | 成熟的 HTML→Markdown 方案 |
| DOM 模拟 | `linkedom` | 轻量、比 jsdom 快 |

### 2.1 主要依赖

```json
{
  "dependencies": {
    "hono": "^4.x",
    "@hono/node-server": "^1.x",
    "@mozilla/readability": "^0.5.x",
    "turndown": "^7.x",
    "linkedom": "^0.18.x",
    "better-sqlite3": "^11.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "@types/better-sqlite3": "^7.x",
    "@types/turndown": "^5.x"
  }
}
```

## 3. 目录结构

```text
gateway/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Hono 服务入口
│   ├── config.ts                # 配置管理
│   ├── routes/
│   │   ├── index.ts             # 路由聚合
│   │   ├── collect.ts           # POST /api/v1/collect
│   │   └── health.ts            # GET /api/v1/health
│   ├── services/
│   │   ├── normalize.ts         # URL 规范化
│   │   ├── dedup.ts             # SQLite 去重管理
│   │   ├── cleaner.ts           # Readability + Turndown
│   │   ├── storage.ts           # 写入 raw/ 目录
│   │   └── indexer.ts           # QMD 索引（debounce）
│   ├── types/
│   │   └── payload.ts           # TypeScript 类型定义
│   └── utils/
│       └── slug.ts              # 文件名生成工具
└── dist/                        # 编译产物
```

## 4. 配置项

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| 端口 | `PORT` | `3020` | HTTP 服务端口 |
| raw 目录 | `RAW_DIR` | `../raw` | 相对于 gateway/ |
| 去重数据库 | `DEDUP_DB` | `../data/dedup.sqlite` | 相对于 gateway/ |
| QMD Index | `QMD_INDEX` | `in-my-mind` | QMD 索引名称 |
| Debounce | `DEBOUNCE_MS` | `30000` | 索引触发间隔（毫秒） |

配置优先级：环境变量 > 配置文件 > 默认值

## 5. 运行方式

### 5.1 开发模式

```bash
cd gateway && pnpm dev
```

### 5.2 生产模式

```bash
cd gateway && pnpm build && pnpm start
```

### 5.3 CLI 集成

```bash
./bin/imm gateway
```

## 6. 服务模块说明

### 6.1 normalize.ts

URL 规范化逻辑，详见 [ARCHITECTURE.md#34-url-规范化](../../ARCHITECTURE.md#34-url-规范化-normalization)。

### 6.2 dedup.ts

去重管理，使用 `better-sqlite3` 操作 `data/dedup.sqlite`。

主要方法：
- `exists(url: string): boolean` - 检查 URL 是否已采集
- `add(url, collection, filePath): void` - 记录采集

### 6.3 cleaner.ts

内容清洗，仅当 `format=html` 时执行：
1. `linkedom` 解析 HTML 为 DOM
2. `@mozilla/readability` 提取正文
3. `turndown` 转换为 Markdown

### 6.4 storage.ts

文件存储：
- 生成 YAML frontmatter
- 生成 slug 文件名（处理冲突）
- 写入 `raw/{source}/{date}/{slug}.md`

### 6.5 indexer.ts

QMD 索引触发，使用 debounce 机制：

```typescript
const pendingUpdate = debounce(async () => {
  await exec(`qmd --index ${config.qmdIndex} update`);
  await exec(`qmd --index ${config.qmdIndex} embed`);
}, config.debounceMs);
```

## 7. 设计决策记录

详见 `.discuss/2026-04-13/data-collection-gateway/decisions/`：
- D01: Gateway 架构设计
- D02: Payload Schema 设计
- D03: QMD 索引策略
