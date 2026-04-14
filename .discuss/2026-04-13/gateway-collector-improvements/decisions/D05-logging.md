# D05: 日志规范

## 决策

**统一日志方案**：Gateway 使用 pino，Collector 使用 Python logging，日志输出到项目 `logs/` 目录。

## 技术选型

| 组件 | 日志库 | 理由 |
|------|--------|------|
| Gateway (Node.js) | **pino** | 高性能、结构化 JSON 输出、生态丰富 |
| Collector (Python) | **logging** | 标准库、无额外依赖、配置灵活 |

## 日志路径

```
project-root/
├── logs/
│   ├── gateway/
│   │   ├── gateway.log         # 主日志
│   │   └── gateway-error.log   # 错误日志
│   └── collector/
│       ├── collector.log       # 主日志
│       └── collector-error.log # 错误日志
├── .gitignore                  # 包含 logs/
└── ...
```

### .gitignore 配置
```gitignore
# Logs
logs/
*.log
```

## 关键链路日志

### 必须记录的日志点

| 链路 | Gateway | Collector |
|------|---------|-----------|
| API 入口 | ✅ 请求方法、路径、参数 | ✅ 开始采集、源信息 |
| API 出口 | ✅ 响应状态、耗时 | ✅ 采集结果、统计 |
| 去重判断 | ✅ 判断结果、原因 | - |
| 文件写入 | ✅ 文件路径、大小 | ✅ 输出文件信息 |
| 外部 API | ✅ Algolia 调用结果 | ✅ Gateway API 调用结果 |
| 错误 | ✅ 完整堆栈 | ✅ 完整堆栈 |

## 实现要点

### Gateway (pino)

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    targets: [
      {
        target: 'pino/file',
        options: { destination: './logs/gateway/gateway.log' },
        level: 'info',
      },
      {
        target: 'pino/file',
        options: { destination: './logs/gateway/gateway-error.log' },
        level: 'error',
      },
    ],
  },
});

// 使用示例
logger.info({ skill: skill.name, status: 'imported' }, 'Skill imported');
logger.error({ err, skill: skill.name }, 'Import failed');
```

### Collector (Python logging)

```python
import logging
from logging.handlers import RotatingFileHandler

def setup_logger():
    logger = logging.getLogger('collector')
    logger.setLevel(logging.INFO)
    
    # 文件处理器
    file_handler = RotatingFileHandler(
        'logs/collector/collector.log',
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    
    # 错误日志
    error_handler = RotatingFileHandler(
        'logs/collector/collector-error.log',
        maxBytes=10*1024*1024,
        backupCount=5
    )
    error_handler.setLevel(logging.ERROR)
    
    logger.addHandler(file_handler)
    logger.addHandler(error_handler)
    
    return logger

# 使用示例
logger.info(f"开始采集: {source.name}")
logger.info(f"去重判断: {skill.name} -> {status}")
logger.error(f"采集失败: {skill.name}", exc_info=True)
```

## 日志级别使用规范

| 级别 | 使用场景 |
|------|----------|
| `DEBUG` | 调试信息、详细变量值 |
| `INFO` | 正常业务流程、关键节点 |
| `WARN` | 非致命异常、降级处理 |
| `ERROR` | 错误、需要关注的问题 |

## 状态

✅ 已决策
