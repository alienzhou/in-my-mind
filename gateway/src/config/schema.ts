/**
 * 配置类型定义
 */

export interface LoggingConfig {
  /** 日志级别 */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** 日志目录 */
  dir: string;
}

export interface Config {
  /** 排除的用户名列表 */
  excludeUsers: string[];
  /** Algolia 索引名 */
  indexName: string;
  /** 连续 skipped 阈值，用于增量同步时判断是否停止 */
  incrementalThreshold: number;
  /** 日志配置 */
  logging: LoggingConfig;
  /** HTTP 服务端口 */
  port: number;
  /** raw 目录路径 */
  rawDir: string;
  /** 去重数据库路径 */
  dedupDb: string;
  /** 索引触发间隔（毫秒） */
  debounceMs: number;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
