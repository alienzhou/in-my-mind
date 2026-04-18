# Agent 编码规范

## 日志规范

**针对实现的代码，必须使用项目已有的日志组件，尽可能埋下必要日志，便于排查问题。**

- **Python**: 使用 `collector/logger.py` → `from collector.logger import get_logger`
- **TypeScript**: 使用 pino，输出到 `logs/gateway.log`

关键埋点位置：函数入口、外部 API 调用、异常捕获、分支决策点。

## 测试与 Lint 规范

**每一次代码修改后，必须执行单元测试和 Lint 检查，确保流程闭环。**

### Gateway (TypeScript)

```bash
cd gateway
pnpm test        # 运行单元测试
pnpm lint        # 运行 ESLint 检查
pnpm lint:fix    # 自动修复 lint 问题
```

### 浏览器插件 (TypeScript)

```bash
cd tools/browser/extension
pnpm build       # 构建插件
pnpm test        # 运行单元测试
pnpm lint        # 运行 ESLint 检查
pnpm typecheck   # 类型检查
```

### 测试覆盖要求

- **新增功能**：必须编写对应的单元测试
- **Bug 修复**：优先补充回归测试用例
- **测试文件命名**：`*.test.ts`，与被测文件同目录
- **测试框架**：Vitest

### 测试迭代原则

**每次修复或调整后，不仅要运行现有单测，还要评估是否需要补充新的测试用例。**

检查清单：
1. **回归测试**：本次修复的 bug 是否有对应的测试用例？如果没有，必须补充
2. **边界情况**：修复涉及的边界条件是否已覆盖？
3. **错误路径**：异常处理逻辑是否有测试？
4. **关联影响**：修改是否可能影响其他模块？需要补充集成测试吗？

目标：让每次迭代都使测试套件更加完整，形成正向循环。

## 采集源变更规范

添加新的采集源时，除了实现 Collector 和 Gateway 对接外，**必须同步更新以下位置**：

| 需要更新的文件 | 更新内容 |
|---|---|
| `skills/in-my-mind-search/SKILL.md` | frontmatter `description` 中的来源列表、"What This Library Is" 的来源列表、"Source signals" 表格（新来源的语义含义） |
| `ARCHITECTURE.md` | `raw/` 目录结构、Collection 初始化命令 |
| `README.md` | "它采集什么" 列表 |

遗漏任何一项都会导致 Agent 不知道新来源的存在，或者无法正确解读新来源的搜索结果。
