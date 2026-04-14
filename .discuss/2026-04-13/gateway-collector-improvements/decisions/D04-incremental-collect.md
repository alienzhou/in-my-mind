# D04: 基于 Dedup 的增量采集

## 决策

**Collector 基于 Gateway 返回的去重状态实现增量采集**，当连续遇到 5 个 `skipped` 状态时停止采集。

## 机制设计

```
┌─────────────────────────────────────────────────────────────┐
│                      增量采集流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Collector 请求 ──► Gateway 处理 ──► 返回 status           │
│                                                             │
│   status: 'imported'  → 新文档，计数器重置为 0               │
│   status: 'skipped'   → 已存在，计数器 +1                   │
│                                                             │
│   if (连续 skipped 计数 >= 5) {                             │
│       停止采集当前源                                         │
│   }                                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 理由

1. **效率优化**：避免重复处理已导入的 skill，节省 API 调用和计算资源
2. **自然断点**：连续 5 个 skipped 说明已到达历史数据边界
3. **容错设计**：单个 skipped 不停止，允许少量已存在的记录穿插在新记录中
4. **简单可靠**：不依赖额外的时间戳或版本号，只依赖去重结果

## 实现要点

### Gateway 返回格式
```typescript
// 已有实现，无需修改
interface ImportResponse {
  status: 'imported' | 'skipped' | 'error';
  message: string;
  // ...
}
```

### Collector 增量逻辑
```python
class IncrementalCollector:
    def __init__(self, max_consecutive_skipped: int = 5):
        self.max_consecutive_skipped = max_consecutive_skipped
    
    def collect(self, source: SkillSource) -> CollectResult:
        consecutive_skipped = 0
        
        for skill in source.iter_skills():
            response = self.gateway.import_skill(skill)
            
            if response.status == 'skipped':
                consecutive_skipped += 1
                if consecutive_skipped >= self.max_consecutive_skipped:
                    logger.info(f"达到连续跳过阈值 ({self.max_consecutive_skipped})，停止采集")
                    break
            else:
                consecutive_skipped = 0  # 重置计数器
        
        return CollectResult(...)
```

### 配置扩展（可选）
```yaml
# config.yaml
incremental:
  max_consecutive_skipped: 5  # 可配置阈值
```

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| 全新源 | 正常导入所有，不会触发 skipped |
| 纯增量 | 遇到 5 个已存在后停止 |
| 混合情况 | 新旧穿插时计数器会重置，继续处理 |
| 源顺序变化 | 可能多处理一些，但不会遗漏 |

## 状态

✅ 已决策
