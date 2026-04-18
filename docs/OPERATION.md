# In My Mind 运维手册

本手册涵盖 Gateway 服务管理、常见问题排查和日常运维操作。

---

## 目录

1. [Gateway 服务管理](#1-gateway-服务管理)
2. [常见问题 FAQ](#2-常见问题-faq)
3. [故障排查](#3-故障排查)
4. [日志管理](#4-日志管理)

---

## 1. Gateway 服务管理

Gateway 是数据采集的统一入口，所有采集源通过 HTTP 接口提交数据。

### 1.1 启动 Gateway

**前台启动（推荐用于调试）**:
```bash
imm gateway
```

**后台启动（推荐用于生产）**:
```bash
imm gateway > ~/.imm/logs/gateway-$(date +%Y%m%d-%H%M%S).log 2>&1 &
```

启动后会输出进程 ID，日志文件位于 `~/.imm/logs/` 目录。

### 1.2 查看 Gateway 状态

**检查服务是否运行**:
```bash
# 方法1: 检查端口
lsof -i :3020 | grep LISTEN

# 方法2: 健康检查
curl http://localhost:3020/api/v1/health
```

**查看最近的日志**:
```bash
# 列出所有日志文件
ls -lt ~/.imm/logs/ | head -10

# 查看最新日志
tail -50 ~/.imm/logs/gateway-$(ls -t ~/.imm/logs/ | head -1 | grep -o '[0-9]*')
```

**实时查看日志**:
```bash
tail -f ~/.imm/logs/gateway-$(ls -t ~/.imm/logs/ | head -1 | grep -o '[0-9]*')
```

### 1.3 重启 Gateway

**完整重启流程**:
```bash
# 1. 查找并杀死现有进程
PID=$(lsof -i :3020 -t)
if [ -n "$PID" ]; then
  kill $PID
  echo "已杀死进程 $PID"
fi

# 2. 构建 Gateway（如果有代码更新）
cd gateway && pnpm build && cd ..

# 3. 后台启动 Gateway
imm gateway > ~/.imm/logs/gateway-$(date +%Y%m%d-%H%M%S).log 2>&1 &

# 4. 等待启动完成
sleep 2

# 5. 验证启动成功
lsof -i :3020 | grep LISTEN && echo "启动成功" || echo "启动失败"
```

### 1.4 停止 Gateway

```bash
# 方法1: 使用端口号
lsof -i :3020 -t | xargs kill

# 方法2: 使用进程名
pkill -f "imm gateway"
pkill -f "tsx.*src/index.ts"
```

---

## 2. 常见问题 FAQ

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

## 3. 故障排查

### 3.1 Gateway 无法启动

**排查步骤**:

1. **检查端口占用**:
   ```bash
   lsof -i :3020
   ```

2. **检查依赖完整**:
   ```bash
   cd gateway
   pnpm install
   pnpm rebuild better-sqlite3
   ```

3. **查看错误日志**:
   ```bash
   # 前台启动查看详细错误
   imm gateway
   ```

### 3.2 数据同步失败

**排查步骤**:

1. **确认 Gateway 运行**:
   ```bash
   curl http://localhost:3020/api/v1/health
   ```

2. **检查 Collector 日志**:
   ```bash
   imm sync github-stars -v
   ```

3. **验证环境变量**:
   ```bash
   cat .env | grep GITHUB_TOKEN
   ```

### 3.3 QMD 索引问题

**排查步骤**:

1. **检查索引状态**:
   ```bash
   qmd --index in-my-mind status
   ```

2. **重建索引**:
   ```bash
   qmd --index in-my-mind update --force
   qmd --index in-my-mind embed
   ```

---

## 4. 日志管理

### 4.1 日志文件位置

**Gateway 日志**: `~/.imm/logs/gateway-YYYYMMDD-HHMMSS.log`

**日志目录**: `~/.imm/logs/`

### 4.2 日志内容示例

```
Starting Gateway service...
Gateway listening on port 3020
[2026-04-18 23:41:15.123 +0800] INFO: Collect request received
    module: "collect"
    url: "https://example.com"
```

### 4.3 日志清理

**保留最近 7 天的日志**:
```bash
find ~/.imm/logs/ -name "gateway-*.log" -mtime +7 -delete
```

**保留最近 30 天的日志**:
```bash
find ~/.imm/logs/ -name "gateway-*.log" -mtime +30 -delete
```

### 4.4 日志分析

**统计错误数量**:
```bash
grep -r "ERROR" ~/.imm/logs/ | wc -l
```

**查找特定 URL 的记录**:
```bash
grep "example.com" ~/.imm/logs/gateway-*.log
```

---

## 相关文档

- [安装手册](INSTALL.md) - 环境搭建和安装步骤
- [配置说明](CONFIG.md) - 环境变量和配置项
- [架构设计](../ARCHITECTURE.md) - 系统架构和设计理念
