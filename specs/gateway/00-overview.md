# Gateway 模块总览

> 整体系统架构见 [ARCHITECTURE.md](../../ARCHITECTURE.md)

## 背景与目标

Gateway 是 `in-my-mind` 项目的**统一数据采集入口**，所有采集源（浏览器插件、Python Collector、外部 API）都通过 HTTP 接口提交数据。

详见 [ARCHITECTURE.md#31-gateway-统一入口](../../ARCHITECTURE.md#31-gateway-统一入口)

## 核心职责

1. 接收标准化 Payload
2. URL 规范化与去重检查
3. HTML 内容清洗（Readability → Markdown）
4. 写入 `raw/` 目录
5. 触发 QMD 增量索引

## 文档索引

| 文档 | 说明 |
|------|------|
| [01-architecture-design.md](./01-architecture-design.md) | 模块实现细节、目录结构、技术选型 |
| [02-api-design.md](./02-api-design.md) | HTTP API 设计、Payload Schema |
| [03-task-list.md](./03-task-list.md) | 开发任务清单 |
| [04-cr-issues.md](./04-cr-issues.md) | Code Review 问题清单 |
| [05-verification-checklist.md](./05-verification-checklist.md) | 验收检查清单 |
| [06-backlog.md](./06-backlog.md) | 当前版本不做的事项 |

## 相关文档

- [ARCHITECTURE.md](../../ARCHITECTURE.md) - 系统整体架构
- `.discuss/2026-04-13/data-collection-gateway/` - 架构讨论记录
