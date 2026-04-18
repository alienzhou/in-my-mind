/**
 * 文件存储服务
 * 将内容写入 raw/{source}/{date}/{slug}.md
 */

import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { config } from '../config.js';
import { createLogger } from './logger.js';

const log = createLogger('storage');

/**
 * 生成安全的文件名 slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\//g, '_') // 将 owner/repo 格式中的 / 替换为 _
    .replace(/[^\w\s\u4e00-\u9fa5-]/g, '') // 保留字母、数字、中文、空格、连字符
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled';
}

/**
 * 生成 YAML frontmatter
 */
function generateFrontmatter(meta: {
  title: string;
  url: string;
  source: string;
  tags?: string[];
  author?: string;
  collectedAt: string;
}): string {
  const lines = [
    '---',
    `title: "${meta.title.replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()}"`,
    `url: "${meta.url}"`,
    `source: ${meta.source}`,
  ];
  
  if (meta.author) {
    lines.push(`author: "${meta.author.replace(/"/g, '\\"')}"`);
  }
  
  if (meta.tags && meta.tags.length > 0) {
    lines.push(`tags: [${meta.tags.map(t => `"${t}"`).join(', ')}]`);
  }
  
  lines.push(`collected_at: ${meta.collectedAt}`);
  lines.push('---');
  
  return lines.join('\n');
}

/**
 * 存储内容到文件
 * @returns 文件相对路径
 */
export function store(options: {
  title: string;
  content: string;
  url: string;
  source: string;
  tags?: string[];
  author?: string;
  collectedAt?: number;  // 毫秒时间戳
  collectType?: string;  // 采集类型：likes / bookmarks / reposts
}): string {
  const now = options.collectedAt ? new Date(options.collectedAt) : new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const collectedAt = now.toISOString();
  
  // 生成文件路径
  const slug = slugify(options.title);
  const fileName = `${slug}.md`;
  const relativePath = `${options.source}/${dateStr}/${fileName}`;
  const fullPath = resolve(config.rawDir, relativePath);
  
  // 确保目录存在
  const dir = dirname(fullPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    log.debug({ dir }, 'Directory created');
  }
  
  // 处理文件名冲突
  let finalPath = fullPath;
  let finalRelativePath = relativePath;
  let counter = 1;
  while (existsSync(finalPath)) {
    const newFileName = `${slug}-${counter}.md`;
    finalRelativePath = `${options.source}/${dateStr}/${newFileName}`;
    finalPath = resolve(config.rawDir, finalRelativePath);
    counter++;
  }
  
  // 生成 frontmatter
  const frontmatter = generateFrontmatter({
    title: options.title,
    url: options.url,
    source: options.source,
    tags: options.tags,
    author: options.author,
    collectedAt,
  });
  
  // 写入文件
  const fileContent = `${frontmatter}\n\n${options.content}`;
  writeFileSync(finalPath, fileContent, 'utf-8');
  
  log.info({ path: finalRelativePath, size: fileContent.length }, 'File written');
  
  return finalRelativePath;
}
