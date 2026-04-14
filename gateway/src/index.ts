import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { config } from './config.js';
import { routes } from './routes/index.js';

const app = new Hono();

// 全局错误处理中间件
app.onError((err, c) => {
  console.error('[Gateway Error]', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500
  );
});

// 挂载路由
app.route('/', routes);

// 健康检查（基础端点）
app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// 启动服务
serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`Gateway listening on port ${info.port}`);
  }
);

export { app };
