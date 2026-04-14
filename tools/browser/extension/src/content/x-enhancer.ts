/**
 * X (Twitter) 增强模块 - Content Script
 *
 * 功能：
 * 1. 监听 Like/Bookmark 操作
 * 2. 提取 Tweet 数据
 * 3. 调用 Gateway 采集
 *
 * @module content/x-enhancer
 */

import { collectViaBackground } from '../services/gateway';
import { getLogger } from '../utils/logger';
import { showSuccessToast, showErrorToast } from './toast';

const logger = getLogger('x-enhancer');

// ============================================================================
// 类型定义
// ============================================================================

interface TweetAuthor {
  handle: string;
  displayName: string;
}

interface QuotedTweet {
  tweetId: string | null;
  tweetUrl: string | null;
  author: TweetAuthor | null;
  text: string | null;
}

interface TweetData {
  tweetId: string | null;
  tweetUrl: string | null;
  author: TweetAuthor | null;
  text: string | null;
  timestamp: string | null;
  mediaUrls: string[];
  quotedTweet: QuotedTweet | null;
  articleElement: Element | null;
}

type CollectType = 'likes' | 'bookmarks';

// ============================================================================
// Tweet 数据提取
// ============================================================================

/**
 * 从 article 元素向上查找包含 Tweet 的最近 article
 */
function findTweetArticle(element: Element): HTMLElement | null {
  let current: Element | null = element;
  while (current) {
    if (current.tagName === 'ARTICLE') {
      return current as HTMLElement;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * 提取 Tweet ID
 * 从 a[href*="/status/"] 链接解析
 */
function extractTweetId(article: HTMLElement): string | null {
  const statusLinks = article.querySelectorAll('a[href*="/status/"]');
  logger.debug('Found status links', { count: statusLinks.length });
  for (const statusLink of statusLinks) {
    const href = statusLink.getAttribute('href');
    if (href) {
      const match = href.match(/\/status\/(\d+)/);
      if (match) {
        logger.debug('Extracted tweet ID from link', { href, tweetId: match[1] });
        return match[1];
      }
    }
  }
  logger.warn('Failed to extract tweet ID from article');
  return null;
}

/**
 * 提取 Tweet URL
 * 通过 tweetId + author 构建规范 URL，避免匹配到 /photo/N 等子页面链接
 */
function extractTweetUrl(article: HTMLElement): string | null {
  const tweetId = extractTweetId(article);
  if (!tweetId) {
    logger.warn('Cannot build tweet URL: no tweetId');
    return null;
  }

  const author = extractAuthor(article);
  if (author?.handle) {
    const url = `https://x.com/${author.handle}/status/${tweetId}`;
    logger.debug('Built tweet URL from author+id', { url });
    return url;
  }

  // 兜底：从链接解析，截取到 /status/{id} 为止
  const statusLinks = article.querySelectorAll('a[href*="/status/"]');
  for (const link of statusLinks) {
    const href = link.getAttribute('href');
    if (href) {
      const match = href.match(/^(https?:\/\/[^/]+)?(\/.+\/status\/\d+)/);
      if (match) {
        const path = match[2];
        const url = `https://x.com${path}`;
        logger.debug('Built tweet URL from link fallback', { url, originalHref: href });
        return url;
      }
    }
  }
  logger.warn('Cannot build tweet URL: no valid links found');
  return null;
}

/**
 * 提取作者信息
 * 使用 [data-testid="User-Name"] 选择器
 */
function extractAuthor(article: HTMLElement): TweetAuthor | null {
  const userNameEl = article.querySelector('[data-testid="User-Name"]');
  if (!userNameEl) {
    logger.warn('User-Name element not found in article');
    return null;
  }

  const displayNameSpan = userNameEl.querySelector('span');
  const displayName = displayNameSpan?.textContent?.trim() || '';

  const handleLink = userNameEl.querySelector('a[href^="/"]');
  let handle = '';
  if (handleLink) {
    const href = handleLink.getAttribute('href');
    if (href) {
      handle = href.replace(/^\//, '').split('/')[0];
    }
  }

  logger.debug('Extracted author', { handle, displayName });
  return { handle, displayName };
}

/**
 * 提取推文正文
 * 使用 [data-testid="tweetText"] 选择器
 */
function extractText(article: HTMLElement): string | null {
  const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
  if (tweetTextEl) {
    const text = tweetTextEl.textContent?.trim() || null;
    logger.debug('Extracted text', { length: text?.length, preview: text?.slice(0, 80) });
    return text;
  }
  logger.debug('No tweetText element found');
  return null;
}

/**
 * 提取发布时间
 * 使用 time[datetime] 选择器
 */
function extractTimestamp(article: HTMLElement): string | null {
  const timeEl = article.querySelector('time[datetime]');
  if (timeEl) {
    return timeEl.getAttribute('datetime');
  }
  return null;
}

/**
 * 提取媒体链接
 * 使用 img[src*="twimg"] 选择器
 */
function extractMediaUrls(article: HTMLElement): string[] {
  const mediaUrls: string[] = [];
  const images = article.querySelectorAll('img[src*="twimg"]');
  logger.debug('Found twimg images', { count: images.length });
  
  images.forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !src.includes('profile_images') && !src.includes('emoji')) {
      const originalUrl = src.replace(/&name=\w+$/, '&name=large');
      if (!mediaUrls.includes(originalUrl)) {
        mediaUrls.push(originalUrl);
      }
    }
  });

  const videoThumbnails = article.querySelectorAll('[data-testid="videoPlayer"] img');
  videoThumbnails.forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !mediaUrls.includes(src)) {
      mediaUrls.push(src);
    }
  });

  logger.debug('Extracted media URLs', { count: mediaUrls.length, urls: mediaUrls });
  return mediaUrls;
}

/**
 * 提取引用推文
 */
function extractQuotedTweet(article: HTMLElement): QuotedTweet | null {
  // 引用推文通常在 [data-testid="quoteTweet"] 内
  const quoteContainer = article.querySelector('[data-testid="quoteTweet"]');
  if (!quoteContainer) {
    return null;
  }

  const quotedArticle = quoteContainer as HTMLElement;

  return {
    tweetId: extractTweetId(quotedArticle),
    tweetUrl: extractTweetUrl(quotedArticle),
    author: extractAuthor(quotedArticle),
    text: extractText(quotedArticle),
  };
}

/**
 * 提取完整 Tweet 数据
 */
function extractTweetData(article: HTMLElement): TweetData {
  logger.debug('Extracting tweet data from article');

  const data: TweetData = {
    tweetId: extractTweetId(article),
    tweetUrl: extractTweetUrl(article),
    author: extractAuthor(article),
    text: extractText(article),
    timestamp: extractTimestamp(article),
    mediaUrls: extractMediaUrls(article),
    quotedTweet: extractQuotedTweet(article),
    articleElement: article,
  };

  logger.info('Tweet data extracted', {
    tweetId: data.tweetId,
    author: data.author?.handle,
    hasText: !!data.text,
    mediaCount: data.mediaUrls.length,
    hasQuote: !!data.quotedTweet,
  });

  return data;
}

// ============================================================================
// 采集处理
// ============================================================================

/**
 * 将提取的推文数据构建为 markdown 内容
 */
function buildTweetMarkdown(tweetData: TweetData): string {
  const parts: string[] = [];

  // 正文
  if (tweetData.text) {
    parts.push(tweetData.text);
  }

  // 媒体图片
  if (tweetData.mediaUrls.length > 0) {
    parts.push('');
    for (const url of tweetData.mediaUrls) {
      parts.push(`![](${url})`);
    }
  }

  // 引用推文
  if (tweetData.quotedTweet) {
    const qt = tweetData.quotedTweet;
    parts.push('');
    parts.push('> **引用推文**');
    if (qt.author) {
      const qtUrl = qt.tweetUrl || '';
      parts.push(`> [@${qt.author.handle}](${qtUrl})`);
    }
    if (qt.text) {
      for (const line of qt.text.split('\n')) {
        parts.push(`> ${line}`);
      }
    }
  }

  return parts.join('\n');
}

/**
 * 处理采集操作
 */
async function handleCollect(
  target: Element,
  collectType: CollectType
): Promise<void> {
  logger.info('Handling collect', { collectType });

  // 找到包含的 article
  const article = findTweetArticle(target);
  if (!article) {
    logger.error('Could not find tweet article');
    showErrorToast('采集失败：找不到推文');
    return;
  }

  // 提取数据
  const tweetData = extractTweetData(article);

  if (!tweetData.tweetId || !tweetData.tweetUrl) {
    logger.error('Missing required tweet data', {
      hasTweetId: !!tweetData.tweetId,
      hasTweetUrl: !!tweetData.tweetUrl,
    });
    showErrorToast('采集失败：无法提取推文 ID');
    return;
  }

  // 构建标题：取正文首行，去除换行
  const firstLine = (tweetData.text || '').split('\n').filter(Boolean)[0] || '';
  const title = firstLine
    ? firstLine.slice(0, 100) + (firstLine.length > 100 ? '...' : '')
    : `Tweet by @${tweetData.author?.handle || 'unknown'}`;

  // 构建结构化 markdown 内容
  const content = buildTweetMarkdown(tweetData);

  logger.info('Collect payload prepared', {
    title,
    url: tweetData.tweetUrl,
    contentLength: content.length,
    contentPreview: content.slice(0, 200),
    author: tweetData.author?.handle,
    collectType,
  });

  // 发送到 Gateway
  const result = await collectViaBackground({
    title,
    url: tweetData.tweetUrl,
    content,
    source: 'x',
    format: 'markdown',
    author: tweetData.author?.handle,
    collect_type: collectType,
  });

  logger.info('Collect result', {
    success: result.success,
    error: result.error,
    id: result.id,
  });

  if (result.success) {
    showSuccessToast(`已${collectType === 'likes' ? '喜欢' : '收藏'}`);
  } else {
    showErrorToast(`采集失败: ${result.error}`);
  }
}

// ============================================================================
// MutationObserver 监听
// ============================================================================

/**
 * 防抖：避免同一推文短时间内重复采集
 */
const recentlyCollected = new Set<string>();
const DEBOUNCE_MS = 2000;

function shouldCollect(tweetId: string): boolean {
  if (recentlyCollected.has(tweetId)) {
    logger.debug('Tweet recently collected, skipping', { tweetId });
    return false;
  }
  
  recentlyCollected.add(tweetId);
  setTimeout(() => recentlyCollected.delete(tweetId), DEBOUNCE_MS);
  return true;
}

/**
 * 处理 MutationObserver 回调
 */
function handleMutations(mutations: MutationRecord[]): void {
  for (const mutation of mutations) {
    if (
      mutation.type !== 'attributes' ||
      mutation.attributeName !== 'data-testid'
    ) {
      continue;
    }

    const target = mutation.target as Element;
    const newTestId = target.getAttribute('data-testid');

    // 检测 Like 操作：like -> unlike
    if (newTestId === 'unlike') {
      logger.info('Like operation detected');
      
      // 获取 tweetId 进行防抖
      const article = findTweetArticle(target);
      if (article) {
        const tweetId = extractTweetId(article);
        if (tweetId && shouldCollect(`like-${tweetId}`)) {
          handleCollect(target, 'likes');
        }
      }
    }

    // 检测 Bookmark 操作：bookmark -> removeBookmark
    if (newTestId === 'removeBookmark') {
      logger.info('Bookmark operation detected');
      
      const article = findTweetArticle(target);
      if (article) {
        const tweetId = extractTweetId(article);
        if (tweetId && shouldCollect(`bookmark-${tweetId}`)) {
          handleCollect(target, 'bookmarks');
        }
      }
    }
  }
}

/**
 * 初始化 MutationObserver
 */
function initObserver(): void {
  logger.info('Initializing MutationObserver');

  const observer = new MutationObserver(handleMutations);

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-testid'],
    subtree: true,
  });

  logger.info('MutationObserver started');
}

// ============================================================================
// 初始化
// ============================================================================

function init(): void {
  logger.info('X Enhancer Content Script initializing', {
    url: window.location.href,
  });

  // 等待 DOM 准备就绪
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }

  logger.info('X Enhancer initialized');
}

// 启动
init();
