# 微信公众号文章采集方案探讨

> 发起日期：2026-04-23
> 状态：🔵 讨论中 —— 等待用户在 Pending 部分确认路线

## 背景

当前 `in-my-mind` 已经能覆盖：

- GitHub Stars（Collector 定时同步）
- Twitter/X 的 Like/Bookmark 与任意网页（浏览器插件）

用户的下一个痛点：**想把"在微信里读到的公众号好文"也纳入外置库**。
由于公众号文章几乎只在微信内流转（链接是 `https://mp.weixin.qq.com/s/xxx`），
且 PC 浏览器打开时经常被反爬拦截，我们需要专门的采集路径。

## 用户初始设想

> "我能不能弄个机器人，本地电脑启动个服务，我把文章转给某个微信机器人号，
> 然后本地收到这条消息，就抓取采集？"

拆解一下，这个设想包含三个假设：

1. 存在一个可以**接收个人微信消息**的本地服务（"机器人号"）。
2. 用户在手机微信里点"转发给朋友" → 转给这个机器人 → 本地就能收到消息和链接。
3. 本地服务拿到 `mp.weixin.qq.com/s/...` 链接后，能把**正文 + 图片**抓下来。

这三条拆开看都是独立的可行性问题，本提纲按这个顺序展开。

---

## 🔵 Current Focus

**路线选型**：在下面的"方案矩阵"里挑一条主线往下推。
用户需要在转发便利性、稳定性、封号风险、维护成本之间做权衡。

## ⚪ Pending（等待决策）

### P1. 主路线选哪一条？

| 方案 | 核心机制 | 转发交互 | 稳定性 | 风险 |
|------|----------|----------|--------|------|
| **A. 微信 Hook 机器人** (WeChatFerry / wxhelper) | 在 Windows PC 端微信进程里注入 DLL，拦截消息 | ✅ 直接转给"机器人小号"即可触发 | 中（绑定特定微信版本，每次微信升级可能失效） | ⚠️ 封号风险，需用小号；macOS/Linux 不支持 |
| **B. Wechaty + PadLocal 等付费协议** | iPad 协议模拟，走 Wechaty SDK | ✅ 转给机器人小号 | 较高 | 💰 ≈200 元/月；依赖第三方 token 方维护 |
| **C. 浏览器插件 + 微信读书** | 登录微信读书 PC 版或网页版，监听"想法/书架/公众号" | ⚠️ 需要在微信读书里"关注公众号"或复用现有 Wewe-RSS 思路 | 中 | 间接、延迟大，微信读书 API 变动也会失效 |
| **D. 浏览器插件 + Edge/Chrome 打开 mp.weixin.qq.com** | 手动把链接粘到浏览器打开，插件提取正文 | ❌ 不再是"转发"交互，失去初衷 | 高（复用现有 extension 方案） | 低 |
| **E. iOS/Android "分享到..."** | 在手机系统分享菜单里把链接发给本地服务（如 Bark / Shortcuts / 自建 HTTP） | ✅ 一步分享 | 高（不触碰微信进程） | ⚠️ 不是"转给微信机器人"，但体验几乎一样 |

**推荐排序（综合权衡后）**：

1. **E（手机分享 → 本地 HTTP）作为 MVP**：最简单、零封号风险，体验接近初衷。
2. **A（WeChatFerry）作为 PC 桌面场景补充**：如果用户主力在 Windows 看微信，
   可以做"转给机器人小号"的终极顺滑体验，但风险自担。
3. **B（付费协议）暂不推荐**：和项目"零成本外置库"的定位相悖。
4. **C（微信读书）作为被动订阅补充**：更像"订阅+摘要"，而不是"转发+采集"，可作为独立后续方案。

需要用户确认：**优先做 E，还是直接上 A？或者两者并行？**

### P2. 正文抓取子问题

无论走哪条主线，最终都要处理 `mp.weixin.qq.com/s/xxx` 链接。已知要点：

- **正文**：直接 `GET` 页面，HTML 里有完整正文，可用 Readability + Turndown（Gateway 已具备）转成 Markdown；
  仅在触发频率过高时才会被风控跳验证码。
- **图片防盗链**：`mmbiz.qpic.cn` 校验 `Referer`。
  - 方案 1：Markdown 里保留原链接，在阅读侧用 `meta referrer=no-referrer` 绕过。
  - 方案 2（推荐）：**下载图片到本地**（`raw/wechat/{date}/assets/`），Markdown 引用本地路径，彻底不依赖外链。
- **链接有效期**：公众号分享链接本身长期有效，但抓取必须在发布后尽早完成（避免作者删文/屏蔽）。
- **视频/音频**：先忽略，只保留占位符 + 原链接。

待确认：**是否接受"落地即下载图片"的策略（会增加仓库体积，但最稳）？**

### P3. 去重与命名

- 去重键：规范化的 `mp.weixin.qq.com/s/<permalink>`。
  需要在 `gateway/src/services/normalize.ts` 追加规则，
  剥掉 `chksm`、`scene`、`click_id`、`mid`、`idx`、`sn` 之外的参数。
  > ⚠️ 待确认：`__biz / mid / idx / sn` 是否应作为去重主键？
  > （短链 `/s/<token>` 和长链 `?__biz=...&mid=...&idx=...&sn=...` 指向同一篇文章）
- 文件命名：沿用 `{date}-{slug(title)}.md`，与其它 source 一致。
- source 归类：新增 `raw/wechat/`（或 `raw/wechat-mp/`？命名待定）。

### P4. 来源分类命名

候选：

- `wechat`（简洁，但微信内容并不只有公众号）
- `wechat-mp`（明确是公众号）
- `mp`（太短，易混淆）

**倾向 `wechat`**：未来若扩展到"微信群/朋友圈收藏"，可共用目录但区分 `collect_type`。

---

## ✅ Confirmed

*（待用户确认后迁移到这里）*

## ❌ Rejected

*（讨论中排除的方案会移到这里）*

---

## 附：各路线技术细节

### 路线 A：WeChatFerry（PC Hook）

- 仓库：<https://github.com/lich0821/WeChatFerry>
- 原理：对指定版本的 Windows 微信 PC 客户端做内存 Hook，通过 RPC（nng / HTTP）
  把收到的消息推给外部进程。
- 能力：
  - 接收任意类型消息（文本/图片/链接卡片/小程序卡片）
  - 拿到发送方 wxid，可做"只采集我转给机器人小号的消息"白名单
  - 可发回执消息（"✅ 已采集"）
- 约束：
  - 只支持 Windows，且仅支持特定版本微信（如 3.9.x，跟随上游版本适配）
  - 用户需要装一台 Windows 机或虚拟机，长期挂着 PC 微信登录"机器人小号"
  - 封号虽罕见，但历史上有批量事件，必须用小号

落地形态（若走此路）：

```
PC 微信小号 (Hook 进来)
        │ 消息事件（含文本/链接/卡片）
        ▼
collector/wechat/wcf_bridge.py  (长连接订阅)
        │ 解析链接、下载正文
        ▼
POST Gateway /api/v1/collect  (source=wechat)
```

### 路线 E：手机"分享到本地 HTTP"

- 原理：iOS "快捷指令" / Android "Tasker/HTTP Shortcuts" 都能做一个
  "把当前分享的 URL POST 到 `http://<本地 IP>:3020/api/v1/collect/wechat`"的动作。
- 前置条件：手机和电脑在同一局域网；或本地 Gateway 通过 Tailscale/frp 暴露。
- 交互：在微信里"复制链接" → 切到快捷指令 → 一键发送。
  - 进阶：iOS 的"共享菜单"可以直接加入自定义快捷指令，变成"微信 → 更多 → 发送到 in-my-mind"。
- 优点：完全不碰微信生态，零封号风险，跨平台。
- 缺点：比"转给机器人小号"多 1~2 步，但可控性最高。

落地形态（若走此路）：

```
iOS Shortcut / Android Tasker
        │ POST {url, source:'wechat'}
        ▼
Gateway /api/v1/collect
        │ 检测 mp.weixin.qq.com → 走 wechat fetcher
        ▼
fetcher: 抓页面 → Readability → 下载图片 → Markdown
        ▼
raw/wechat/{date}/xxx.md
```

### 路线 C：微信读书（WeWe-RSS 思路）

- 参考：<https://github.com/cooderl/wewe-rss>（2026-01 已归档但仍可用）
- 适合"订阅式"而不是"随手收藏式"。
- 与 in-my-mind 的定位不完全契合（外置库偏"遇到才收"），暂列为后续扩展。

---

## 建议的 MVP 范围（待确认）

1. 先做 **路线 E（手机快捷指令 → Gateway）**，因为：
   - 不新增组件（Gateway 已经能接 HTTP）
   - 只需新增一个"公众号 fetcher"和 `raw/wechat/` 分类
   - 用户可在半小时内完整体验闭环
2. 在 Gateway 里新增 `services/fetchers/wechat-mp.ts`：
   - 入口：判断 URL 是否属于 `mp.weixin.qq.com`
   - 拉 HTML → Readability 解析正文 → 下载图片到 `raw/wechat/{date}/assets/` → 改写 img src
3. 浏览器插件共用通用采集按钮，打开公众号页面时也能一键采集
   （这部分其实现有插件已经能做，只是图片可能坏）。
4. **如果路线 E 跑顺了，再决定是否投入路线 A** 做"真机器人"。

## 待用户拍板的 3 个问题

1. **MVP 先做 E 还是 A？** （我倾向 E，但 A 体验更顺滑）
2. **图片要不要下载到本地？** （推荐"要"，仓库体积换稳定性）
3. **source 命名用 `wechat` 还是 `wechat-mp`？** （我倾向 `wechat`）
