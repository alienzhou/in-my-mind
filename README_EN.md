# 🧠 In My Mind (imm)

> Your bookmarks aren't a knowledge base—they're an information graveyard.

<p align="center">
  <img src="./docs/assets/hero-banner.jpg" alt="In My Mind - Your External Brain for Distilled Knowledge" width="100%">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[🇨🇳 中文](./README.md)

## The Problem

We all do it: Star, bookmark, like—then never look back.

After three years, I have 2000+ GitHub Stars, thousands of Twitter bookmarks, and countless Xiaohongshu likes. Technically, all this stuff "exists"—but practically, it's as good as gone. When you need it, you can't remember it. When you remember it, you can't find it.

The deeper pain: **Dumping these "skimmed" contents into Obsidian drowns your truly important notes**. Your core knowledge base should be high-density, not a landfill.

## My Solution

Separate personal knowledge into two libraries:

| Type                       | Purpose                                       | Examples                                   |
| -------------------------- | --------------------------------------------- | ------------------------------------------ |
| **Core Library**     | Deep research, personal thought distillation  | Obsidian notes, book annotations           |
| **External Library** | Skim and move on, just need to know it exists | GitHub Stars, Twitter/X, Xiaohongshu likes |

**in-my-mind** is the implementation of this "External Library".

It does one simple thing: collect your scattered bookmarks from various platforms, build a vector index, and make it searchable by Agents. No deep reading required—just **find it when you need it**.

## What It Collects

| Source | Status | Collection Method | Notes |
|--------|--------|-------------------|-------|
| 🌟 GitHub Stars | ✅ Implemented | CLI (`imm sync github-stars`) | Sync all starred repositories |
| 🐦 Twitter/X | ✅ Implemented | Browser extension | Auto-capture on Like/Bookmark |
| 🌐 Any webpage | ✅ Implemented | Browser extension | One-click via floating button |
| 📖 Zhihu | 📋 Planned | — | Saved content |
| 🔖 Browser bookmarks | 📋 Planned | — | Bulk import |

### Browser Extension

Located in `tools/browser/` directory, provides:

| Feature              | Description                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| X Enhancement        | Auto-listen for Like/Bookmark actions, real-time tweet collection                                            |
| Universal Collection | Persistent floating button in bottom-right corner, one-click collection of any webpage to `raw/bookmarks/` |

See: [Browser Extension Collector Spec](./docs/specs/browser-extension-collector.md)

## Architecture

```
           ┌─────────────────────┐
           │   Collection Triggers │
           │  Browser Extension │ Cron   │
           │  CLI Commands  │ Agent  │
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
               QMD Vector Index
```

Design Principles:

- **Unified Entry**: All data sources go through Gateway—normalized and deduplicated in one place
- **URL Deduplication**: Same content with different URLs is recognized (`github.com/x` and `www.github.com/x` are the same)
- **Incremental Sync**: Only fetch new content each time, no redundant pulls

## Quick Start

```bash
# Clone
git clone git@github.com:alienzhou/in-my-mind.git
cd in-my-mind
./install.sh

# Start Gateway
imm gateway

# Sync GitHub Stars
imm sync github-stars

# Search
qmd --index in-my-mind query "Agent Prompt optimization"
```

See `.env.example` for environment variable configuration.

## Directory Structure

```
in-my-mind/
├── raw/                    # Collected raw content (organized by source and date)
├── gateway/                # Data entry service (TypeScript + Hono)
├── collector/              # Python collection scripts
├── skills/                 # Agent search Skill
├── data/dedup.sqlite       # Deduplication database
└── bin/imm                 # CLI entry
```

## Agent Integration

The project includes an Agent Skill that allows your Agent to search this external knowledge base:

```
skills/in-my-mind-search/
└── SKILL.md
```

Once configured, your Agent can query your personal knowledge base when answering questions.

## Future Ideas

- **Compiled Truth**: LLM preprocessing generates knowledge summaries, letting skimmed content compound
- **Dream Cycle**: Nightly auto-cleanup of orphan pages, dead link repair, re-embedding vectors
- **Recipes Mode**: Structured configuration guide for Agents to auto-fix collection environments

## Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture Design
- [docs/CONFIG.md](./docs/CONFIG.md) - Configuration Guide

## Inspiration

- [GBrain by Garry Tan](https://www.youtube.com/watch?v=example) - Compiled Truth concept
- [LLM Wiki 2.0](https://www.xiaohongshu.com/discovery/item/69dcd4d5000000001a03066a) - Fighting FOMO and information overload
- [保姆级教程搭建你的 LLM Wiki](https://www.xiaohongshu.com/discovery/item/69d392f70000000023017421)

---

You don't need to deeply read everything you save—but you need to find it when you need it. That's all in-my-mind tries to solve.

## License

MIT
