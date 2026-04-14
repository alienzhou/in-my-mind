"""
Configuration Schema for Collector

定义配置数据结构，使用 dataclass 提供类型安全和默认值。
"""

from dataclasses import dataclass, field
from typing import List


@dataclass
class Config:
    """Collector 配置数据结构"""
    
    # 排除的用户名列表，这些用户的 repo 将被跳过
    exclude_users: List[str] = field(default_factory=list)
    
    # Elasticsearch 索引名称
    index_name: str = "in-my-mind"
    
    # 增量采集阈值：连续跳过多少个后停止
    incremental_threshold: int = 5
    
    # 日志级别: DEBUG, INFO, WARNING, ERROR, CRITICAL
    logging_level: str = "INFO"
    
    # 日志文件目录
    logging_dir: str = "logs"
