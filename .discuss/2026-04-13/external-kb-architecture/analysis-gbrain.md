# 分析：GBrain vs in-my-mind (QMD)

## 🔵 Current Focus
- 分析 `garrytan/gbrain` 项目的设计理念和实现方式
- 提取可以借鉴到 `in-my-mind` 的优秀实践

## 💡 Analysis & Insights

我仔细阅读了 GBrain 的 README。这是 YC 总裁 Garry Tan 开源的个人知识库系统。它的很多设计理念非常超前且极具启发性！

### 1. GBrain 的核心理念 (The Compounding Thesis)

GBrain 最强的地方在于它的 **"复利" (Compounding)** 概念。它不是一个单纯的"搜索引擎"，而是一个"会成长的记忆体"：
- **读写循环**：Agent 遇到实体（人、公司、概念） → 去 Brain 搜索 → 用新信息更新 Brain 页面 → 重新索引。
- **信息沉淀模式**（非常值得借鉴）：
  ```markdown
  ---
  frontmatter
  ---
  Compiled Truth (编译后的真相，这是你当前对这个事物的最佳理解，会被不断重写)
  
  ---
  Timeline (时间线，追加写入的证据/事件，永远不修改只追加)
  - 2026-04-13: 听了一次相关的播客
  - 2026-04-14: 在某某会议上讨论了这个问题
  ```
  **结论在上面，证据在下面。** 这个数据结构设计极其精妙。

### 2. 架构对比

| 维度 | GBrain | in-my-mind (基于 QMD) |
|------|--------|-----------------------|
| **核心存储** | Markdown 文件 (Git 仓库) | Markdown 文件 (Git 仓库) |
| **检索引擎** | PGLite (本地) 或 Supabase (云端) + pgvector | QMD (SQLite FTS5 + 本地 GGUF 向量) |
| **文件管理** | 包含复杂的二进制文件迁移机制 (移到 S3) | 暂未涉及复杂二进制文件管理 |
| **Agent 交互** | MCP Server 提供 30+ 种工具（读、写、搜等） | 计划通过 Skill + QMD CLI |

*评价：底层的存储和索引思路非常一致（Markdown 源文件 + 本地数据库索引），但 QMD 更轻量（无需 Postgres），GBrain 的数据库 schema 更复杂。*

### 3. 可借鉴的优秀实践 (Highly Recommended)

我们在设计 `in-my-mind` 时，有几个点**强烈建议抄过来**：

#### 💡 借鉴点 1：Thin Harness, Fat Skills (重度依赖 Skill 指导 Agent)
GBrain 强调：光给 Agent 提供工具是不够的，必须通过详尽的 Markdown 文档（Skillpack）教 Agent **如何**使用这些工具。
- 我们的 `skills/in-my-mind-search/` 不应该只是一句 "你可以用这个搜知识库"，而应该是一套完整的 playbook：告诉 Agent 什么时候搜、搜到后怎么用、怎么把新知识写回知识库。

#### 💡 借鉴点 2：Compiled Truth + Timeline 的 Markdown 结构
对于我们主动采集或者自己写的笔记，强烈建议采用这种结构。
- 外置库（网页抓取）可能不太适用，但你的**核心库（stream）**如果能转成这种结构，会让 Agent 的摘要和理解能力大幅提升。

#### 💡 借鉴点 3：Recipes 模式 (Installer is Docs)
GBrain 把各个数据源的接入（Twitter, Calendar, Email 等）做成了独立的 Recipe Markdown 文档，里面包含了配置说明和脚本。
- 我们的 `collector/` 和 `tools/` 也可以采用这种模式：每个数据源不仅仅是 Python 代码，还得配一份 Agent 能读懂的说明书，让 Agent 以后能自己去修这些脚本。

#### 💡 借鉴点 4：定时 "Dream Cycle" (做梦阶段)
GBrain 提倡让 Agent 在晚上跑 Cron job：扫描昨天的对话、清理孤立页面、修复死链、整理记忆。
- 我们基于 CodeFlicker，完全可以配置类似的 Scheduled Tasks，定期对 `raw/` 目录进行清理、打标签、重新 Embed。

---

## ❓ Next Steps

你觉得 GBrain 的这套理念中，哪部分最吸引你？

1. **Markdown 页面结构**（Truth + Timeline）？我们可以把外置采集下来的内容，也用 LLM 跑一遍，总结出 Compiled Truth。
2. **Fat Skills 理念**？我们在写 `in-my-mind-search` Skill 时，可以写得更厚实、更有指导性。
3. **Dream Cycle**？我们可以规划一些自动化脚本，定期整理你的收藏内容。

我们是在原来的架构上继续（先实现 Collector），还是把这些新想法融入到刚才确定的架构里？