import Database from 'better-sqlite3';
import { config } from '../config.js';
import { dirname } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { createLogger } from './logger.js';

const log = createLogger('dedup');
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  
  // 确保目录存在
  const dbDir = dirname(config.dedupDb);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }
  
  db = new Database(config.dedupDb);
  log.info({ path: config.dedupDb }, 'SQLite database initialized');
  
  // 初始化表结构
  db.exec(`
    CREATE TABLE IF NOT EXISTS collected_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      collection TEXT NOT NULL,
      file_path TEXT,
      collected_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_url ON collected_items(url);
    CREATE INDEX IF NOT EXISTS idx_collection ON collected_items(collection);
  `);
  
  return db;
}

/**
 * 检查 URL 是否已存在
 */
export function exists(normalizedUrl: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM collected_items WHERE url = ?').get(normalizedUrl);
  const found = !!row;
  log.debug({ url: normalizedUrl, exists: found }, 'Dedup check');
  return found;
}

/**
 * 记录已采集的 URL
 */
export function record(normalizedUrl: string, collection: string, filePath: string, collectedAt?: number): void {
  const db = getDb();
  const timestamp = collectedAt ? new Date(collectedAt).toISOString() : new Date().toISOString();
  db.prepare(
    'INSERT OR IGNORE INTO collected_items (url, collection, file_path, collected_at) VALUES (?, ?, ?, ?)'
  ).run(normalizedUrl, collection, filePath, timestamp);
  log.debug({ url: normalizedUrl, collection, filePath }, 'Record inserted');
}

/**
 * 获取统计信息
 */
export function getStats(): { total: number; bySource: Record<string, number>; lastCollected: string | null } {
  const db = getDb();
  
  // 总数
  const totalRow = db.prepare('SELECT COUNT(*) as count FROM collected_items').get() as { count: number };
  
  // 按来源分组
  const bySourceRows = db.prepare(
    'SELECT collection, COUNT(*) as count FROM collected_items GROUP BY collection'
  ).all() as { collection: string; count: number }[];
  
  const bySource: Record<string, number> = {};
  for (const row of bySourceRows) {
    bySource[row.collection] = row.count;
  }
  
  // 最近采集
  const lastRow = db.prepare(
    'SELECT collected_at FROM collected_items ORDER BY collected_at DESC LIMIT 1'
  ).get() as { collected_at: string } | undefined;
  
  return {
    total: totalRow.count,
    bySource,
    lastCollected: lastRow?.collected_at ?? null,
  };
}
