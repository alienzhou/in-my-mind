/**
 * Toast 提示组件
 *
 * 在页面右下角显示临时通知，自动消失
 *
 * @module content/toast
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('toast');

/** Toast 类型 */
export type ToastType = 'success' | 'error' | 'info';

/** Toast 配置 */
export interface ToastOptions {
  /** 消息内容 */
  message: string;
  /** 类型，影响样式 */
  type?: ToastType;
  /** 显示时长 (毫秒)，默认 2500ms */
  duration?: number;
}

/** Toast 容器 ID */
const TOAST_CONTAINER_ID = 'imc-toast-container';

/** Toast 样式 - 使用内联避免与页面样式冲突 */
const TOAST_STYLES = {
  container: `
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  `,
  toast: `
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    pointer-events: auto;
    max-width: 300px;
    word-break: break-word;
  `,
  visible: `
    opacity: 1;
    transform: translateX(0);
  `,
  success: `
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  `,
  error: `
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
  `,
  info: `
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
  `,
};

/**
 * 获取或创建 Toast 容器
 */
function getOrCreateContainer(): HTMLElement {
  let container = document.getElementById(TOAST_CONTAINER_ID);

  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.style.cssText = TOAST_STYLES.container;
    document.body.appendChild(container);
    logger.debug('Created toast container');
  }

  return container;
}

/**
 * 显示 Toast 提示
 *
 * @param options Toast 配置或消息字符串
 * @example
 * showToast('✓ 已采集');
 * showToast({ message: '采集失败', type: 'error' });
 */
export function showToast(options: ToastOptions | string): void {
  const opts: ToastOptions =
    typeof options === 'string' ? { message: options } : options;

  const { message, type = 'success', duration = 2500 } = opts;

  logger.info('Showing toast', { message, type, duration });

  const container = getOrCreateContainer();

  // 创建 toast 元素
  const toast = document.createElement('div');
  toast.style.cssText = TOAST_STYLES.toast + TOAST_STYLES[type];
  toast.textContent = message;

  container.appendChild(toast);

  // 触发进入动画
  requestAnimationFrame(() => {
    toast.style.cssText = TOAST_STYLES.toast + TOAST_STYLES[type] + TOAST_STYLES.visible;
  });

  // 自动移除
  setTimeout(() => {
    toast.style.cssText = TOAST_STYLES.toast + TOAST_STYLES[type];

    // 等待退出动画完成后移除元素
    setTimeout(() => {
      toast.remove();
      logger.debug('Toast removed');

      // 如果容器为空，也移除容器
      if (container.childElementCount === 0) {
        container.remove();
        logger.debug('Toast container removed');
      }
    }, 300);
  }, duration);
}

/**
 * 显示成功 Toast
 */
export function showSuccessToast(message: string, duration?: number): void {
  showToast({ message, type: 'success', duration });
}

/**
 * 显示错误 Toast
 */
export function showErrorToast(message: string, duration?: number): void {
  showToast({ message, type: 'error', duration });
}

/**
 * 显示信息 Toast
 */
export function showInfoToast(message: string, duration?: number): void {
  showToast({ message, type: 'info', duration });
}
