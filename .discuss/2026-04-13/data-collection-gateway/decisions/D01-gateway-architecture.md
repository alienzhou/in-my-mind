# D01: Gateway 架构设计

**状态**: ✅ Confirmed  
**日期**: 2026-04-13  
**决策者**: zhouhongxuan

## 背景

`in-my-mind` 项目需要一个统一的数据采集入口，接收来自浏览器插件、Python Collector、外部 API 等多种数据源的内容，进行清洗、去重后存储到 `raw/` 目录，并触发 QMD 索引。

## 决策

### 1. 架构定位

Gateway 作为**唯一的数据写入入口**，所有采集源（包括 Python Collector）都通过 HTTP 接口提交数据。

```text
┌─────────────────────────────────────────────────────────────┐
│  浏览器插件 / Python Collector / 其他 API 采集              │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /api/v1/collect
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Gateway (TypeScript :3020)                │
│  normalize → dedup → cleaner → storage → indexer (debounce) │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  raw/{source}/{date}/{file}.md                              │
│  data/dedup.sqlite                                          │
│  ~/.cache/qmd/in-my-mind.sqlite                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. 技术选型

| 维度 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | Readability 生态原生、类型安全 |
| 框架 | Hono | 轻量、高性能、现代化 API |
| 去重存储 | SQLite | 复用现有 data/dedup.sqlite |
| 内容清洗 | @mozilla/readability + turndown | 成熟的 HTML→Markdown 方案 |

### 3. 目录结构

```text
in-my-mind/
├── gateway/                      # TypeScript 网关
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # Hono 服务入口
│       ├── routes/
│       │   └── collect.ts       # POST /api/v1/collect
│       ├── services/
│       │   ├── dedup.ts         # SQLite 去重
│       │   ├── normalize.ts     # URL 规范化
│       │   ├── cleaner.ts       # Readability + Turndown
│       │   ├── storage.ts       # 写入 raw/
│       │   └── indexer.ts       # QMD 索引 (debounce 60s)
│       └── types/
│           └── payload.ts
├── collector/                    # Python 采集器（改为调用 Gateway）
└── ...
```

### 4. 运行配置

- **端口**: 3020（固定）
- **启动方式**: `bin/imm gateway`
- **鉴权**: 无（本地服务）

## 影响

1. **Python Collector 改造**: 从直接写文件改为 HTTP 调用 Gateway
2. **删除冗余代码**: `collector/dedup.py` 和 `collector/normalize.py` 将被删除
3. **统一数据流**: 所有数据入口统一，便于后续扩展

## 相关决策

- [D02-payload-schema.md](./D02-payload-schema.md) - Payload 格式设计
- [D03-qmd-indexing.md](./D03-qmd-indexing.md) - QMD 索引策略
