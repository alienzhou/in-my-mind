/**
 * Gateway Payload 类型定义
 */

/**
 * 采集请求 Payload
 */
export interface CollectPayload {
  /** 文章标题 */
  title: string;
  /** 来源 URL（用于去重） */
  url: string;
  /** 内容主体 */
  content: string;

  /** 来源标识，默认 'others' */
  source?: string;
  /** 内容格式，默认 'markdown' */
  format?: 'markdown' | 'html';
  /** 标签 */
  tags?: string[];
  /** 作者 */
  author?: string;
  /** 采集时间戳（毫秒），可选。若未传入则由 Gateway 生成 */
  collected_at?: number;
  /** 采集类型：likes / bookmarks / reposts（用于标记来源类别） */
  collect_type?: string;
}

/**
 * 采集响应
 */
export interface CollectResponse {
  /** 操作结果 */
  status: 'created' | 'skipped' | 'error';
  /** 消息描述 */
  message: string;
  /** 落地文件路径（创建成功时） */
  filePath?: string;
  /** 规范化后的 URL */
  normalizedUrl?: string;
}

/**
 * 健康检查响应
 */
export interface HealthResponse {
  status: 'ok';
  timestamp: number;
  version: string;
}

/**
 * 统计响应
 */
export interface StatsResponse {
  /** 总采集数 */
  total: number;
  /** 按来源分组统计 */
  bySource: Record<string, number>;
  /** 最近采集时间 */
  lastCollected: string | null;
}
