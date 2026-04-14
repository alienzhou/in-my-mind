"""
Collector Configuration Loader

配置加载优先级（从高到低）：
1. collector/config/.local.yaml - 本地开发配置（不提交到 Git）
2. collector/config/config.yaml - 项目级配置
3. collector/config/default.yaml - 默认值

用法:
    from collector.config import get_config
    config = get_config()
    
    # 访问配置
    print(config.exclude_users)
    print(config.incremental_threshold)
"""

from pathlib import Path
from typing import Optional
import os

from .schema import Config

# 缓存已加载的配置
_config_cache: Optional[Config] = None


def _load_yaml(path: Path) -> dict:
    """加载 YAML 文件，返回字典"""
    if not path.exists():
        return {}
    
    try:
        import yaml
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            return data if data else {}
    except ImportError:
        # 如果没有 PyYAML，尝试简单解析
        return _simple_yaml_parse(path)
    except Exception as e:
        print(f"Warning: Failed to load {path}: {e}")
        return {}


def _simple_yaml_parse(path: Path) -> dict:
    """简单的 YAML 解析（不依赖 PyYAML）"""
    result = {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # 跳过注释和空行
                if not line or line.startswith('#'):
                    continue
                # 解析 key: value
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip()
                    value = value.strip()
                    
                    # 处理不同类型的值
                    if value.startswith('[') and value.endswith(']'):
                        # 列表
                        inner = value[1:-1].strip()
                        if inner:
                            result[key] = [v.strip().strip('"\'') for v in inner.split(',')]
                        else:
                            result[key] = []
                    elif value.startswith('"') and value.endswith('"'):
                        result[key] = value[1:-1]
                    elif value.startswith("'") and value.endswith("'"):
                        result[key] = value[1:-1]
                    elif value.isdigit():
                        result[key] = int(value)
                    elif value.lower() in ('true', 'false'):
                        result[key] = value.lower() == 'true'
                    else:
                        result[key] = value
    except Exception as e:
        print(f"Warning: Failed to parse {path}: {e}")
    return result


def _merge_configs(*configs: dict) -> dict:
    """合并多个配置字典，后面的优先级更高"""
    result = {}
    for config in configs:
        for key, value in config.items():
            result[key] = value
    return result


def load_config(force_reload: bool = False) -> Config:
    """
    加载配置
    
    Args:
        force_reload: 强制重新加载配置（忽略缓存）
        
    Returns:
        Config 实例
    """
    global _config_cache
    
    if _config_cache is not None and not force_reload:
        return _config_cache
    
    # 配置文件目录
    config_dir = Path(__file__).parent
    
    # 按优先级从低到高加载
    default_config = _load_yaml(config_dir / 'default.yaml')
    project_config = _load_yaml(config_dir / 'config.yaml')
    local_config = _load_yaml(config_dir / '.local.yaml')
    
    # 合并配置
    merged = _merge_configs(default_config, project_config, local_config)
    
    # 创建 Config 实例
    _config_cache = Config(
        exclude_users=merged.get('exclude_users', []),
        index_name=merged.get('index_name', 'in-my-mind'),
        incremental_threshold=merged.get('incremental_threshold', 5),
        logging_level=merged.get('logging_level', 'INFO'),
        logging_dir=merged.get('logging_dir', 'logs'),
    )
    
    return _config_cache


def get_config() -> Config:
    """获取配置实例（使用缓存）"""
    return load_config()


# 导出
__all__ = ['Config', 'get_config', 'load_config']
