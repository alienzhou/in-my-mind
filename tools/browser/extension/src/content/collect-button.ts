/**
 * 常驻浮窗采集按钮组件
 *
 * 交互设计：
 * - 按钮贴着屏幕左侧或右侧边缘，平时只露出约一半（图标+部分文字）
 * - 贴边侧无圆角（平切），露出侧有圆角，形成"标签页/抽屉把手"造型
 * - Hover 时平滑滑出完整内容，松开后缩回
 * - 支持拖拽到屏幕任意位置，松手后自动吸附最近的左/右边缘
 *
 * @module content/collect-button
 */

import { getLogger } from '../utils/logger';
import { collectViaBackground, CollectPayload } from '../services/gateway';
import { showSuccessToast, showErrorToast } from './toast';

const logger = getLogger('collect-button');

const COLLECT_BUTTON_ID = 'imc-collect-button';
const STYLE_TAG_ID = 'imc-collect-button-styles';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

/** 平时露出的宽度（px） */
const PEEK_WIDTH = 48;

const INJECTED_STYLES = `
  @keyframes imc-spin {
    to { transform: rotate(360deg); }
  }

  .imc-spin {
    animation: imc-spin 1.2s linear infinite;
  }

  .imc-collect-btn {
    position: fixed;
    height: 36px;
    padding: 0 14px;
    border: 2px solid #612c19;
    cursor: pointer;
    z-index: 2147483646;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 1.5px;
    box-shadow: 3px 3px 0px rgba(97, 44, 25, 0.15);
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    white-space: nowrap;
    opacity: 0.55;
    border-radius: 18px;
  }

  /* ===== 吸附右侧：左圆角 + 右平切 ===== */
  .imc-snapped-right:not(.imc-dragging) {
    border-radius: 18px 0 0 18px;
    border-right: none;
    transform: translateX(calc(100% - ${PEEK_WIDTH}px));
    /* 收回时加 0.15s 延迟，防止鼠标略微移出就触发抖动 */
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.12s,
                opacity 0.25s 0.12s,
                background-color 0.2s, color 0.2s, box-shadow 0.2s;
  }
  .imc-snapped-right:hover:not(.imc-dragging) {
    transform: translateX(0);
    opacity: 1;
    box-shadow: 4px 4px 0px rgba(97, 44, 25, 0.25);
    /* 伸出时无延迟，立即响应 */
    transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1) 0s,
                opacity 0.15s 0s,
                background-color 0.2s, color 0.2s, box-shadow 0.2s;
  }

  /* ===== 吸附左侧：右圆角 + 左平切 ===== */
  .imc-snapped-left:not(.imc-dragging) {
    border-radius: 0 18px 18px 0;
    border-left: none;
    transform: translateX(calc(-100% + ${PEEK_WIDTH}px));
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.12s,
                opacity 0.25s 0.12s,
                background-color 0.2s, color 0.2s, box-shadow 0.2s;
  }
  .imc-snapped-left:hover:not(.imc-dragging) {
    transform: translateX(0);
    opacity: 1;
    box-shadow: 4px 4px 0px rgba(97, 44, 25, 0.25);
    transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1) 0s,
                opacity 0.15s 0s,
                background-color 0.2s, color 0.2s, box-shadow 0.2s;
  }

  /* ===== 状态配色 ===== */
  .imc-collect-btn.imc-state-idle {
    background: #f5ebd5;
    color: #612c19;
  }
  .imc-collect-btn.imc-state-loading {
    background: #e5e5e5;
    color: #666;
    border-color: #666;
    cursor: wait;
    opacity: 1 !important;
    box-shadow: 3px 3px 0px rgba(0, 0, 0, 0.1);
  }
  .imc-collect-btn.imc-state-success {
    background: #d1e7dd;
    color: #0f5132;
    border-color: #0f5132;
    opacity: 1 !important;
    box-shadow: 3px 3px 0px rgba(15, 81, 50, 0.2);
  }
  .imc-collect-btn.imc-state-error {
    background: #f8d7da;
    color: #842029;
    border-color: #842029;
    opacity: 1 !important;
    box-shadow: 3px 3px 0px rgba(132, 32, 41, 0.2);
  }

  /* ===== 拖拽中 ===== */
  .imc-dragging {
    cursor: grabbing !important;
    opacity: 1 !important;
    border-radius: 18px !important;
    border-width: 2px !important;
    border-style: solid !important;
    transform: scale(1.05) !important;
    box-shadow: 6px 6px 0px rgba(97, 44, 25, 0.3) !important;
    transition: transform 0.1s, box-shadow 0.1s !important;
  }
`;

const BUTTON_CONTENT: Record<ButtonState, string> = {
  idle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>IN MY MIND</span>`,
  loading: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="imc-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg><span>ARCHIVING...</span>`,
  success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>DISTILLED</span>`,
  error: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span>FAILED</span>`,
};

let buttonElement: HTMLButtonElement | null = null;
let currentState: ButtonState = 'idle';

let isDragging = false;
let hasMoved = false;
let dragStartX = 0;
let dragStartY = 0;
let initialLeft = 0;
let initialTop = 0;
let currentSnap: 'left' | 'right' | null = 'right';

function injectStyles() {
  if (document.getElementById(STYLE_TAG_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_TAG_ID;
  style.textContent = INJECTED_STYLES;
  document.head.appendChild(style);
}

function extractAuthor(): string | undefined {
  const authorMeta = document.querySelector('meta[name="author"]');
  if (authorMeta) return authorMeta.getAttribute('content') || undefined;

  const ogAuthor = document.querySelector('meta[property="article:author"]');
  if (ogAuthor) return ogAuthor.getAttribute('content') || undefined;

  const twitterCreator = document.querySelector('meta[name="twitter:creator"]');
  if (twitterCreator) return twitterCreator.getAttribute('content') || undefined;

  return undefined;
}

function updateButtonState(state: ButtonState): void {
  if (!buttonElement) return;

  currentState = state;
  const snapClass = currentSnap ? `imc-snapped-${currentSnap}` : '';
  const dragClass = isDragging ? 'imc-dragging' : '';

  buttonElement.className = `imc-collect-btn imc-state-${state} ${dragClass} ${snapClass}`.trim();
  buttonElement.innerHTML = BUTTON_CONTENT[state];

  logger.debug('Button state updated', { state, currentSnap });
}

/**
 * 吸附到最近的左/右边缘
 *
 * 定位策略：style.left 设为让按钮右缘（或左缘）恰好贴住视口边缘，
 * 然后由 CSS transform 控制"藏多少 / 露多少"。
 */
function snapToEdge() {
  if (!buttonElement) return;

  const width = buttonElement.offsetWidth;
  const height = buttonElement.offsetHeight;
  const currentLeft = parseFloat(buttonElement.style.left || '0');
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const paddingY = 24;

  const centerX = currentLeft + width / 2;
  currentSnap = centerX < viewportWidth / 2 ? 'left' : 'right';

  // 按钮整体刚好贴住屏幕边缘
  const targetLeft = currentSnap === 'left' ? 0 : viewportWidth - width;

  let targetTop = parseFloat(buttonElement.style.top || '0');
  if (targetTop < paddingY) targetTop = paddingY;
  if (targetTop > viewportHeight - height - paddingY) {
    targetTop = viewportHeight - height - paddingY;
  }

  buttonElement.style.left = `${targetLeft}px`;
  buttonElement.style.top = `${targetTop}px`;

  updateButtonState(currentState);
}

async function collectCurrentPage(): Promise<void> {
  if (currentState === 'loading') {
    logger.warn('Collection already in progress');
    return;
  }

  logger.info('Starting page collection', { url: window.location.href });
  updateButtonState('loading');

  try {
    const payload: CollectPayload = {
      title: document.title,
      url: window.location.href,
      content: document.documentElement.outerHTML,
      source: 'bookmarks',
      format: 'html',
      collect_type: 'manual',
      author: extractAuthor(),
    };

    const result = await collectViaBackground(payload);

    if (result.success) {
      logger.info('Collection successful', { id: result.id });
      updateButtonState('success');
      showSuccessToast('✓ 已采集');
    } else {
      logger.error('Collection failed', { error: result.error });
      updateButtonState('error');
      showErrorToast(`✗ 采集失败: ${result.error || '未知错误'}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Collection error', { error: errorMessage });
    updateButtonState('error');
    showErrorToast(`✗ 采集失败: ${errorMessage}`);
  }

  setTimeout(() => {
    updateButtonState('idle');
  }, 2000);
}

function handlePointerDown(e: PointerEvent) {
  if (!buttonElement || e.button !== 0) return;

  isDragging = true;
  hasMoved = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  initialLeft = parseFloat(buttonElement.style.left || '0');
  initialTop = parseFloat(buttonElement.style.top || '0');

  currentSnap = null;
  updateButtonState(currentState);

  buttonElement.setPointerCapture(e.pointerId);
}

function handlePointerMove(e: PointerEvent) {
  if (!isDragging || !buttonElement) return;

  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;

  if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
    hasMoved = true;
  }

  if (hasMoved) {
    buttonElement.style.left = `${initialLeft + dx}px`;
    buttonElement.style.top = `${initialTop + dy}px`;
  }
}

function handlePointerUp(e: PointerEvent) {
  if (!isDragging || !buttonElement) return;

  isDragging = false;
  buttonElement.releasePointerCapture(e.pointerId);

  if (hasMoved) {
    snapToEdge();
  } else {
    snapToEdge();
    collectCurrentPage();
  }
}

function createCollectButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = COLLECT_BUTTON_ID;
  button.title = '采集当前页面';

  button.addEventListener('pointerdown', handlePointerDown);
  button.addEventListener('pointermove', handlePointerMove);
  button.addEventListener('pointerup', handlePointerUp);
  button.addEventListener('pointercancel', handlePointerUp);

  return button;
}

export function initCollectButton(): void {
  if (document.getElementById(COLLECT_BUTTON_ID)) {
    logger.warn('Collect button already exists');
    return;
  }

  injectStyles();
  buttonElement = createCollectButton();

  const initialW = 140;
  buttonElement.style.left = `${window.innerWidth - initialW}px`;
  buttonElement.style.top = `${window.innerHeight - 100}px`;
  currentSnap = 'right';

  document.body.appendChild(buttonElement);
  updateButtonState('idle');

  requestAnimationFrame(() => {
    snapToEdge();
  });

  logger.info('Collect button initialized', { url: window.location.href });
}

export function destroyCollectButton(): void {
  if (buttonElement) {
    buttonElement.remove();
    buttonElement = null;
    currentState = 'idle';
    logger.info('Collect button destroyed');
  }
  const styleEl = document.getElementById(STYLE_TAG_ID);
  if (styleEl) styleEl.remove();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCollectButton);
  } else {
    initCollectButton();
  }
}
