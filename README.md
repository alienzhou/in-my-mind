# 🧠 In My Mind (imm)

> 你的收藏夹不是知识库，是信息坟场。

<p align="center">
  <img src="./docs/assets/hero-banner.jpg" alt="In My Mind - Your External Brain for Distilled Knowledge" width="100%">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[🇺🇸 English](./README_EN.md)

## 问题

我们都有这个毛病：刷到好东西就 Star、收藏、点赞——然后再也不看。

三年下来，我的 GitHub Stars 有 2000 多个，Twitter 收藏几千条，小红书点赞无数。这些东西理论上都「在」，但实际上等于不存在。需要的时候根本想不起来，想起来也搜不到。

更痛的是：**把这些「浅看」的内容塞进 Obsidian，会把真正重要的笔记淹没**。核心知识库应该是高密度的，不是垃圾场。

## 我的解法

把个人知识分成两个库：

| 类型             | 定位                   | 例子                             |
| ---------------- | ---------------------- | -------------------------------- |
| **核心库** | 深度研究、个人思考沉淀 | Obsidian 笔记、读书批注          |
| **外置库** | 浅看则止、有印象就行   | GitHub Star、Twitter、小红书收藏 |

**in-my-mind** 就是这个「外置库」的实现。

它做的事很简单：把你散落在各平台的收藏统一采集、建向量索引、让 Agent 能搜到。不求精读，只求**需要的时候找得到**。

## 它采集什么

| 来源 | 状态 | 采集方式 | 说明 |
|------|------|----------|------|
| 🌟 GitHub Stars | ✅ 已实现 | CLI (`imm sync github-stars`) | 同步所有 Star 的项目 |
| 🐦 Twitter/X | ✅ 已实现 | 浏览器插件 | 监听 Like/Bookmark 自动采集 |
| 🌐 任意网页 | ✅ 已实现 | 浏览器插件 | 点击右下角按钮一键采集 |
| 📖 知乎 | 📋 规划中 | — | 收藏内容 |
| 🔖 浏览器书签 | 📋 规划中 | — | 批量导入 |

### 浏览器插件

位于 `tools/browser/` 目录，提供：

| 功能 | 说明 |
|------|------|
| X 增强 | 自动监听 Like/Bookmark 操作，实时采集推文内容 |
| 通用采集 | 右下角常驻按钮，一键采集任意网页到 `raw/bookmarks/` |

详见：[浏览器插件采集器技术规格](./docs/specs/browser-extension-collector.md)

## 架构

```
           ┌─────────────────────┐
           │     采集触发源       │
           │  浏览器插件 │ Cron   │
           │  CLI 命令  │ Agent  │
           └──────────┬──────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Gateway (TypeScript)                     │
│  normalize → dedup → cleaner → storage → indexer (debounce) │
│                      :3020                                  │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
              raw/{source}/{date}/
              └── *.md (Markdown)
                      │
                      ▼
               QMD 向量索引
```

设计原则：

- **统一入口**：所有数据源走 Gateway，一处规范化、一处去重
- **URL 去重**：同一内容不同链接形式能被识别（`github.com/x` 和 `www.github.com/x` 是同一个）
- **增量同步**：每次只采新增内容，不重复拉取

## 快速开始

```bash
# 克隆
git clone git@github.com:alienzhou/in-my-mind.git
cd in-my-mind
./install.sh

# 启动 Gateway
imm gateway

# 同步 GitHub Stars
imm sync github-stars

# 搜索
qmd --index in-my-mind query "Agent Prompt 优化"
```

环境变量配置见 `.env.example`。

## 目录结构

```
in-my-mind/
├── raw/                    # 采集的原始内容（按来源和日期组织）
├── gateway/                # 数据入口服务 (TypeScript + Hono)
├── collector/              # Python 采集脚本
├── skills/                 # Agent 搜索 Skill
├── data/dedup.sqlite       # 去重数据库
└── bin/imm                 # CLI 入口
```

## Agent 集成

项目自带一个 Agent Skill，让你的 Agent 能检索这个外置知识库：

```
skills/in-my-mind-search/
└── SKILL.md
```

配置到 Agent 后，它回答问题时就能调用你的个人知识库。

## 远期想法

- **Compiled Truth**：LLM 预处理生成知识摘要，让浅看的东西也能长出复利
- **Dream Cycle**：夜间自动清理孤立页面、修复死链、重新嵌入向量
- **Recipes 模式**：结构化配置指南，让 Agent 能自动修复采集环境

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 架构设计
- [docs/INSTALL.md](./docs/INSTALL.md) - 安装指南
- [docs/OPERATION.md](./docs/OPERATION.md) - 运维手册
- [docs/CONFIG.md](./docs/CONFIG.md) - 配置说明

## 灵感来源

- [GBrain by Garry Tan](https://www.youtube.com/watch?v=example) - Compiled Truth 理念
- [LLM Wiki 2.0](https://www.xiaohongshu.com/discovery/item/69dcd4d5000000001a03066a) - 对抗 FOMO 与资讯过载
- [保姆级教程搭建你的 LLM Wiki](https://www.xiaohongshu.com/discovery/item/69d392f70000000023017421)

---

收藏的东西不用精读，但需要的时候找得到。这是 in-my-mind 想解决的全部问题。

## License

MIT
