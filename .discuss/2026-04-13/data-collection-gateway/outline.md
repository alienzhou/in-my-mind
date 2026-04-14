# Data Collection Gateway Architecture

## 🎉 讨论完成

所有核心决策已确认并沉淀为决策文档。

## ✅ Confirmed (22 项决策)

### 架构与技术
- **C01**: 本地网关，无需鉴权
- **C02**: 同步处理，暂不引入任务队列
- **C12**: 技术选型：Gateway 用 TypeScript，Collector 保持 Python
- **C13**: 目录结构：Gateway 作为独立顶级模块 `gateway/`
- **C14**: 数据流统一：Python Collector 改为调用 Gateway HTTP 接口
- **C15**: Python collector/ 下的 dedup.py / normalize.py 完全删除
- **C16**: Gateway 端口：固定 3020
- **C17**: Gateway 启动方式：`bin/imm gateway`
- **C21**: HTTP API 路径格式：`/api/v1/xxx`
- **C22**: HTTP 框架：Hono

### Payload 设计
- **C03**: 采集端负责初步数据清理，网关只接收标准化 Payload
- **C04**: 统一协议格式 - 必填字段：`title`, `url`, `content`
- **C05**: 可选字段：`tags`, `author`, `source`（来源标识）等
- **C06**: 时间字段：由网关生成（`createdAt`）
- **C07**: `format` 字段，默认 `markdown`，若为 `html` 则走 Readability 清洗
- **C08**: 漏传 format 导致 HTML 原文存储的风险可接受
- **C09**: 存储路径：`raw/{source}/{date}/{filename}.md`
- **C10**: 来源（source）：接口传入则使用，未传则归入 `others`
- **C11**: 去重机制：基于规范化 URL，存于 `data/dedup.sqlite`

### QMD 索引
- **C18**: QMD 索引策略：Debounce 1 分钟后批量触发 `qmd update && qmd embed`
- **C19**: QMD Index 名称：`in-my-mind`（可通过配置覆盖）
- **C20**: QMD Collection 结构：`raw/` 下每个子目录映射为一个独立 Collection

## ❌ Rejected
- 异步消息队列
- 网关端身份鉴权
- 可扩展 metadata 对象
- Gateway 放在 tools/ 下
- Python Collector 直接写 raw/
- 保留 Python 的 dedup.py / normalize.py
- 使用 wiki-external 作为 index
- 即时索引
- Express / Fastify 框架

## 📁 决策文档

- [D01-gateway-architecture.md](./decisions/D01-gateway-architecture.md) - Gateway 架构设计
- [D02-payload-schema.md](./decisions/D02-payload-schema.md) - Payload 格式设计
- [D03-qmd-indexing.md](./decisions/D03-qmd-indexing.md) - QMD 索引策略
