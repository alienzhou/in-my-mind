# D02: 配置文件分层

## 决策

**配置文件采用三层分层机制**，按优先级从高到低：

1. `.local` 配置（最高优先级）
2. 项目配置
3. 默认配置（最低优先级）

## 分层设计

```
优先级高 ────────────────────────────────── 优先级低

.local 配置  >  项目配置  >  默认配置
(个人/私密)      (团队共享)     (代码内置)
```

### 配置文件路径

| 层级 | Gateway (TS) | Collector (Python) |
|------|--------------|-------------------|
| .local | `config.local.ts` / `config.local.json` | `config.local.yaml` |
| 项目配置 | `config.ts` / `config.json` | `config.yaml` |
| 默认配置 | 代码内 hardcode | 代码内 hardcode |

## 理由

1. **私密数据隔离**：API Key、个人排除列表等敏感信息放在 `.local`，不提交到仓库
2. **团队协作**：公共配置可以提交，团队成员共享
3. **灵活覆盖**：开发者可以在本地覆盖任意配置，不影响他人

## 实现要点

### .gitignore 配置
```gitignore
# Local configs (不提交)
*.local.ts
*.local.json
*.local.yaml
config.local.*
```

### 配置加载顺序
```typescript
// Gateway 示例
const config = {
  ...defaultConfig,        // 第三优先级
  ...loadProjectConfig(),  // 第二优先级
  ...loadLocalConfig(),    // 第一优先级（覆盖前两者）
};
```

```python
# Collector 示例
config = {
    **default_config,
    **load_project_config(),
    **load_local_config(),
}
```

## 状态

✅ 已决策
