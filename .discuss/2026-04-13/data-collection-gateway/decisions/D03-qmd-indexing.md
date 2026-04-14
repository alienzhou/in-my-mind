# D03: QMD 索引策略

**状态**: ✅ Confirmed  
**日期**: 2026-04-13  
**决策者**: zhouhongxuan

## 背景

采集的数据需要被 QMD 索引才能被搜索。需要决定索引触发的时机和方式。

## 决策

### 1. 索引配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| Index 名称 | `in-my-mind` | 可通过配置覆盖 |
| 索引位置 | `~/.cache/qmd/in-my-mind.sqlite` | QMD 默认位置 |
| Collection 映射 | `raw/` 下每个子目录 → 独立 Collection | github, twitter, bookmarks 等 |

### 2. Collection 结构

```bash
# 添加 Collection 的命令
qmd --index in-my-mind collection add github      ./raw/github      --pattern '**/*.md'
qmd --index in-my-mind collection add twitter     ./raw/twitter     --pattern '**/*.md'
qmd --index in-my-mind collection add bookmarks   ./raw/bookmarks   --pattern '**/*.md'
qmd --index in-my-mind collection add zhihu       ./raw/zhihu       --pattern '**/*.md'
qmd --index in-my-mind collection add xiaohongshu ./raw/xiaohongshu --pattern '**/*.md'
qmd --index in-my-mind collection add others      ./raw/others      --pattern '**/*.md'
```

### 3. 索引触发策略

**方案**: Debounce 批量触发

- **触发时机**: 每次写入后，启动 60 秒的 debounce 计时器
- **批量处理**: 60 秒内的多次写入合并为一次索引操作
- **执行命令**: `qmd --index in-my-mind update && qmd --index in-my-mind embed`

```typescript
// Gateway 内部实现
const pendingUpdate = debounce(async () => {
  await exec('qmd --index in-my-mind update');
  await exec('qmd --index in-my-mind embed');
}, 60_000); // 60 秒 debounce

// 每次写入后调用
await storage.write(doc);
pendingUpdate();
```

### 4. QMD 增量特性

QMD 原生支持增量索引：
- `qmd update`: 只处理新增/修改的文件
- `qmd embed`: 只为新文档生成向量嵌入

无需自行实现增量逻辑。

## 备选方案（已拒绝）

| 方案 | 拒绝理由 |
|------|----------|
| 即时索引（每次写入立即触发） | 频繁 I/O，embed 有 CPU 开销 |
| 定时任务（每小时/每天） | 数据不够实时 |
| 使用 `wiki-external` index | 已用于其他测试，不用于生产 |

## 相关决策

- [D01-gateway-architecture.md](./D01-gateway-architecture.md) - Gateway 架构设计
