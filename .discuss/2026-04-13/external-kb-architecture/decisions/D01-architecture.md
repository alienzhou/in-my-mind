# D01: 外置知识库整体架构

**决策时间**: 2026-04-13  
**状态**: ✅ Confirmed  
**讨论 Thread**: 5zvh1ajfcwsq8whgn4wh (indexing-and-search) → 5hi1z5u5wmx4pwn0z0dm (in-my-mind)

---

## 背景

需要构建一个外置个人知识库，用于：
1. 采集网络上收藏、点赞、看到的各种内容（文章、仓库、视频等）
2. 对这些内容建立索引
3. 让智能体能够召回相关内容

## 决策

### 1. 索引方案：QMD

**选择 QMD 而非 PageIndex**：
- QMD 适合碎片化、异构内容
- 本地 GGUF 模型，无 API 费用
- 支持大批量索引

**索引配置**：
- Index 名称：`wiki-external`
- 每个来源对应一个 Collection

### 2. 仓库职责：in-my-mind

`in-my-mind` 仓库作为外置知识库，负责：
- 存储采集的原始内容（`raw/`）
- 提供采集工具（`collector/` + `tools/`）
- 提供搜索 Skill（`skills/in-my-mind-search/`）

### 3. 采集方式分层

| 类型 | 目录 | 说明 |
|------|------|------|
| 程序驱动 | `collector/` | API 采集，可定时执行 |
| 用户主动 | `tools/` | 浏览器插件等交互式工具 |

### 4. 去重机制

- SQLite 存储（`data/dedup.sqlite`）
- URL 作为唯一标识
- URL 规范化处理
- 入 Git 实现多设备共享

### 5. 内容更新策略

- 忽略更新，只采集一次
- 简化实现，避免复杂的增量更新逻辑

## 目录结构

```
in-my-mind/
├── raw/{collection}/{date}/    # 原始内容
├── collector/                  # 程序驱动采集
├── tools/                      # 用户主动采集
├── skills/                     # Agent Skills
├── data/dedup.sqlite           # 去重数据库
└── bin/imm                     # CLI
```

## 相关讨论

- 索引方案对比：PageIndex vs QMD
- 数据采集方式：API 优先 + 浏览器自动化补位
- QMD Index vs Collection 的使用场景
