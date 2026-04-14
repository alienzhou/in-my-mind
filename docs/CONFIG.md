# 配置说明

本文档描述 `in-my-mind` 项目的配置系统设计与各配置项说明。

## 配置文件位置

### Gateway (TypeScript)

| 文件路径 | 说明 | Git 状态 |
|----------|------|----------|
| `gateway/src/config/default.json` | 默认配置，包含所有配置项的默认值 | ✅ 提交 |
| `gateway/src/config/config.json` | 项目配置，覆盖默认值（可选） | ✅ 可提交 |
| `gateway/src/config/.local.json` | 本地配置，最高优先级（不提交） | ❌ gitignore |

### Collector (Python)

| 文件路径 | 说明 | Git 状态 |
|----------|------|----------|
| `collector/config/default.yaml` | 默认配置，包含所有配置项的默认值 | ✅ 提交 |
| `collector/config/config.yaml` | 项目配置，覆盖默认值（可选） | ✅ 可提交 |
| `collector/config/.local.yaml` | 本地配置，最高优先级（不提交） | ❌ gitignore |

## 配置加载优先级

```text
.local.json/.local.yaml    ← 最高优先级，本地开发配置
        ↓
config.json/config.yaml    ← 项目级配置
        ↓
default.json/default.yaml  ← 默认配置（兜底）
```

配置项会深度合并，高优先级的配置会覆盖低优先级的同名配置项。

## 配置项说明

### 通用配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `excludeUsers` | `string[]` | `[]` | 排除的 GitHub 用户名列表，这些用户的内容不会被采集 |
| `indexName` | `string` | `"in-my-mind"` | QMD/Algolia 索引名称 |
| `incrementalThreshold` | `number` | `5` | 增量采集阈值，连续 skipped 达到该值时停止 |

### Gateway 专用配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `port` | `number` | `3020` | HTTP 服务监听端口 |
| `rawDir` | `string` | `"../raw"` | 原始数据存储目录（相对于 gateway） |
| `dedupDb` | `string` | `"../data/dedup.sqlite"` | 去重数据库路径 |
| `debounceMs` | `number` | `30000` | 索引触发间隔（毫秒） |
| `logging.level` | `string` | `"info"` | 日志级别：debug, info, warn, error |
| `logging.dir` | `string` | `"logs"` | 日志输出目录 |

### Collector 专用配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `gatewayUrl` | `string` | `"http://localhost:3020"` | Gateway 服务地址 |
| `logging.level` | `string` | `"info"` | 日志级别：DEBUG, INFO, WARNING, ERROR |
| `logging.dir` | `string` | `"logs"` | 日志输出目录 |

## 示例

### Gateway 本地配置示例 (.local.json)

```json
{
  "excludeUsers": ["alienzhou", "test-user"],
  "logging": {
    "level": "debug"
  },
  "port": 3021
}
```

### Collector 本地配置示例 (.local.yaml)

```yaml
# 排除的用户名（这些用户的内容不会被采集）
exclude_users:
  - alienzhou
  - test-user

# 日志配置
logging:
  level: DEBUG

# 增量采集阈值（调试时可设小一些）
incremental_threshold: 3
```

## 环境变量

除配置文件外，部分配置也支持通过环境变量覆盖（优先级最高）：

### Gateway

| 环境变量 | 对应配置项 | 说明 |
|----------|------------|------|
| `PORT` | `port` | HTTP 服务端口 |
| `RAW_DIR` | `rawDir` | 原始数据目录 |
| `DEDUP_DB` | `dedupDb` | 去重数据库路径 |
| `QMD_INDEX` | `indexName` | QMD 索引名称 |
| `DEBOUNCE_MS` | `debounceMs` | 索引触发间隔 |

### Collector

| 环境变量 | 说明 |
|----------|------|
| `GITHUB_TOKEN` | GitHub API Token（提高 API 限额） |
| `GITHUB_USERNAME` | GitHub 用户名 |
| `GATEWAY_URL` | Gateway 服务地址 |

> **提示**: 敏感信息（如 API Token）推荐使用 `.env` 文件配置，已加入 `.gitignore`。

## 配置 Schema 定义

Gateway 配置的 TypeScript 类型定义位于 `gateway/src/config/schema.ts`：

```typescript
interface Config {
  excludeUsers: string[];
  indexName: string;
  incrementalThreshold: number;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    dir: string;
  };
  port: number;
  rawDir: string;
  dedupDb: string;
  debounceMs: number;
}
```

## 最佳实践

1. **本地开发**: 使用 `.local.json`/`.local.yaml` 存放个人配置
2. **团队共享**: 项目级配置放在 `config.json`/`config.yaml`
3. **敏感信息**: API Token 等放在 `.env` 文件或环境变量中
4. **调试模式**: 本地配置中设置 `logging.level: "debug"` 获取详细日志
