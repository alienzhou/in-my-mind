import { Hono } from 'hono';
import type { HealthResponse } from '../types/payload.js';

const health = new Hono();

const VERSION = '1.0.0';

/**
 * GET /api/v1/health
 * 健康检查端点
 */
health.get('/', (c) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: Date.now(),
    version: VERSION,
  };
  return c.json(response);
});

export { health };
