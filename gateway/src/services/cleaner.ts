/**
 * HTML 内容清洗
 * 使用 Readability 提取正文，Turndown 转换为 Markdown
 */

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import { createLogger } from './logger.js';

const log = createLogger('cleaner');

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// 移除不必要的元素
turndown.remove(['script', 'style', 'nav', 'footer', 'aside', 'iframe']);

export interface CleanResult {
  title: string;
  content: string;
  excerpt?: string;
}

/**
 * 将 HTML 片段包装为完整文档，确保 Readability 能正常解析
 */
function wrapAsDocument(html: string): string {
  const trimmed = html.trim();
  if (trimmed.toLowerCase().startsWith('<!doctype') || trimmed.toLowerCase().startsWith('<html')) {
    return trimmed;
  }
  return `<!DOCTYPE html><html><head><title></title></head><body>${trimmed}</body></html>`;
}

/**
 * 清洗 HTML 内容
 */
export function clean(html: string, originalTitle?: string): CleanResult {
  const wrappedHtml = wrapAsDocument(html);
  const { document } = parseHTML(wrappedHtml);

  // Readability 可能在非标准 DOM 上抛异常，需要兜底
  let article: ReturnType<Readability['parse']> = null;
  try {
    const reader = new Readability(document);
    article = reader.parse();
  } catch (err) {
    log.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Readability parse failed, falling back to turndown'
    );
  }

  if (!article) {
    const markdown = turndown.turndown(html);
    return {
      title: originalTitle || 'Untitled',
      content: markdown,
    };
  }
  
  const markdown = turndown.turndown(article.content);
  
  return {
    title: article.title || originalTitle || 'Untitled',
    content: markdown,
    excerpt: article.excerpt || undefined,
  };
}
