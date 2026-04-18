/**
 * URL 内容获取服务
 * 
 * 根据 URL 自动获取内容：
 * - HTML 页面：使用 Readability 提取正文
 * - PDF 文档：使用 MarkItDown 转换为 Markdown
 */

import { clean } from './cleaner.js';
import { createLogger } from './logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);
const log = createLogger('fetcher');

// MarkItDown CLI 路径（使用 Python 3.10+ 环境）
const MARKITDOWN_PATH = process.env.MARKITDOWN_PATH || 
  `${os.homedir()}/.pyenv/versions/3.10.13/bin/markitdown`;

export interface FetchResult {
  content: string;
  title?: string;
  contentType: string;
}

/**
 * 从 URL 获取内容
 */
export async function fetchContent(url: string): Promise<FetchResult> {
  log.info({ url }, 'Fetching content from URL');

  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  log.info({ url, contentType }, 'Response received');

  // 根据内容类型处理
  if (contentType.includes('application/pdf')) {
    return await handlePdf(response, url);
  } else if (contentType.includes('text/html')) {
    return await handleHtml(response, url);
  } else {
    // 其他类型，尝试作为文本处理
    const text = await response.text();
    return {
      content: text,
      contentType,
    };
  }
}

/**
 * 处理 PDF 文档
 * 使用 MarkItDown CLI 将 PDF 转换为结构化 Markdown
 */
async function handlePdf(response: Response, url: string): Promise<FetchResult> {
  log.info({ url }, 'Parsing PDF document with MarkItDown');

  // 下载 PDF 到临时文件
  const buffer = await response.arrayBuffer();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'markitdown-'));
  const tempPdfPath = path.join(tempDir, 'input.pdf');
  
  try {
    await fs.writeFile(tempPdfPath, Buffer.from(buffer));
    
    // 调用 MarkItDown CLI
    const { stdout, stderr } = await execAsync(`"${MARKITDOWN_PATH}" "${tempPdfPath}"`, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      timeout: 120000, // 2 分钟超时
    });
    
    if (stderr) {
      log.warn({ url, stderr }, 'MarkItDown stderr output');
    }
    
    let markdown = stdout;
    
    // 清理 arxiv 水印（PDF 侧边的版本信息）
    // 这些通常是单字符行，出现在文档开头
    const lines = markdown.split('\n');
    let cleanedLines: string[] = [];
    let inPreamble = true;
    
    for (const line of lines) {
      // 跳过开头的单字符行（arxiv 水印）
      if (inPreamble) {
        const trimmed = line.trim();
        // 如果是单字符、空行、或常见水印模式，跳过
        if (trimmed.length <= 1 || trimmed.match(/^[0-9]+$/) || 
            trimmed.match(/^arXiv:|^v\d+$|^\[.*\]$/i)) {
          continue;
        }
        // 遇到有意义的内容，结束前导清理
        inPreamble = false;
      }
      cleanedLines.push(line);
    }
    
    markdown = cleanedLines.join('\n').trim();
    
    // 尝试从 Markdown 提取标题（第一个 # 开头的行）
    let title: string | undefined;
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    } else {
      // 如果没有 # 标题，使用第一行非空文本
      const lines = markdown.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        if (firstLine.length > 5 && firstLine.length < 200 && !firstLine.match(/^\d/)) {
          title = firstLine;
        }
      }
    }

    log.info({ 
      url, 
      markdownLength: markdown.length,
      title: title?.slice(0, 50)
    }, 'PDF parsed successfully with MarkItDown');

    return {
      content: markdown,
      title,
      contentType: 'application/pdf',
    };
  } finally {
    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch (e) {
      log.warn({ tempDir, error: e }, 'Failed to clean up temp directory');
    }
  }
}

/**
 * 处理 HTML 页面
 */
async function handleHtml(response: Response, url: string): Promise<FetchResult> {
  log.info({ url }, 'Parsing HTML document');

  const html = await response.text();
  
  // 使用 Readability 提取正文
  const cleaned = clean(html);
  
  log.info({ 
    url, 
    title: cleaned.title?.slice(0, 50),
    contentLength: cleaned.content.length 
  }, 'HTML parsed successfully');

  return {
    content: cleaned.content,
    title: cleaned.title,
    contentType: 'text/html',
  };
}
