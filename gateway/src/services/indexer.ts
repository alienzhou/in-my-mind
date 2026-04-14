/**
 * QMD 索引触发服务
 * 使用 debounce 机制批量触发索引更新
 * 自动检测并创建缺失的 collections
 * 使用锁机制防止并发索引（带超时保护）
 */

import { spawn, execSync, ChildProcess } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from '../config.js';

let debounceTimer: NodeJS.Timeout | null = null;
let pendingCount = 0;

// 记录需要创建的 collection（source name）
const pendingCollections = new Set<string>();

// 索引锁：防止并发执行
let isIndexing = false;
// 标记：索引期间是否有新的请求进来，需要在完成后再索引一次
let needReindex = false;
// 当前索引进程引用（用于超时 kill）
let currentProcess: ChildProcess | null = null;
// 锁获取时间（用于超时检测）
let lockAcquiredAt: number | null = null;
// 超时定时器
let timeoutTimer: NodeJS.Timeout | null = null;

// 索引超时时间（默认 10 分钟，足够处理大量文档）
const INDEX_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * 获取当前已注册的 collections
 */
function getExistingCollections(): Set<string> {
  try {
    const output = execSync(`qmd --index ${config.indexName} collection list`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    // 解析 collection list 输出，提取 collection 名称
    const collections = new Set<string>();
    const lines = output.split('\n');
    for (const line of lines) {
      // qmd collection list 输出格式: "  name  /path/to/dir  pattern"
      const match = line.trim().match(/^(\S+)\s+/);
      if (match && !line.includes('No collections found')) {
        collections.add(match[1]);
      }
    }
    return collections;
  } catch {
    // 如果命令失败（如 index 不存在），返回空集合
    return new Set<string>();
  }
}

/**
 * 创建缺失的 collection
 */
function ensureCollection(source: string): void {
  const existingCollections = getExistingCollections();
  
  if (!existingCollections.has(source)) {
    const rawDirAbsolute = resolve(config.rawDir);
    const collectionPath = resolve(config.rawDir, source);
    
    // 检查目录是否存在
    try {
      const stat = statSync(collectionPath);
      if (!stat.isDirectory()) {
        console.warn(`[Indexer] ${collectionPath} is not a directory, skipping collection creation`);
        return;
      }
    } catch {
      console.warn(`[Indexer] Directory ${collectionPath} does not exist, skipping collection creation`);
      return;
    }
    
    console.log(`[Indexer] Creating collection '${source}' for ${collectionPath}...`);
    
    try {
      // qmd 需要在 raw/ 目录下执行，使用相对路径 ./{source}
      execSync(
        `qmd --index ${config.indexName} collection add ${source} ./${source} --pattern '**/*.md'`,
        { stdio: 'inherit', shell: true, cwd: rawDirAbsolute }
      );
      console.log(`[Indexer] Collection '${source}' created successfully`);
    } catch (err) {
      console.error(`[Indexer] Failed to create collection '${source}':`, err);
    }
  }
}

/**
 * 确保所有 pending collections 都已创建
 */
function ensurePendingCollections(): void {
  for (const source of pendingCollections) {
    ensureCollection(source);
  }
  pendingCollections.clear();
}

/**
 * 获取锁
 */
function acquireLock(): boolean {
  if (isIndexing) {
    // 检查是否超时（防止死锁）
    if (lockAcquiredAt && Date.now() - lockAcquiredAt > INDEX_TIMEOUT_MS) {
      console.warn('[Indexer] Lock timeout detected, force releasing lock...');
      forceReleaseLock();
      // 继续获取锁
    } else {
      return false;
    }
  }
  
  isIndexing = true;
  lockAcquiredAt = Date.now();
  
  // 设置超时保护
  timeoutTimer = setTimeout(() => {
    console.error('[Indexer] Index operation timed out, force releasing lock...');
    forceReleaseLock();
    
    // 超时后如果有待处理的请求，重新触发
    if (needReindex || pendingCount > 0) {
      console.log('[Indexer] Retrying after timeout...');
      needReindex = false;
      runQmdIndex();
    }
  }, INDEX_TIMEOUT_MS);
  
  return true;
}

/**
 * 释放锁
 */
function releaseLock(): void {
  isIndexing = false;
  lockAcquiredAt = null;
  currentProcess = null;
  
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }
}

/**
 * 强制释放锁（超时或异常时）
 */
function forceReleaseLock(): void {
  // 尝试 kill 当前进程
  if (currentProcess && !currentProcess.killed) {
    try {
      currentProcess.kill('SIGTERM');
      console.log('[Indexer] Killed hanging process');
    } catch (err) {
      console.error('[Indexer] Failed to kill process:', err);
    }
  }
  
  releaseLock();
}

/**
 * 索引完成后的回调
 */
function onIndexComplete(): void {
  releaseLock();
  
  // 检查是否需要重新索引（索引期间有新请求进来）
  if (needReindex) {
    needReindex = false;
    console.log('[Indexer] New items arrived during indexing, starting another round...');
    // 使用 setImmediate 避免调用栈过深
    setImmediate(() => runQmdIndex());
  }
}

/**
 * 执行 QMD 索引命令
 */
function runQmdIndex(): void {
  // 尝试获取锁
  if (!acquireLock()) {
    needReindex = true;
    console.log(`[Indexer] Already indexing, will re-index after completion (${pendingCount} pending)`);
    return;
  }
  
  console.log(`[Indexer] Triggering QMD index update for ${pendingCount} new items...`);
  pendingCount = 0;
  
  // 先确保所有 pending collections 都已创建
  try {
    ensurePendingCollections();
  } catch (err) {
    console.error('[Indexer] Failed to ensure collections:', err);
    // 继续执行 update，可能部分 collection 已存在
  }
  
  // 运行 qmd update
  const updateProcess = spawn('qmd', ['--index', config.indexName, 'update'], {
    stdio: 'inherit',
    shell: true,
  });
  currentProcess = updateProcess;
  
  updateProcess.on('close', (code) => {
    if (code === 0) {
      // update 成功后运行 embed
      const embedProcess = spawn('qmd', ['--index', config.indexName, 'embed'], {
        stdio: 'inherit',
        shell: true,
      });
      currentProcess = embedProcess;
      
      embedProcess.on('close', (embedCode) => {
        if (embedCode === 0) {
          console.log('[Indexer] QMD index updated and embedded successfully');
        } else {
          console.error(`[Indexer] QMD embed failed with code ${embedCode}`);
        }
        onIndexComplete();
      });
      
      embedProcess.on('error', (err) => {
        console.error('[Indexer] Failed to run QMD embed:', err.message);
        onIndexComplete();
      });
    } else {
      console.error(`[Indexer] QMD update failed with code ${code}`);
      onIndexComplete();
    }
  });
  
  updateProcess.on('error', (err) => {
    console.error('[Indexer] Failed to run QMD:', err.message);
    onIndexComplete();
  });
}

/**
 * 触发索引更新（带 debounce）
 * @param source - 数据来源（对应 raw/ 下的目录名），用于自动创建 collection
 */
export function trigger(source?: string): void {
  pendingCount++;
  
  // 记录需要检查/创建的 collection
  if (source) {
    pendingCollections.add(source);
  }
  
  // 清除之前的定时器
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // 设置新的定时器
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runQmdIndex();
  }, config.debounceMs);
  
  console.log(`[Indexer] Scheduled index update in ${config.debounceMs}ms (${pendingCount} pending)`);
}

/**
 * 立即执行索引（不等待 debounce）
 */
export function flush(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  
  if (pendingCount > 0) {
    runQmdIndex();
  }
}

/**
 * 获取当前索引器状态（用于调试/监控）
 */
export function getStatus(): {
  isIndexing: boolean;
  pendingCount: number;
  pendingCollections: string[];
  lockDurationMs: number | null;
} {
  return {
    isIndexing,
    pendingCount,
    pendingCollections: Array.from(pendingCollections),
    lockDurationMs: lockAcquiredAt ? Date.now() - lockAcquiredAt : null,
  };
}
