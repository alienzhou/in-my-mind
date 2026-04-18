import { Hono } from 'hono';
import type { CollectPayload, CollectResponse } from '../types/payload.js';
import { normalize, inferSource } from '../services/normalize.js';
import { exists, record } from '../services/dedup.js';
import { clean } from '../services/cleaner.js';
import { store } from '../services/storage.js';
import { trigger } from '../services/indexer.js';
import { fetchContent } from '../services/fetcher.js';
import { createLogger } from '../services/logger.js';

const log = createLogger('collect');
const collect = new Hono();

/**
 * POST /api/v1/collect
 * 采集数据入口
 */
collect.post('/', async (c) => {
  let payload: CollectPayload;
  
  try {
    payload = await c.req.json<CollectPayload>();
  } catch {
    log.warn({ error: 'Invalid JSON payload' }, 'Request parse failed');
    const response: CollectResponse = {
      status: 'error',
      message: 'Invalid JSON payload',
    };
    return c.json(response, 400);
  }
  
  log.info({ url: payload.url, title: payload.title?.slice(0, 50), format: payload.format }, 'Collect request received');
  
  // 校验必填字段
  // - url-only 模式：只需要 url
  // - 其他模式：需要 url 和 content
  if (!payload.url) {
    log.warn({ url: payload.url }, 'Missing required field: url');
    const response: CollectResponse = {
      status: 'error',
      message: 'Missing required field: url',
    };
    return c.json(response, 400);
  }
  
  if (payload.format !== 'url-only' && !payload.content) {
    log.warn({ url: payload.url }, 'Missing required field: content');
    const response: CollectResponse = {
      status: 'error',
      message: 'Missing required field: content',
    };
    return c.json(response, 400);
  }
  
  // 1. URL 规范化
  const normalizedUrl = normalize(payload.url);
  
  // 2. 去重检查
  if (exists(normalizedUrl)) {
    log.debug({ normalizedUrl }, 'Content skipped (duplicate)');
    const response: CollectResponse = {
      status: 'skipped',
      message: 'Content already collected',
      normalizedUrl,
    };
    return c.json(response, 200);
  }
  
  // 3. 确定 source
  const source = payload.source || inferSource(normalizedUrl);
  
  try {
    // 4. 获取/处理内容
    let title = payload.title || '';
    let content = payload.content || '';
    
    // url-only 模式：Gateway 自动获取内容
    // 注意：使用原始 URL fetch，使用规范化 URL 去重和存储
    if (payload.format === 'url-only') {
      log.info({ originalUrl: payload.url, normalizedUrl }, 'url-only mode: fetching content from remote');
      
      try {
        // 使用原始 URL fetch，保留 PDF 等二进制内容
        const fetched = await fetchContent(payload.url);
        content = fetched.content;
        
        // 如果有提取到标题且原 title 为空，使用提取的标题
        if (fetched.title && !title) {
          title = fetched.title;
        }
        
        log.info({ 
          url: normalizedUrl, 
          title: title?.slice(0, 50),
          contentLength: content.length,
          contentType: fetched.contentType 
        }, 'Content fetched successfully');
      } catch (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        log.error({ url: normalizedUrl, error: errorMsg }, 'Failed to fetch content');
        
        const response: CollectResponse = {
          status: 'error',
          message: `Failed to fetch content: ${errorMsg}`,
        };
        return c.json(response, 500);
      }
    } else if (payload.format === 'html') {
      // HTML 模式：使用 Readability 清洗
      try {
        const cleaned = clean(content, title);
        title = cleaned.title;
        content = cleaned.content;
      } catch (cleanError) {
        log.warn(
          { error: cleanError instanceof Error ? cleanError.message : String(cleanError), url: payload.url },
          'HTML cleaning failed, falling back to raw content'
        );
        // 清洗失败时使用原始内容，不阻塞采集流程
      }
    }
    
    // 标题 fallback：如果仍然为空，使用 URL 路径的最后一部分
    if (!title || title.trim() === '') {
      try {
        const urlPath = new URL(normalizedUrl).pathname;
        const lastSegment = urlPath.split('/').filter(Boolean).pop() || 'Untitled';
        title = lastSegment;
        log.info({ normalizedUrl, fallbackTitle: title }, 'Using fallback title');
      } catch {
        title = 'Untitled';
      }
    }
    
    // 5. 存储
    const filePath = store({
      title,
      content,
      url: normalizedUrl,
      source,
      tags: payload.tags,
      author: payload.author,
      collectedAt: payload.collected_at,
      collectType: payload.collect_type,
    });
    
    log.info({ normalizedUrl, filePath, source }, 'Content stored');
    
    // 6. 记录去重
    record(normalizedUrl, source, filePath, payload.collected_at);
    
    // 7. 触发索引（传入 source 用于自动创建 collection）
    trigger(source);
    
    const response: CollectResponse = {
      status: 'created',
      message: 'Content collected successfully',
      filePath,
      normalizedUrl,
    };
    return c.json(response, 201);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error({ error: errorMessage, url: payload.url, source }, 'Collect processing failed');
    const response: CollectResponse = {
      status: 'error',
      message: errorMessage,
    };
    return c.json(response, 500);
  }
});

export { collect };
