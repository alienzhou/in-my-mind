# 环境配置说明

## 敏感信息管理

本项目使用 `.env` 文件管理敏感 Token，该文件已被 `.gitignore` 忽略，**不会提交到 Git 仓库**。

## 配置步骤

### 1. 复制示例文件

```bash
cp .env.example .env
```

### 2. 填写你的配置

编辑 `.env` 文件：

```env
# GitHub Token
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# 你的 GitHub 用户名（用于获取你的 Stars）
GITHUB_USERNAME=your_username
```

### 3. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

## 获取 GitHub Token

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 设置 Token 名称，如 `in-my-mind-collector`
4. **勾选权限**：

   | 权限 | 必需 | 说明 |
   |------|------|------|
   | `public_repo` | ✅ 推荐 | 读取公开仓库、获取 starred 列表 |
   | `read:user` | ✅ 推荐 | 读取用户基本信息 |
   | `repo` | 可选 | 如需采集私有仓库 Stars |

5. 点击 "Generate token"
6. **立即复制 Token**（只显示一次！）
7. 粘贴到 `.env` 文件

### 权限说明

- **`public_repo`** - 最精简权限，只能读取公开仓库
- **`repo`** - 包含 public_repo，额外可读取私有仓库
- **不要勾选** `admin:*`、`delete_repo`、`workflow` 等权限（采集器不需要）

## GitHub Stars 采集流程

采集器会执行以下步骤：

```
1. 分页获取你的所有 starred repositories
   ↓
2. 对每个仓库获取 README 内容
   - 优先读取 README.md
   - 如果没有，使用仓库描述作为内容
   ↓
3. 提取元数据
   - topics (仓库标签)
   - language (主要语言)
   - description (描述)
   ↓
4. 发送到 Gateway 存储
   - 自动去重
   - 写入 raw/github/{date}/{repo}.md
```

### 使用方式

```bash
# 终端1: 启动 Gateway 服务
./bin/imm gateway

# 终端2: 运行同步
./bin/imm sync github-stars
```

### 采集的数据格式

每个 Star 会保存为 Markdown 文件：

```markdown
---
title: "owner/repo"
url: "https://github.com/owner/repo"
source: "github"
tags:
  - topic1
  - topic2
  - lang:TypeScript
  - github-star
author: "owner"
collectedAt: "2026-04-13T15:00:00Z"
---

# owner/repo

仓库描述...

README 内容...
```

## 关于 Star 标签/笔记

GitHub 有一个 "Star Notes" 功能，允许用户给 Star 添加个人笔记和标签。

**但是：**

- ⚠️ **这个功能目前没有公开的 API**
- GitHub GraphQL API 也暂未提供访问接口
- 如果未来 API 开放，我们会更新采集器支持

目前采集的标签来自仓库本身的 `topics`。

## 安全提醒

- ⚠️ **永远不要**把 `.env` 文件提交到 Git
- ⚠️ **永远不要**在代码中硬编码 Token
- ⚠️ **永远不要**在公开聊天/文档中分享 Token
- ✅ Token 泄露后立即在 GitHub 设置中撤销
- ✅ 定期轮换 Token
