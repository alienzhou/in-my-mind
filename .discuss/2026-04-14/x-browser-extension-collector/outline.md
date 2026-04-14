# X 浏览器插件采集方案探讨

## 🔵 Current Focus
(Empty - 讨论完成)

## ⚪ Pending
(Empty)

## ✅ Confirmed
- **监听 Like/Bookmark 技术可行**：X 页面使用 `data-testid` 属性标识按钮状态
  - 喜欢按钮：`[data-testid="like"]` → `[data-testid="unlike"]`
  - 书签按钮：`[data-testid="bookmark"]` → `[data-testid="removeBookmark"]`
  - 推荐方案：MutationObserver 监听 `data-testid` 属性变化
  - 获取 Tweet ID：通过 `a[href*="/status/"]` 链接提取

- **采用混合方案**：
  - 插件前端：提取关键字段（text, author, id, images, timestamp 等）
  - 同时保留原始 HTML：作为备份供 Gateway 做深度处理
  - 好处：即时可用的结构化数据 + 不丢失原始信息

- **字段清单确定**：tweetId, tweetUrl, author, text, timestamp, mediaUrls, quotedTweet

- **长推文处理策略**：用户确认式展开
  - 检测到长推文（未展开状态）时，弹出浮窗询问用户
  - 用户确认 → 自动点击展开 → 等待 DOM 更新 → 采集完整内容
  - 用户取消 → 不处理
  - 技术要点：展开是异步的，需要 MutationObserver 等待内容加载完成
  - 浮窗位置：在点击的 Like/Bookmark 按钮附近弹出
  - Like 和 Bookmark 共用同样的逻辑

- **引用推文处理**：嵌套提取，保持结构（不需要额外确认逻辑）

- **浮窗设计**：两套 UI
  - **临时浮窗**：长推文确认（在按钮附近弹出，操作后消失）
  - **常驻浮窗**：快捷采集功能区（右下角/左下角吸附）

- **插件定位**：通用网页收藏器 + X 增强
  - 通用功能：任意网页一键采集到 bookmarks 分类
  - X 增强：监听 Like/Bookmark 自动采集到 X 分类

- **常驻浮窗**：极简单按钮（方案 A）
  - 一个图标，点击 = 采集当前页到 bookmarks
  - 后续可扩展：长按/右键展开分类选择

- **Gateway 集成**：现有接口完全满足需求
  - 接口：`POST /api/v1/collect`
  - Payload：`{ title, url, content, source, format, tags, author, collect_type }`
  - HTML 清洗：`format: 'html'` 时自动使用 Readability + Turndown 转换
  - 去重：基于 normalizedUrl 自动去重

- **分类存储**：
  - X Like/Bookmark → `source: 'x'` → `raw/x/`
  - 通用网页采集 → `source: 'bookmarks'` → `raw/bookmarks/`
  - 通过 `collect_type` 字段区分子类型（likes/bookmarks），但不影响存储路径

- **UI 细节**：
  - 常驻浮窗位置：右下角
  - 采集成功反馈：toast 提示

## ❌ Rejected
(Empty initially)

---

## 背景

用户原本通过 X API 采集 Likes/Bookmarks，但遇到两个阻碍：
1. API 需要 OAuth 2.0 用户授权（User Context Token）
2. 免费额度（credits）已用完，付费订阅 $100/月起

因此探索浏览器插件方案作为替代。

## 设想流程

1. **采集与清理**：插件把页面 HTML 发给 Gateway，利用 Gateway 的 HTML 清理功能得到完整内容
2. **信息抽取**：前端做简单信息抽取（title, author 等）
3. **分类存储**：
   - X 内容自动进入 X 分类
   - 插件提供快捷功能（右下角/左下角浮窗），点击采集当前网页进入 bookmarks 分类
