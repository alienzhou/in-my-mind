/**
 * fetcher 服务单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock child_process for MarkItDown CLI
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    exec: vi.fn((cmd: string, opts: object, callback: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
      // Mock MarkItDown CLI output
      callback(null, {
        stdout: '# Test PDF Title\n\nMock PDF content converted to Markdown.',
        stderr: '',
      });
    }),
  };
});

// Mock fs/promises for temp file operations
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    mkdtemp: vi.fn(async () => '/tmp/markitdown-test'),
    writeFile: vi.fn(async () => {}),
    rm: vi.fn(async () => {}),
  };
});

// Mock util.promisify to return mocked exec
vi.mock('util', async () => {
  const actual = await vi.importActual('util');
  return {
    ...actual,
    promisify: vi.fn((fn) => {
      // Return a promisified version of exec that uses our mock
      return async (cmd: string, opts?: object) => {
        return {
          stdout: '# Test PDF Title\n\nMock PDF content converted to Markdown.',
          stderr: '',
        };
      };
    }),
  };
});

// Import after mocking
import { fetchContent } from './fetcher.js';

describe('fetcher', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchContent', () => {
    it('成功获取 HTML 内容', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === 'content-type') return 'text/html; charset=utf-8';
            return null;
          },
        },
        text: async () => '<html><head><title>Test Page</title></head><body><article>Test content</article></body></html>',
      });

      const result = await fetchContent('https://example.com/page');

      expect(result.contentType).toBe('text/html');
      expect(result.content).toContain('Test content');
    });

    it('成功获取 PDF 内容', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === 'content-type') return 'application/pdf';
            return null;
          },
        },
        arrayBuffer: async () => new ArrayBuffer(100),
      });

      const result = await fetchContent('https://arxiv.org/pdf/2603.28052');

      expect(result.contentType).toBe('application/pdf');
      expect(result.content).toContain('Mock PDF content converted to Markdown');
      expect(result.title).toBe('Test PDF Title');
    });

    it('处理 HTTP 错误响应', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(fetchContent('https://example.com/not-found')).rejects.toThrow('Failed to fetch URL: HTTP 404');
    });

    it('处理网络错误', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchContent('https://example.com/error')).rejects.toThrow('Network error');
    });

    it('设置正确的请求头', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'text/html',
        },
        text: async () => '<html></html>',
      });

      await fetchContent('https://example.com/page');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/page',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            'Accept': expect.any(String),
          }),
        })
      );
    });
  });
});
