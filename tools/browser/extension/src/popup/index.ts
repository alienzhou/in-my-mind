/**
 * Popup 脚本
 * 处理弹出窗口的交互逻辑
 */

import { collect, createBookmarkPayload, checkGatewayHealth } from '../services/gateway';
import { getLogger } from '../utils/logger';

const logger = getLogger('popup');

logger.info('Script loaded');

/**
 * 更新状态显示
 */
function updateStatus(connected: boolean): void {
  const statusEl = document.getElementById('status');
  const statusDot = document.getElementById('status-dot');
  
  if (statusEl && statusDot) {
    statusEl.textContent = connected ? 'GATEWAY: CONNECTED' : 'GATEWAY: OFFLINE';
    if (connected) {
      statusDot.classList.add('connected');
    } else {
      statusDot.classList.remove('connected');
    }
  }
}

/**
 * 更新按钮状态
 */
function setButtonLoading(loading: boolean): void {
  const button = document.getElementById('collect-btn') as HTMLButtonElement;
  if (button) {
    button.disabled = loading;
    button.innerHTML = loading 
      ? `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1.2s linear infinite;">
          <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
        <span>COLLECTING...</span>
      `
      : `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>COLLECT THIS PAGE</span>
      `;
  }
}

/**
 * 显示消息
 */
function showMessage(text: string, isError: boolean = false): void {
  const messageEl = document.getElementById('message');
  if (messageEl) {
    messageEl.textContent = text;
    messageEl.style.color = isError ? '#ef4444' : '#612c19';
    messageEl.style.borderColor = isError ? '#ef4444' : '#612c19';
    messageEl.style.display = 'block';
    
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 3000);
  }
}

/**
 * 采集当前页面
 */
async function collectCurrentPage(): Promise<void> {
  logger.info('Collecting current page');
  setButtonLoading(true);

  try {
    // 获取当前 tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id || !tab.url) {
      showMessage('无法获取当前页面信息', true);
      return;
    }

    // 在当前 tab 执行脚本获取页面内容
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title,
        url: window.location.href,
        html: document.documentElement.outerHTML,
      }),
    });

    const pageData = results[0]?.result;
    if (!pageData) {
      showMessage('无法获取页面内容', true);
      return;
    }

    // 发送采集请求
    const payload = createBookmarkPayload(pageData);
    const result = await collect(payload);

    if (result.success) {
      const msg = result.data?.isDuplicate ? '已存在相同内容' : '采集成功！';
      showMessage(msg);
    } else {
      showMessage(result.message, true);
    }
  } catch (error) {
    logger.error('Collect error', { error });
    const message = error instanceof Error ? error.message : '采集失败';
    showMessage(message, true);
  } finally {
    setButtonLoading(false);
  }
}

/**
 * 初始化
 */
async function init(): Promise<void> {
  // 检查 Gateway 连接
  const connected = await checkGatewayHealth();
  updateStatus(connected);

  // 绑定采集按钮
  const collectBtn = document.getElementById('collect-btn');
  collectBtn?.addEventListener('click', collectCurrentPage);
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
