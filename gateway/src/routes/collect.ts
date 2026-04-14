import { Hono } from 'hono';
import type { CollectPayload, CollectResponse } from '../types/payload.js';
import { normalize, inferSource } from '../services/normalize.js';
import { exists, record } from '../services/dedup.js';
import { clean } from '../services/cleaner.js';
import { store } from '../services/storage.js';
import { trigger } from '../services/indexer.js';
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
  
  log.info({ url: payload.url, title: payload.title?.slice(0, 50) }, 'Collect request received');
  
  // 校验必填字段
  if (!payload.title || !payload.url || !payload.content) {
    log.warn({ url: payload.url }, 'Missing required fields');
    const response: CollectResponse = {
      status: 'error',
      message: 'Missing required fields: title, url, content',
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
    // 4. 内容处理
    let title = payload.title;
    let content = payload.content;
    
    if (payload.format === 'html') {
      try {
        const cleaned = clean(payload.content, payload.title);
        title = cleaned.title;
        content = cleaned.content;
      } catch (cleanError) {
        log.warn(
          { error: cleanError instanceof Error ? cleanError.message : String(cleanError), url: payload.url },
          'HTML cleaning failed, falling back to raw content'
        );
        // 清洗失败时使用原始内容，不阻塞采集流程
        content = payload.content;
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
