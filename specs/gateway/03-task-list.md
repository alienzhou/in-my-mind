# Gateway 任务清单

## 开发任务

### Phase 1: 基础框架搭建

- [x] **T01**: 初始化 gateway 目录结构
  - 创建 `gateway/` 目录
  - 初始化 `package.json`（pnpm）
  - 配置 `tsconfig.json`
  - 安装依赖：hono, better-sqlite3, @mozilla/readability, turndown, linkedom

- [x] **T02**: 实现配置管理 (`src/config.ts`)
  - 端口、路径、QMD index 名称等配置项
  - 环境变量支持

- [x] **T03**: 实现 Hono 服务入口 (`src/index.ts`)
  - 启动 HTTP 服务
  - 挂载路由
  - 错误处理中间件

### Phase 2: 核心服务实现

- [x] **T04**: 实现 URL 规范化 (`src/services/normalize.ts`)
  - 通用规则（小写、移除追踪参数等）
  - 平台特定规则（Twitter、GitHub 等）

- [x] **T05**: 实现去重管理 (`src/services/dedup.ts`)
  - SQLite 连接与 Schema 初始化
  - `exists(url)` 检查
  - `add(url, collection, filePath)` 记录

- [x] **T06**: 实现内容清洗 (`src/services/cleaner.ts`)
  - Readability 提取正文
  - Turndown 转换为 Markdown
  - linkedom 提供 DOM 环境

- [x] **T07**: 实现文件存储 (`src/services/storage.ts`)
  - 生成 frontmatter
  - 生成 slug 文件名
  - 写入 `raw/{source}/{date}/{slug}.md`
  - 处理文件名冲突

- [x] **T08**: 实现 QMD 索引触发 (`src/services/indexer.ts`)
  - Debounce 机制（60 秒）
  - 调用 `qmd update && qmd embed`

### Phase 3: API 路由实现

- [x] **T09**: 实现 POST `/api/v1/collect` 路由
  - 参数校验
  - 调用各服务
  - 返回响应

- [x] **T10**: 实现 GET `/api/v1/health` 路由

- [x] **T11**: 实现 GET `/api/v1/stats` 路由（可选）

### Phase 4: CLI 集成

- [x] **T12**: 更新 `bin/imm` 添加 gateway 子命令
  - `./bin/imm gateway` 启动服务

- [x] **T13**: 添加 `pnpm dev` 和 `pnpm start` 脚本

### Phase 5: Python Collector 改造

- [x] **T14**: 改造 `collector/base.py`
  - 添加 `_send_to_gateway()` 方法
  - 修改现有采集逻辑调用 Gateway

- [x] **T15**: 标记 `collector/dedup.py` 和 `collector/normalize.py` 为 DEPRECATED
  - 保留代码以兼容，添加废弃注释

- [x] **T16**: 更新 `collector/github/collector.py` 使用新基类

### Phase 6: 文档与测试

- [ ] **T17**: 更新 `ARCHITECTURE.md`

- [ ] **T18**: 编写 README 使用说明

- [ ] **T19**: 端到端测试
  - 手动调用 API 验证
  - Python Collector 调用验证
  - QMD 索引验证

---

## 临时待办

（开发过程中发现的待处理事项）

- [ ] QMD Collection 初始化脚本（首次运行时自动创建 Collection）

---

## 完成记录

| 日期 | 任务 | 说明 |
|------|------|------|
| 2026-04-13 | T01-T16 | Gateway 模块完整实现，Python Collector 改造完成 |
