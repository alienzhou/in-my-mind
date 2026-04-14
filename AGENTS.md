# Agent 编码规范

## 日志规范

**针对实现的代码，必须使用项目已有的日志组件，尽可能埋下必要日志，便于排查问题。**

- **Python**: 使用 `collector/logger.py` → `from collector.logger import get_logger`
- **TypeScript**: 使用 pino，输出到 `logs/gateway.log`

关键埋点位置：函数入口、外部 API 调用、异常捕获、分支决策点。

## 采集源变更规范

添加新的采集源时，除了实现 Collector 和 Gateway 对接外，**必须同步更新以下位置**：

| 需要更新的文件 | 更新内容 |
|---|---|
| `skills/in-my-mind-search/SKILL.md` | frontmatter `description` 中的来源列表、"What This Library Is" 的来源列表、"Source signals" 表格（新来源的语义含义） |
| `ARCHITECTURE.md` | `raw/` 目录结构、Collection 初始化命令 |
| `README.md` | "它采集什么" 列表 |

遗漏任何一项都会导致 Agent 不知道新来源的存在，或者无法正确解读新来源的搜索结果。
