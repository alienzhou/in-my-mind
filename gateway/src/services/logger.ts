/**
 * 日志服务
 * 使用 pino 进行结构化日志输出
 */

import pino from 'pino';
import { resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { config } from '../config/index.js';

// 确保日志目录存在
if (!existsSync(config.logging.dir)) {
  mkdirSync(config.logging.dir, { recursive: true });
}

const logFilePath = resolve(config.logging.dir, 'gateway.log');

// 创建 pino 实例
export const logger = pino({
  level: config.logging.level,
  transport: {
    targets: [
      // 输出到文件
      {
        target: 'pino/file',
        options: { destination: logFilePath },
        level: config.logging.level,
      },
      // 同时输出到控制台（开发环境友好格式）
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
        level: config.logging.level,
      },
    ],
  },
});

// 导出子 logger 便于模块使用
export function createLogger(module: string) {
  return logger.child({ module });
}

export default logger;
