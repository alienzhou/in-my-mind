import { Hono } from 'hono';
import { collect } from './collect.js';
import { health } from './health.js';
import { stats } from './stats.js';

const routes = new Hono();

// API v1 路由
routes.route('/api/v1/collect', collect);
routes.route('/api/v1/health', health);
routes.route('/api/v1/stats', stats);

export { routes };
