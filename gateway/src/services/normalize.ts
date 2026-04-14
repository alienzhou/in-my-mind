/**
 * URL 规范化
 * 保证同一内容的不同链接形式能被准确识别
 */

/** 需要移除的追踪参数 */
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'ref', 'source', 'spm', 'from', 'share_source', 'share_medium',
  'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
]);

/** 域名规范化映射 */
const DOMAIN_ALIASES: Record<string, string> = {
  'x.com': 'twitter.com',
  'www.twitter.com': 'twitter.com',
  'mobile.twitter.com': 'twitter.com',
  'www.github.com': 'github.com',
  'www.zhihu.com': 'zhihu.com',
  'zhuanlan.zhihu.com': 'zhihu.com/p',
};

/**
 * 规范化 URL
 */
export function normalize(rawUrl: string): string {
  let url: URL;
  
  try {
    url = new URL(rawUrl);
  } catch {
    // 如果解析失败，返回原始 URL
    return rawUrl;
  }
  
  // 1. scheme 和 host 转小写
  let hostname = url.hostname.toLowerCase();
  
  // 2. 域名别名规范化
  if (DOMAIN_ALIASES[hostname]) {
    hostname = DOMAIN_ALIASES[hostname];
  }
  
  // 3. 移除 www. 前缀（除非已经在映射中处理）
  if (hostname.startsWith('www.') && !DOMAIN_ALIASES[hostname]) {
    hostname = hostname.slice(4);
  }
  
  // 4. 规范化路径
  let pathname = url.pathname;
  
  // 移除末尾斜杠（除非是根路径）
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  
  // GitHub 特殊处理：移除 /tree/main, /tree/master 等默认分支路径
  if (hostname === 'github.com') {
    pathname = pathname.replace(/\/tree\/(main|master)$/, '');
    pathname = pathname.replace(/\/blob\/(main|master)\//, '/blob/main/');
  }
  
  // 5. 过滤查询参数
  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) {
      params.append(key, value);
    }
  }
  
  // 6. 排序查询参数
  params.sort();
  
  // 7. 重建 URL（不包含 fragment）
  const queryString = params.toString();
  const normalizedUrl = `https://${hostname}${pathname}${queryString ? '?' + queryString : ''}`;
  
  return normalizedUrl;
}

/**
 * 从 URL 推断 source
 */
export function inferSource(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    if (hostname.includes('github.com')) return 'github';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
    if (hostname.includes('zhihu.com')) return 'zhihu';
    if (hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com')) return 'xiaohongshu';
    
    return 'others';
  } catch {
    return 'others';
  }
}
