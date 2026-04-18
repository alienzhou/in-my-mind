/**
 * URL 规范化单元测试
 */

import { describe, it, expect } from 'vitest';
import { normalize, inferSource } from './normalize.js';

describe('normalize', () => {
  describe('基础规范化', () => {
    it('移除末尾斜杠', () => {
      expect(normalize('https://example.com/path/')).toBe('https://example.com/path');
    });

    it('保留根路径斜杠', () => {
      expect(normalize('https://example.com/')).toBe('https://example.com/');
    });

    it('移除追踪参数', () => {
      expect(normalize('https://example.com/page?utm_source=google&id=123')).toBe(
        'https://example.com/page?id=123'
      );
    });

    it('排序查询参数', () => {
      expect(normalize('https://example.com/page?z=1&a=2')).toBe(
        'https://example.com/page?a=2&z=1'
      );
    });

    it('移除 fragment', () => {
      expect(normalize('https://example.com/page#section')).toBe('https://example.com/page');
    });
  });

  describe('域名别名', () => {
    it('x.com 转换为 twitter.com', () => {
      expect(normalize('https://x.com/user/status/123')).toBe(
        'https://twitter.com/user/status/123'
      );
    });

    it('mobile.twitter.com 转换为 twitter.com', () => {
      expect(normalize('https://mobile.twitter.com/user')).toBe('https://twitter.com/user');
    });

    it('移除通用 www 前缀', () => {
      expect(normalize('https://www.example.com/page')).toBe('https://example.com/page');
    });
  });

  describe('平台特定规则', () => {
    describe('arxiv', () => {
      it('PDF URL 转换为摘要页 URL', () => {
        expect(normalize('https://arxiv.org/pdf/2603.28052')).toBe(
          'https://arxiv.org/abs/2603.28052'
        );
      });

      it('PDF URL (带版本号) 转换为摘要页', () => {
        expect(normalize('https://arxiv.org/pdf/2301.01234')).toBe(
          'https://arxiv.org/abs/2301.01234'
        );
      });

      it('摘要页 URL 保持不变', () => {
        expect(normalize('https://arxiv.org/abs/2603.28052')).toBe(
          'https://arxiv.org/abs/2603.28052'
        );
      });

      it('非标准路径保持不变', () => {
        expect(normalize('https://arxiv.org/list/cs.AI/recent')).toBe(
          'https://arxiv.org/list/cs.AI/recent'
        );
      });
    });

    describe('GitHub', () => {
      it('移除 /tree/main 后缀', () => {
        expect(normalize('https://github.com/user/repo/tree/main')).toBe(
          'https://github.com/user/repo'
        );
      });

      it('移除 /tree/master 后缀', () => {
        expect(normalize('https://github.com/user/repo/tree/master')).toBe(
          'https://github.com/user/repo'
        );
      });
    });
  });

  describe('边界情况', () => {
    it('无效 URL 返回原始值', () => {
      expect(normalize('not-a-url')).toBe('not-a-url');
    });

    it('空字符串返回原始值', () => {
      expect(normalize('')).toBe('');
    });
  });
});

describe('inferSource', () => {
  it('推断 GitHub', () => {
    expect(inferSource('https://github.com/user/repo')).toBe('github');
  });

  it('推断 Twitter (twitter.com)', () => {
    expect(inferSource('https://twitter.com/user')).toBe('twitter');
  });

  it('推断 Twitter (x.com)', () => {
    expect(inferSource('https://x.com/user')).toBe('twitter');
  });

  it('推断知乎', () => {
    expect(inferSource('https://zhihu.com/question/123')).toBe('zhihu');
  });

  it('推断小红书', () => {
    expect(inferSource('https://xiaohongshu.com/explore/123')).toBe('xiaohongshu');
  });

  it('未知来源返回 others', () => {
    expect(inferSource('https://example.com/page')).toBe('others');
  });

  it('无效 URL 返回 others', () => {
    expect(inferSource('not-a-url')).toBe('others');
  });
});
