"""
Collector Logger Module

统一的日志配置模块，提供：
- 文件日志输出到 logs/collector.log
- 控制台彩色输出
- 可配置的日志级别

用法:
    from collector.logger import get_logger
    logger = get_logger(__name__)
    
    logger.info("Starting collection...")
    logger.debug("Processing item: %s", item_name)
    logger.warning("Rate limit approaching")
    logger.error("Failed to fetch: %s", url)
"""

import logging
import sys
from pathlib import Path
from typing import Optional

# 已初始化的 logger 缓存
_loggers: dict = {}
_initialized: bool = False


def _ensure_log_dir(log_dir: str) -> Path:
    """确保日志目录存在"""
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    return log_path


def _get_log_level(level_str: str) -> int:
    """将字符串日志级别转换为 logging 常量"""
    levels = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL,
    }
    return levels.get(level_str.upper(), logging.INFO)


def setup_logging(level: str = "INFO", log_dir: str = "logs") -> None:
    """
    初始化日志系统
    
    Args:
        level: 日志级别 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: 日志文件目录
    """
    global _initialized
    
    if _initialized:
        return
    
    log_level = _get_log_level(level)
    log_path = _ensure_log_dir(log_dir)
    
    # 配置根 logger
    root_logger = logging.getLogger('collector')
    root_logger.setLevel(log_level)
    
    # 清除已有的 handler（避免重复）
    root_logger.handlers.clear()
    
    # 文件 Handler
    file_handler = logging.FileHandler(
        log_path / 'collector.log',
        encoding='utf-8',
    )
    file_handler.setLevel(log_level)
    file_format = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_format)
    root_logger.addHandler(file_handler)
    
    # 控制台 Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_format = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(message)s',
        datefmt='%H:%M:%S'
    )
    console_handler.setFormatter(console_format)
    root_logger.addHandler(console_handler)
    
    _initialized = True
    root_logger.debug("Logging initialized (level=%s, dir=%s)", level, log_dir)


def get_logger(name: str) -> logging.Logger:
    """
    获取指定名称的 logger
    
    Args:
        name: Logger 名称，通常使用 __name__
        
    Returns:
        配置好的 Logger 实例
    """
    # 确保日志系统已初始化
    if not _initialized:
        # 尝试从配置加载
        try:
            from collector.config import get_config
            config = get_config()
            setup_logging(config.logging_level, config.logging_dir)
        except Exception:
            # 使用默认值
            setup_logging()
    
    # 使用 collector 作为父 logger
    if not name.startswith('collector'):
        name = f'collector.{name}'
    
    if name not in _loggers:
        _loggers[name] = logging.getLogger(name)
    
    return _loggers[name]


__all__ = ['get_logger', 'setup_logging']
