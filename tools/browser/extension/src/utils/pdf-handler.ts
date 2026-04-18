/**
 * PDF URL 处理工具
 * 
 * 处理 PDF 类型的 URL，包括：
 * - 检测并转换为更适合采集的页面 URL
 * - 为无法获取标题的页面提供 fallback 标题
 * - 检测 PDF 查看器页面特征
 */

/**
 * 检测页面是否为 PDF 查看器
 * 
 * Chrome 内置 PDF 查看器的特征：
 * - body 为空或无子元素
 * - 存在 embed[type="application/pdf"] 元素
 * 
 * @param body document.body 元素
 * @param embedSelector embed 元素选择器结果
 * @returns 是否为 PDF 查看器页面
 */
export function isPdfViewerPage(
  body: HTMLElement | null,
  embedSelector: Element | null
): boolean {
  // 检测空 body（PDF 查看器特征）
  if (!body || body.children.length === 0) {
    return true;
  }
  
  // 检测 PDF embed 元素
  if (embedSelector) {
    return true;
  }
  
  return false;
}

/**
 * 检测并处理 PDF URL
 * 
 * 对于某些平台的 PDF URL，需要转换为等价的摘要页 URL 进行采集
 * 因为 PDF 页面无法获取标题和结构化内容
 * 
 * @param url 原始 URL
 * @returns 转换后的 URL，如果无需转换则返回 null
 */
export function handlePdfUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // arxiv: /pdf/{id} → /abs/{id}
    if (hostname === 'arxiv.org') {
      const pdfMatch = parsed.pathname.match(/^\/pdf\/([0-9.]+)$/i);
      if (pdfMatch) {
        return `https://arxiv.org/abs/${pdfMatch[1]}`;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * 获取 PDF URL 的默认标题
 * 当无法从 PDF 页面获取标题时，尝试从 URL 推断
 * 
 * @param url PDF 页面 URL
 * @returns 推断的标题，如果无法推断则返回 undefined
 */
export function getPdfFallbackTitle(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // arxiv: 使用 paper ID 作为标题的一部分
    if (hostname === 'arxiv.org') {
      const pdfMatch = parsed.pathname.match(/^\/pdf\/([0-9.]+)$/i);
      if (pdfMatch) {
        return `arXiv:${pdfMatch[1]}`;
      }
    }
    
    // 通用：使用文件名作为标题
    const filename = parsed.pathname.split('/').pop();
    if (filename && filename.toLowerCase().endsWith('.pdf')) {
      return filename.replace(/\.pdf$/i, '');
    }
    
    return undefined;
  } catch {
    return undefined;
  }
}
