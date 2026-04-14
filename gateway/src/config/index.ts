/**
 * 配置加载器
 * 支持分层配置：.local.json > config.json > default.json
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import type { Config, DeepPartial } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configDir = __dirname;
const gatewayRoot = resolve(__dirname, '../..');

/**
 * 深度合并配置对象
 */
function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];
    
    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as object,
        sourceValue as DeepPartial<typeof targetValue>
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }
  
  return result;
}

/**
 * 安全读取 JSON 配置文件
 */
function loadJsonConfig(filePath: string): DeepPartial<Config> | null {
  if (!existsSync(filePath)) {
    return null;
  }
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as DeepPartial<Config>;
  } catch (error) {
    console.warn(`Warning: Failed to parse config file ${filePath}:`, error);
    return null;
  }
}

/**
 * 加载配置
 * 优先级：.local.json > config.json > default.json > 环境变量
 */
function loadConfig(): Config {
  // 1. 加载默认配置
  const defaultConfigPath = resolve(configDir, 'default.json');
  const defaultConfig = loadJsonConfig(defaultConfigPath);
  
  if (!defaultConfig) {
    throw new Error(`Default config not found: ${defaultConfigPath}`);
  }
  
  let config = defaultConfig as Config;
  
  // 2. 加载项目级配置 (config.json)
  const projectConfigPath = resolve(configDir, 'config.json');
  const projectConfig = loadJsonConfig(projectConfigPath);
  if (projectConfig) {
    config = deepMerge(config, projectConfig);
  }
  
  // 3. 加载本地配置 (.local.json)
  const localConfigPath = resolve(configDir, '.local.json');
  const localConfig = loadJsonConfig(localConfigPath);
  if (localConfig) {
    config = deepMerge(config, localConfig);
  }
  
  // 4. 环境变量覆盖
  if (process.env.PORT) {
    config.port = parseInt(process.env.PORT, 10);
  }
  if (process.env.RAW_DIR) {
    config.rawDir = process.env.RAW_DIR;
  }
  if (process.env.DEDUP_DB) {
    config.dedupDb = process.env.DEDUP_DB;
  }
  if (process.env.DEBOUNCE_MS) {
    config.debounceMs = parseInt(process.env.DEBOUNCE_MS, 10);
  }
  if (process.env.LOG_LEVEL) {
    config.logging.level = process.env.LOG_LEVEL as Config['logging']['level'];
  }
  
  // 5. 解析相对路径
  config.rawDir = resolve(gatewayRoot, config.rawDir);
  config.dedupDb = resolve(gatewayRoot, config.dedupDb);
  config.logging.dir = resolve(gatewayRoot, config.logging.dir);
  
  return config;
}

export const config = loadConfig();

export type { Config, LoggingConfig, DeepPartial } from './schema.js';
