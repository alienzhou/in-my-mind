# 外置知识库架构设计

> 基于 Thread 5zvh1ajfcwsq8whgn4wh 的讨论延续，于 2026-04-13 完成

## ✅ Confirmed (All)

### 索引方案
- 使用 **QMD** 作为索引引擎
- 独立 index：`wiki-external`
- 每个来源使用独立 Collection

### 数据来源（5个）
- GitHub Star
- Twitter/X
- 小红书
- 知乎
- 浏览器书签

### 仓库目录结构

```
in-my-mind/
├── raw/                            # 原始内容存储（与 QMD Collection 对应）
│   ├── github/{date}/
│   ├── twitter/{date}/
│   ├── xiaohongshu/{date}/
│   ├── zhihu/{date}/
│   └── bookmarks/{date}/
│
├── collector/                      # 程序驱动采集（可定时执行）
│   ├── sync.py                     # 统一入口
│   ├── base.py                     # Collector 基类
│   ├── dedup.py                    # 去重管理器
│   ├── normalize.py                # URL 规范化
│   ├── github/collector.py
│   ├── twitter/collector.py
│   ├── xiaohongshu/collector.py
│   └── zhihu/collector.py
│
├── tools/                          # 用户主动采集工具
│   └── browser/
│       ├── server/                 # 本地接收 Server
│       └── extension/              # 浏览器插件
│
├── skills/                         # Agent Skills
│   └── in-my-mind-search/
│
├── data/                           # 本地数据（入 Git）
│   └── dedup.sqlite
│
├── bin/imm                         # CLI 入口
└── README.md
```

### 采集策略
| 类型 | 目录 | 触发方式 | 技术栈 |
|------|------|---------|--------|
| 程序驱动 | `collector/` | 定时任务 / `sync` 命令 | Python + API |
| 用户主动 | `tools/` | 浏览器插件点击 | Extension + Server |

### 去重机制
- SQLite 存储已采集记录
- URL 作为唯一标识
- URL 规范化：移除追踪参数、统一大小写、平台特定规则
- dedup.sqlite 入 Git（多设备共享）

### 内容更新策略
- **忽略更新，只采集一次**

### Skill
- 名称：`in-my-mind-search`
- 引用方式：软链接或复制到其他仓库

## ❌ Rejected
- 模拟登录方案
- 用 PageIndex 做外置库索引
- 检测内容更新
- dedup.sqlite 不入 Git

---

## 🌟 Future Optimizations (Inspired by GBrain)
*已记录，初期不实现，留作未来演进方向*

1. **Compiled Truth + Timeline 结构**：未来可引入 LLM 对抓取的原始内容进行二次编译，顶部放"编译后的真相"（最佳理解摘要），底部放"证据时间线"（追加原始抓取记录）。
2. **Fat Skills (Skillpack) 理念**：在 `in-my-mind-search` 中编写极其详尽的 Agent 操作手册，教导 Agent 如何阅读、何时更新知识库。
3. **Recipes 模式接入**：将数据源的配置过程写成 Markdown 指南，让 Agent 能够协助排查采集脚本的故障。
4. **夜间梦境循环 (Dream Cycle)**：利用 Scheduled Tasks 定期在夜间清理孤立页面、修复死链、进行知识融合与重新 Embed。

---

## 🚀 Next Steps

1. **搭建流程框架**
   - [ ] 创建目录结构
   - [ ] 实现 `base.py`（Collector 基类）
   - [ ] 实现 `dedup.py`（去重管理器）
   - [ ] 实现 `normalize.py`（URL 规范化）
   - [ ] 实现 `sync.py`（统一入口）

2. **PoC 验证**
   - [ ] 实现 GitHub Stars Collector 作为第一个示例
   - [ ] 端到端测试：采集 → 去重 → 写入 → QMD 索引

3. **后续扩展**
   - [ ] 其他 Collector（Twitter、小红书、知乎）
   - [ ] 浏览器插件 + Server
   - [ ] Skill 实现
