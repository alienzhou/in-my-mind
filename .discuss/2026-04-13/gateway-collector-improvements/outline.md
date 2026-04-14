# Gateway & Collector 改进讨论

## 🔵 Current Focus
（无）

## ⚪ Pending
（无）

## ✅ Confirmed
- D01: 文件名连接符用 `_`，如 `alienzhou_agent-better-checkpoint.md`
- D02: 配置文件分层：`.local` 最高优先级（gitignore），其他层级可提交
- D03: 配置内容包括：排除的用户名列表、index 名称（默认 in-my-mind）
- D04: 时间过滤先不做，数据已有 collected_at 字段
- D05: 增量采集机制：基于 Gateway 的 `skipped` 状态，连续 5 个 skipped 认为到达上次位置
- D06: Gateway 日志组件：使用 pino，输出到 `logs/gateway.log`
- D07: Collector 日志组件：使用 Python logging，输出到 `logs/collector.log`
- D08: 日志目录 `logs/` 加入 gitignore
- D09: 关键链路日志点：[COLLECT], [DEDUP], [STORAGE], [INDEXER], [SYNC], [FETCH], [GATEWAY], [INCREMENTAL]

## ❌ Rejected
（无）
