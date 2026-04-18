/**
 * PDF URL 处理单元测试
 */

import { describe, it, expect } from 'vitest';
import { handlePdfUrl, getPdfFallbackTitle, isPdfViewerPage } from './pdf-handler';

describe('handlePdfUrl', () => {
  describe('arxiv', () => {
    it('PDF URL 转换为摘要页 URL', () => {
      expect(handlePdfUrl('https://arxiv.org/pdf/2603.28052')).toBe(
        'https://arxiv.org/abs/2603.28052'
      );
    });

    it('带版本号的 PDF URL 转换为摘要页', () => {
      expect(handlePdfUrl('https://arxiv.org/pdf/2301.01234')).toBe(
        'https://arxiv.org/abs/2301.01234'
      );
    });

    it('带小数点的论文 ID', () => {
      expect(handlePdfUrl('https://arxiv.org/pdf/1706.03762')).toBe(
        'https://arxiv.org/abs/1706.03762'
      );
    });

    it('摘要页 URL 返回 null（无需转换）', () => {
      expect(handlePdfUrl('https://arxiv.org/abs/2603.28052')).toBeNull();
    });

    it('其他 arxiv 页面返回 null', () => {
      expect(handlePdfUrl('https://arxiv.org/list/cs.AI/recent')).toBeNull();
    });
  });

  describe('其他网站', () => {
    it('普通网页返回 null', () => {
      expect(handlePdfUrl('https://example.com/page')).toBeNull();
    });

    it('其他站点的 PDF 链接返回 null（暂不支持）', () => {
      expect(handlePdfUrl('https://example.com/document.pdf')).toBeNull();
    });
  });

  describe('边界情况', () => {
    it('无效 URL 返回 null', () => {
      expect(handlePdfUrl('not-a-url')).toBeNull();
    });

    it('空字符串返回 null', () => {
      expect(handlePdfUrl('')).toBeNull();
    });
  });
});

describe('getPdfFallbackTitle', () => {
  describe('arxiv', () => {
    it('从 arxiv PDF URL 提取标题', () => {
      expect(getPdfFallbackTitle('https://arxiv.org/pdf/2603.28052')).toBe('arXiv:2603.28052');
    });

    it('从带版本号的 URL 提取标题', () => {
      expect(getPdfFallbackTitle('https://arxiv.org/pdf/2301.01234')).toBe('arXiv:2301.01234');
    });

    it('非 PDF 页面返回 undefined', () => {
      expect(getPdfFallbackTitle('https://arxiv.org/abs/2603.28052')).toBeUndefined();
    });
  });

  describe('通用 PDF 文件', () => {
    it('从 PDF 文件名提取标题', () => {
      expect(getPdfFallbackTitle('https://example.com/documents/report.pdf')).toBe('report');
    });

    it('处理大写 .PDF 扩展名', () => {
      expect(getPdfFallbackTitle('https://example.com/files/DOCUMENT.PDF')).toBe('DOCUMENT');
    });

    it('非 PDF 文件返回 undefined', () => {
      expect(getPdfFallbackTitle('https://example.com/page.html')).toBeUndefined();
    });
  });

  describe('边界情况', () => {
    it('无效 URL 返回 undefined', () => {
      expect(getPdfFallbackTitle('not-a-url')).toBeUndefined();
    });

    it('空字符串返回 undefined', () => {
      expect(getPdfFallbackTitle('')).toBeUndefined();
    });
  });
});

describe('isPdfViewerPage', () => {
  describe('PDF 查看器检测', () => {
    it('null body 返回 true', () => {
      expect(isPdfViewerPage(null, null)).toBe(true);
    });

    it('空 body（无子元素）返回 true', () => {
      const emptyBody = { children: { length: 0 } } as unknown as HTMLElement;
      expect(isPdfViewerPage(emptyBody, null)).toBe(true);
    });

    it('存在 PDF embed 元素返回 true', () => {
      const normalBody = { children: { length: 5 } } as unknown as HTMLElement;
      const pdfEmbed = {} as Element;
      expect(isPdfViewerPage(normalBody, pdfEmbed)).toBe(true);
    });
  });

  describe('普通页面检测', () => {
    it('正常 body 无 embed 返回 false', () => {
      const normalBody = { children: { length: 10 } } as unknown as HTMLElement;
      expect(isPdfViewerPage(normalBody, null)).toBe(false);
    });

    it('有内容的 body 返回 false', () => {
      const contentBody = { children: { length: 1 } } as unknown as HTMLElement;
      expect(isPdfViewerPage(contentBody, null)).toBe(false);
    });
  });
});
