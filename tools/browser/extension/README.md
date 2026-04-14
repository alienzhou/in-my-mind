# In My Mind - Browser Extension

浏览器内容采集器，支持 X 平台增强和通用网页收藏。

## 功能特性

- **X 增强**: 自动监听 Like/Bookmark 操作并采集推文
- **通用采集**: 一键采集任意网页内容

## 项目结构

```
extension/
├── manifest.json          # Chrome Extension 配置 (Manifest V3)
├── package.json           # 项目依赖
├── tsconfig.json          # TypeScript 配置
├── vite.config.ts         # Vite 构建配置
├── popup.html             # 弹出窗口 HTML
├── icons/                 # 扩展图标
└── src/
    ├── background/        # Service Worker
    │   └── index.ts
    ├── content/           # Content Scripts
    │   ├── x-enhancer.ts  # X 平台增强
    │   └── styles.css
    ├── popup/             # Popup UI
    │   └── index.ts
    ├── services/          # 服务层
    │   └── gateway.ts     # Gateway 通信
    ├── ui/                # UI 组件
    │   └── toast.ts       # Toast 通知
    └── utils/             # 工具函数
        └── logger.ts      # 日志工具
```

## 开发指南

### 安装依赖

```bash
cd tools/browser/extension
npm install
```

### 构建

```bash
# 开发模式 (监听变化)
npm run dev

# 生产构建
npm run build
```

### 加载扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `tools/browser/extension` 目录

### 图标

需要添加以下尺寸的图标到 `icons/` 目录:
- icon16.png (16x16)
- icon32.png (32x32)
- icon48.png (48x48)
- icon128.png (128x128)

## 配置

Gateway 地址默认为 `http://localhost:3020`，可在 `src/services/gateway.ts` 中修改。

## API

### Gateway 接口

`POST /api/v1/collect`

```typescript
interface CollectPayload {
  title: string;          // 页面标题
  url: string;            // 页面 URL
  content: string;        // HTML 内容
  source: 'x' | 'bookmarks';
  format: 'html';
  tags: string[];
  author?: string;
  collect_type: 'likes' | 'bookmarks' | 'manual';
}
```

## 技术栈

- **Manifest V3**: Chrome Extension 最新标准
- **TypeScript**: 类型安全
- **Vite**: 现代构建工具
