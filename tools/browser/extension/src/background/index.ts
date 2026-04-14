/**
 * Background Service Worker
 * Manifest V3 的后台服务
 *
 * 职责：
 * 1. 代理 content script 的 Gateway 请求（绕过 CORS）
 * 2. 处理扩展生命周期事件
 */

import { getLogger } from '../utils/logger';
import { collect, checkGatewayHealth } from '../services/gateway';
import type { GatewayMessage } from '../services/gateway';

const logger = getLogger('background');

logger.info('Service worker started');

chrome.runtime.onInstalled.addListener((details) => {
  logger.info('Extension installed', { reason: details.reason });
});

// 处理来自 content script 的消息
chrome.runtime.onMessage.addListener((message: GatewayMessage, sender, sendResponse) => {
  logger.debug('Received message', {
    type: message.type,
    from: sender.tab?.url,
  });

  if (message.type === 'GATEWAY_COLLECT') {
    collect(message.payload).then(sendResponse);
    return true; // 异步响应，保持消息通道打开
  }

  if (message.type === 'GATEWAY_HEALTH') {
    checkGatewayHealth().then(sendResponse);
    return true;
  }

  return false;
});

export {};
