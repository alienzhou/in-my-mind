/**
 * Gateway 服务 - 与后端 Gateway 通信
 *
 * 提供两套 API：
 * - 直接调用（collect / checkGatewayHealth）：供 background、popup 使用
 * - 消息代理（collectViaBackground / checkHealthViaBackground）：供 content script 使用，
 *   通过 chrome.runtime.sendMessage 委托 background 执行，绕过 CORS 限制
 *
 * @module services/gateway
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('gateway');

const GATEWAY_BASE = 'http://localhost:3020';
const GATEWAY_URL = `${GATEWAY_BASE}/api/v1/collect`;
const HEALTH_URL = `${GATEWAY_BASE}/api/v1/health`;

export interface CollectPayload {
  title: string;
  url: string;
  content: string;
  source: 'x' | 'bookmarks';
  format: 'html' | 'markdown';
  tags?: string[];
  author?: string;
  collect_type: 'likes' | 'bookmarks' | 'manual';
}

export interface CollectResponse {
  success: boolean;
  id?: string;
  message?: string;
  error?: string;
  data?: {
    isDuplicate?: boolean;
  };
}

/** content script → background 消息协议 */
export type GatewayMessage =
  | { type: 'GATEWAY_COLLECT'; payload: CollectPayload }
  | { type: 'GATEWAY_HEALTH' };

// ============================================================================
// 直接调用（background / popup 使用）
// ============================================================================

/**
 * 检查 Gateway 健康状态
 */
export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 创建通用书签采集 Payload
 */
export function createBookmarkPayload(pageData: {
  title: string;
  url: string;
  html: string;
}): CollectPayload {
  return {
    title: pageData.title,
    url: pageData.url,
    content: pageData.html,
    source: 'bookmarks',
    format: 'html',
    collect_type: 'manual',
  };
}

/**
 * 发送采集数据到 Gateway
 */
export async function collect(payload: CollectPayload): Promise<CollectResponse> {
  logger.info('Sending collect request', {
    url: payload.url,
    source: payload.source,
    collect_type: payload.collect_type,
  });

  try {
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorDetail = data.message || data.error || `HTTP ${response.status}`;
      logger.error('Gateway request failed', {
        status: response.status,
        error: errorDetail,
      });
      return {
        success: false,
        error: errorDetail,
      };
    }

    logger.info('Collect successful', { id: data.id });
    return {
      success: true,
      id: data.id,
      message: data.message,
      data: data.data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gateway request error', { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// 消息代理（content script 使用，绕过 CORS）
// ============================================================================

/**
 * 通过 background 代理发送采集请求
 *
 * Content script 无法直接 fetch localhost（CORS），
 * 所以通过 chrome.runtime.sendMessage 委托 background 执行
 */
export async function collectViaBackground(payload: CollectPayload): Promise<CollectResponse> {
  logger.info('Sending collect request via background', {
    url: payload.url,
    source: payload.source,
    collect_type: payload.collect_type,
  });

  try {
    const message: GatewayMessage = { type: 'GATEWAY_COLLECT', payload };
    const response: CollectResponse = await chrome.runtime.sendMessage(message);
    if (response.success) {
      logger.info('Collect via background successful', { id: response.id });
    } else {
      logger.error('Collect via background failed', { error: response.error });
    }
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Message to background failed', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * 通过 background 代理检查 Gateway 健康状态
 */
export async function checkHealthViaBackground(): Promise<boolean> {
  try {
    const message: GatewayMessage = { type: 'GATEWAY_HEALTH' };
    return await chrome.runtime.sendMessage(message);
  } catch {
    return false;
  }
}
