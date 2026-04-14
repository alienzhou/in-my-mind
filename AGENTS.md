# Agent 编码规范

## 日志规范

**针对实现的代码，必须使用项目已有的日志组件，尽可能埋下必要日志，便于排查问题。**

- **Python**: 使用 `collector/logger.py` → `from collector.logger import get_logger`
- **TypeScript**: 使用 pino，输出到 `logs/gateway.log`

关键埋点位置：函数入口、外部 API 调用、异常捕获、分支决策点。
