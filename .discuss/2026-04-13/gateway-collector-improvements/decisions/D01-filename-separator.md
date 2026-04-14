# D01: 文件名连接符改进

## 决策

**文件名中用户名与仓库名之间使用 `_` 作为连接符**，而非直接拼接。

## 示例

| 变更前 | 变更后 |
|--------|--------|
| `alienzhouagent-better-checkpoint.md` | `alienzhou_agent-better-checkpoint.md` |
| `user123my-skill.md` | `user123_my-skill.md` |

## 理由

1. **可读性提升**：用户名和仓库名之间有明确的视觉分隔
2. **避免歧义**：直接拼接可能导致边界模糊，无法区分用户名结束和仓库名开始
3. **解析友好**：后续程序解析时可以通过 `_` 分割用户名和仓库名

## 实现要点

### Gateway 侧
```typescript
// 修改前
const filename = `${owner}${repo}.md`;

// 修改后
const filename = `${owner}_${repo}.md`;
```

### 影响范围
- `gateway/src/skill-importer.ts` 中的文件命名逻辑
- 已导入的文件不受影响（历史数据保持不变）

## 状态

✅ 已决策
