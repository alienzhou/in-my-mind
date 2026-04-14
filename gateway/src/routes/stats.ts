import { Hono } from 'hono';
import type { StatsResponse } from '../types/payload.js';
import { getStats } from '../services/dedup.js';

const stats = new Hono();

/**
 * GET /api/v1/stats
 * 获取采集统计信息
 */
stats.get('/', (c) => {
  const statsData = getStats();
  
  const response: StatsResponse = {
    total: statsData.total,
    bySource: statsData.bySource,
    lastCollected: statsData.lastCollected,
  };
  
  return c.json(response);
});

export { stats };
