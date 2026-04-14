/**
 * 浏览器插件日志工具
 *
 * @module utils/logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 开发模式显示所有日志，生产模式只显示 warn 和 error
const MIN_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

/**
 * 格式化日志消息
 */
function formatMessage(module: string, level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [IMC:${module}] ${level.toUpperCase()}: ${message}`;
}

/**
 * 创建模块 logger 实例
 */
export function getLogger(module: string): Logger {
  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
  };

  return {
    debug(message: string, context?: LogContext): void {
      if (shouldLog('debug')) {
        console.debug(formatMessage(module, 'debug', message), context || '');
      }
    },

    info(message: string, context?: LogContext): void {
      if (shouldLog('info')) {
        console.info(formatMessage(module, 'info', message), context || '');
      }
    },

    warn(message: string, context?: LogContext): void {
      if (shouldLog('warn')) {
        console.warn(formatMessage(module, 'warn', message), context || '');
      }
    },

    error(message: string, context?: LogContext): void {
      if (shouldLog('error')) {
        console.error(formatMessage(module, 'error', message), context || '');
      }
    },
  };
}
