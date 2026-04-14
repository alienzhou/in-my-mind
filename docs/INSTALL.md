# In My Mind 安装手册

本手册适用于**人工安装**和 **Agent 自动化安装**，涵盖所有依赖项、服务启动和配置说明。

---

## 目录

1. [环境要求](#1-环境要求)
2. [快速安装](#2-快速安装)
3. [分步安装](#3-分步安装)
   - [3.1 基础依赖](#31-基础依赖)
   - [3.2 Gateway 安装](#32-gateway-安装-typescript)
   - [3.3 Collector 安装](#33-collector-安装-python)
   - [3.4 浏览器插件安装](#34-浏览器插件安装)
   - [3.5 QMD 索引配置](#35-qmd-索引配置)
   - [3.6 CLI 命令安装](#36-cli-命令安装)
4. [环境变量配置](#4-环境变量配置)
5. [验证安装](#5-验证安装)
6. [常见问题](#6-常见问题)
7. [卸载](#7-卸载)

---

## 1. 环境要求

| 组件 | 最低版本 | 说明 |
|------|----------|------|
| **Node.js** | 22.0.0+ | Gateway 服务依赖 |
| **pnpm** | 9.15.0+ | Node.js 包管理器 |
| **Python** | 3.9+ | Collector 采集脚本 |
| **QMD** | latest | 本地向量检索引擎 |
| **Git** | 2.x | 版本控制 |

### 操作系统支持

- macOS 12+
- Linux (Ubuntu 20.04+, Debian 11+)
- Windows (WSL2 推荐)

---

## 2. 快速安装

> **Agent 自动化提示**: 执行以下一键安装脚本即可完成所有步骤。

```bash
# 1. 克隆仓库
git clone git@github.com:alienzhou/in-my-mind.git
cd in-my-mind

# 2. 一键安装
./install.sh

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 Token

# 4. 安装依赖
# Gateway (Node.js)
cd gateway && pnpm install && cd ..

# Collector (Python)
pip install -r requirements.txt

# 5. 初始化 QMD 索引
qmd --index in-my-mind collection add github      ./raw/github      --pattern '**/*.md'
qmd --index in-my-mind collection add twitter     ./raw/twitter     --pattern '**/*.md'
qmd --index in-my-mind collection add bookmarks   ./raw/bookmarks   --pattern '**/*.md'
qmd --index in-my-mind collection add xiaohongshu ./raw/xiaohongshu --pattern '**/*.md'
qmd --index in-my-mind collection add zhihu       ./raw/zhihu       --pattern '**/*.md'
qmd --index in-my-mind collection add others      ./raw/others      --pattern '**/*.md'

# 6. 启动服务
imm gateway
```

---

## 3. 分步安装

### 3.1 基础依赖

#### Node.js (22+)

```bash
# macOS (使用 Homebrew)
brew install node@22

# 或使用 nvm (推荐)
nvm install 22
nvm use 22

# Linux (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### pnpm

```bash
# 通过 npm 安装
npm install -g pnpm@9.15.0

# 或通过 corepack (Node.js 16.13+)
corepack enable
corepack prepare pnpm@9.15.0 --activate

# 验证
pnpm --version
```

#### Python (3.9+)

```bash
# macOS
brew install python@3.11

# Linux (Ubuntu/Debian)
sudo apt-get install python3 python3-pip python3-venv
```

#### QMD (本地向量检索)

> QMD 是本项目的核心检索引擎，用于全文/向量搜索。

```bash
# macOS (Homebrew)
brew install qmd

# 或使用 cargo 安装
cargo install qmd

# 验证安装
qmd --version
```

**QMD 配置目录**: `~/.cache/qmd/`

---

### 3.2 Gateway 安装 (TypeScript)

Gateway 是数据采集的**统一入口**，所有采集源通过 HTTP 接口提交数据。

```bash
# 进入 Gateway 目录
cd gateway

# 安装依赖
pnpm install

# 开发模式启动 (热重载)
pnpm dev

# 或生产模式启动
pnpm start
```

**端口**: `3020` (固定)

**技术栈**: Hono + better-sqlite3 + @mozilla/readability + turndown

**依赖项**:

| 包名 | 用途 |
|------|------|
| `hono` | 轻量 HTTP 框架 |
| `@hono/node-server` | Node.js 服务适配 |
| `@mozilla/readability` | 网页正文提取 |
| `turndown` | HTML 转 Markdown |
| `linkedom` | 服务端 DOM 解析 |
| `better-sqlite3` | SQLite 去重数据库 |
| `pino` | 结构化日志 |

---

### 3.3 Collector 安装 (Python)

Collector 是程序驱动的数据采集层，支持 GitHub Stars、Twitter 等平台。

```bash
# 在项目根目录
# 推荐使用 venv
python3 -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt
```

**依赖项** (`requirements.txt`):

```
requests>=2.28.0
python-dotenv>=1.0.0
```

**验证安装**:

```bash
python3 collector/sync.py --help
```

---

### 3.4 浏览器插件安装

浏览器插件用于**用户主动采集**网页内容和 X 平台增强。

#### 构建插件

```bash
# 进入插件目录
cd tools/browser/extension

# 安装依赖
pnpm install

# 开发模式 (监听变化)
pnpm dev

# 生产构建
pnpm build
```

#### 加载到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「**开发者模式**」
3. 点击「**加载已解压的扩展程序**」
4. 选择 `tools/browser/extension/dist` 目录（构建后）或 `tools/browser/extension` 目录

#### 图标资源

需要在 `icons/` 目录添加以下尺寸的图标：

- `icon16.png` (16x16)
- `icon32.png` (32x32)  
- `icon48.png` (48x48)
- `icon128.png` (128x128)

**功能**:

- **X 增强**: 自动监听 Like/Bookmark 操作并采集推文
- **通用采集**: 一键采集任意网页内容

---

### 3.5 QMD 索引配置

QMD 用于本地全文/向量检索，需要初始化 Collection。

#### 初始化所有 Collection

```bash
# 在项目根目录执行
qmd --index in-my-mind collection add github      ./raw/github      --pattern '**/*.md'
qmd --index in-my-mind collection add twitter     ./raw/twitter     --pattern '**/*.md'
qmd --index in-my-mind collection add bookmarks   ./raw/bookmarks   --pattern '**/*.md'
qmd --index in-my-mind collection add xiaohongshu ./raw/xiaohongshu --pattern '**/*.md'
qmd --index in-my-mind collection add zhihu       ./raw/zhihu       --pattern '**/*.md'
qmd --index in-my-mind collection add others      ./raw/others      --pattern '**/*.md'
```

#### 更新索引

```bash
# 更新文件索引
qmd --index in-my-mind update

# 生成向量嵌入
qmd --index in-my-mind embed
```

#### 搜索测试

```bash
qmd --index in-my-mind query "Agent Prompt 优化"
```

**索引存储位置**: `~/.cache/qmd/in-my-mind.sqlite`

---

### 3.6 CLI 命令安装

`imm` 是项目的统一 CLI 入口，支持全局调用。

#### 安装到系统路径

```bash
# 在项目根目录执行
./install.sh
```

该脚本会：
1. 设置 `bin/imm` 为可执行
2. 创建符号链接到 `/usr/local/bin/imm`

#### 手动安装 (备选)

```bash
# 设置可执行权限
chmod +x bin/imm

# 创建符号链接 (可能需要 sudo)
sudo ln -s $(pwd)/bin/imm /usr/local/bin/imm
```

#### 可用命令

```bash
imm gateway                # 启动 Gateway API 服务
imm sync github-stars      # 同步 GitHub Stars
imm sync all               # 同步所有采集器
imm status                 # 查看数据库统计
```

---

## 4. 环境变量配置

### 创建配置文件

```bash
cp .env.example .env
```

### 必要配置项

编辑 `.env` 文件：

```env
# ========== GitHub API 配置 ==========
# Token 获取: https://github.com/settings/tokens
# 所需权限: public_repo, read:user
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_USERNAME=your_username

# ========== X (Twitter) API 配置 ==========
# 文档: https://developer.x.com/en/docs/authentication/oauth-2-0
# 所需权限: tweet.read, users.read, like.read, bookmark.read, offline.access
X_BEARER_TOKEN=your_bearer_token
X_USER_ID=your_user_id
```

### 获取 GitHub Token

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 设置名称，如 `in-my-mind-collector`
4. 勾选权限：

   | 权限 | 必需 | 说明 |
   |------|------|------|
   | `public_repo` | ✅ | 读取公开仓库、获取 starred 列表 |
   | `read:user` | ✅ | 读取用户基本信息 |
   | `repo` | 可选 | 如需采集私有仓库 Stars |

5. 生成并复制 Token

### 获取 X (Twitter) Token

1. 访问 https://developer.twitter.com/en/portal/dashboard
2. 创建项目和应用
3. 启用 OAuth 2.0
4. 获取 Bearer Token

---

## 5. 验证安装

### 5.1 检查所有依赖

```bash
# Node.js
node --version    # 期望: v22.x.x

# pnpm
pnpm --version    # 期望: 9.15.x

# Python
python3 --version # 期望: 3.9+

# QMD
qmd --version     # 期望: 有版本输出

# imm CLI
imm               # 期望: 显示帮助信息
```

### 5.2 测试 Gateway

```bash
# 终端 1: 启动 Gateway
imm gateway

# 终端 2: 测试健康检查
curl http://localhost:3020/api/v1/health
# 期望返回: {"status":"ok"}
```

### 5.3 测试 Collector

```bash
# 确保 Gateway 已启动
imm sync github-stars

# 检查数据库状态
imm status
```

### 5.4 测试 QMD 搜索

```bash
# 确保有数据后
qmd --index in-my-mind query "测试搜索"
```

---

## 6. 常见问题

### Q1: `pnpm install` 报错

**症状**: `ERR_PNPM_NO_LOCKFILE` 或版本不匹配

**解决**:
```bash
# 确保使用正确版本
corepack enable
corepack prepare pnpm@9.15.0 --activate

# 清理后重试
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Q2: Gateway 启动失败

**症状**: 端口被占用或 better-sqlite3 编译失败

**解决**:
```bash
# 检查端口占用
lsof -i :3020

# 重新编译 native 模块
cd gateway
pnpm rebuild better-sqlite3
```

### Q3: QMD 命令未找到

**症状**: `command not found: qmd`

**解决**:
```bash
# 确认安装
cargo install qmd

# 检查 PATH
echo $PATH | grep -q ".cargo/bin" || export PATH="$HOME/.cargo/bin:$PATH"
```

### Q4: 权限问题

**症状**: `Permission denied` 执行 `install.sh`

**解决**:
```bash
chmod +x install.sh bin/imm
./install.sh
```

### Q5: Python 依赖安装失败

**症状**: `pip install` 报错

**解决**:
```bash
# 使用 venv 隔离环境
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 7. 卸载

### 移除 CLI 命令

```bash
./uninstall.sh
# 或手动
sudo rm /usr/local/bin/imm
```

### 移除项目

```bash
# 删除项目目录
rm -rf in-my-mind

# 删除 QMD 索引
rm -rf ~/.cache/qmd/in-my-mind.sqlite
```

### 移除 Node.js 依赖

```bash
cd gateway && rm -rf node_modules
cd tools/browser/extension && rm -rf node_modules
```

### 移除 Python 虚拟环境

```bash
rm -rf .venv
```

---

## Agent 自动化参考

以下是 Agent 执行安装的**标准流程**：

```yaml
install_sequence:
  - name: "Clone repository"
    command: "git clone git@github.com:alienzhou/in-my-mind.git && cd in-my-mind"
    
  - name: "Install CLI"
    command: "./install.sh"
    
  - name: "Setup environment"
    command: "cp .env.example .env"
    manual_step: "填写 GITHUB_TOKEN 和 GITHUB_USERNAME"
    
  - name: "Install Gateway dependencies"
    command: "cd gateway && pnpm install"
    
  - name: "Install Collector dependencies"  
    command: "pip install -r requirements.txt"
    
  - name: "Initialize QMD collections"
    commands:
      - "qmd --index in-my-mind collection add github ./raw/github --pattern '**/*.md'"
      - "qmd --index in-my-mind collection add twitter ./raw/twitter --pattern '**/*.md'"
      - "qmd --index in-my-mind collection add bookmarks ./raw/bookmarks --pattern '**/*.md'"
      - "qmd --index in-my-mind collection add xiaohongshu ./raw/xiaohongshu --pattern '**/*.md'"
      - "qmd --index in-my-mind collection add zhihu ./raw/zhihu --pattern '**/*.md'"
      - "qmd --index in-my-mind collection add others ./raw/others --pattern '**/*.md'"
      
  - name: "Verify installation"
    commands:
      - "imm gateway &"
      - "sleep 3"
      - "curl http://localhost:3020/api/v1/health"
      
verify_checklist:
  - "node --version >= 22"
  - "pnpm --version >= 9.15"
  - "python3 --version >= 3.9"
  - "qmd --version"
  - "imm status"
  - "curl localhost:3020/api/v1/health returns 200"
```

---

## 相关文档

- [README.md](../README.md) - 项目概述
- [ARCHITECTURE.md](../ARCHITECTURE.md) - 架构设计
- [CONFIG.md](./CONFIG.md) - 配置项说明
- [ENV-SETUP.md](./ENV-SETUP.md) - 环境变量详解
- [浏览器插件 README](../tools/browser/extension/README.md) - 插件开发指南
