import * as esbuild from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, 'dist');

// 清理并创建输出目录
rmSync(dist, { recursive: true, force: true });
mkdirSync(resolve(dist, 'content'), { recursive: true });
mkdirSync(resolve(dist, 'icons'), { recursive: true });

const sharedOptions = {
  bundle: true,
  sourcemap: true,
  minify: false,
  target: 'es2022',
  define: {
    'process.env.NODE_ENV': '"development"',
  },
};

// Content Scripts — IIFE 格式（不支持 ES modules）
const contentBuild = esbuild.build({
  ...sharedOptions,
  entryPoints: [
    resolve(__dirname, 'src/content/collect-button.ts'),
    resolve(__dirname, 'src/content/x-enhancer.ts'),
  ],
  outdir: resolve(dist, 'content'),
  format: 'iife',
});

// Background Service Worker — ESM 格式
const backgroundBuild = esbuild.build({
  ...sharedOptions,
  entryPoints: [resolve(__dirname, 'src/background/index.ts')],
  outfile: resolve(dist, 'background.js'),
  format: 'esm',
});

// Popup — ESM 格式
const popupBuild = esbuild.build({
  ...sharedOptions,
  entryPoints: [resolve(__dirname, 'src/popup/index.ts')],
  outfile: resolve(dist, 'popup.js'),
  format: 'esm',
});

// 并行构建所有入口
await Promise.all([contentBuild, backgroundBuild, popupBuild]);

// 复制静态文件
cpSync(resolve(__dirname, 'manifest.json'), resolve(dist, 'manifest.json'));
cpSync(resolve(__dirname, 'popup.html'), resolve(dist, 'popup.html'));
cpSync(resolve(__dirname, 'icons'), resolve(dist, 'icons'), { recursive: true });
cpSync(resolve(__dirname, 'src/content/styles.css'), resolve(dist, 'content/styles.css'));

console.log('✅ Build complete');
