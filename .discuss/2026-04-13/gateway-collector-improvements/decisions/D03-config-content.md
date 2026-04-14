# D03: 配置内容定义

## 决策

**统一配置项定义**，Gateway 和 Collector 使用相同的配置结构。

## 配置项

### 核心配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `exclude_users` | `string[]` | `[]` | 排除的用户名列表，这些用户的 skill 不会被采集 |
| `index_name` | `string` | `"in-my-mind"` | Algolia 搜索索引名称 |

### 配置示例

#### Gateway (TypeScript)
```typescript
// config.local.ts
export default {
  exclude_users: ["alienzhou", "test-user"],
  index_name: "in-my-mind-dev",
};
```

#### Collector (Python)
```yaml
# config.local.yaml
exclude_users:
  - alienzhou
  - test-user
index_name: in-my-mind-dev
```

## 理由

### exclude_users
1. **隐私保护**：某些用户可能不希望自己的 skill 被索引
2. **测试隔离**：排除测试账户的 skill
3. **本地定制**：开发者可在 `.local` 中添加自己的用户名，避免测试时污染数据

### index_name
1. **环境隔离**：开发/测试/生产使用不同索引
2. **多租户支持**：未来可支持多个独立索引
3. **灵活配置**：无需改代码即可切换索引

## 实现要点

### 配置 Schema 定义

```typescript
// Gateway
interface Config {
  exclude_users: string[];
  index_name: string;
}
```

```python
# Collector
@dataclass
class Config:
    exclude_users: list[str]
    index_name: str
```

### 验证逻辑
- `exclude_users`: 检查是否为字符串数组
- `index_name`: 非空字符串，只允许字母、数字、连字符

## 状态

✅ 已决策
