import argparse
import importlib
import pkgutil
from pathlib import Path
from datetime import date
from typing import Dict, Type
import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables from .env file (if exists)
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded environment from {env_path}")
except ImportError:
    pass  # python-dotenv not installed, use system env vars

from collector.base import BaseCollector
from collector.dedup import DedupManager

def discover_collectors() -> Dict[str, Type[BaseCollector]]:
    """Automatically discover all collector classes in the collector/ directory."""
    collectors = {}
    collector_dir = Path(__file__).parent
    
    # Iterate through all subdirectories in collector/
    for item in collector_dir.iterdir():
        if item.is_dir() and (item / "collector.py").exists():
            module_name = f"collector.{item.name}.collector"
            try:
                module = importlib.import_module(module_name)
                # Find classes that inherit from BaseCollector
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if isinstance(attr, type) and issubclass(attr, BaseCollector) and attr is not BaseCollector:
                        # Instantiate temporarily to get the name
                        temp_instance = attr(None)
                        collectors[temp_instance.name] = attr
            except Exception as e:
                print(f"Warning: Failed to load collector from {item.name}: {e}", file=sys.stderr)
                
    return collectors

def main():
    parser = argparse.ArgumentParser(description="In-My-Mind External Knowledge Base Sync Tool")
    
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Sync command
    sync_parser = subparsers.add_parser("sync", help="Synchronize data from collectors")
    
    # Get available collectors dynamically
    available_collectors = list(discover_collectors().keys())
    choices = ["all"] + available_collectors
    
    sync_parser.add_argument(
        "target", 
        choices=choices,
        help="Target to sync ('all' or specific collector)"
    )
    
    args = parser.parse_args()
    
    if args.command == "sync":
        collectors_map = discover_collectors()
        if not collectors_map:
            print("No collectors found. Please implement them in collector/*/collector.py")
            return
            
        # Initialize shared deduplication manager
        dedup_db_path = Path("data/dedup.sqlite")
        dedup_db_path.parent.mkdir(parents=True, exist_ok=True)
        dedup = DedupManager(db_path=dedup_db_path)
        
        targets = collectors_map.keys() if args.target == "all" else [args.target]
        
        for target in targets:
            collector_cls = collectors_map.get(target)
            if not collector_cls:
                print(f"Error: Collector '{target}' not found.")
                continue
                
            print(f"Starting sync for {target}...")
            collector = collector_cls(dedup)
            
            # NOTE: output_dir 现在只是传给旧版 collector 用的
            # 新版 collector 通过 Gateway 存储，目录由 Gateway 根据 payload.source 创建
            # 这里不再主动创建目录，避免创建错误的目录
            today_str = date.today().isoformat()
            output_dir = Path(f"raw/{target}/{today_str}")
            # 不再调用 output_dir.mkdir()，让 Gateway 来创建正确的目录
            
            try:
                added_count = collector.sync(output_dir)
                print(f"Sync for {target} completed. Added {added_count} new items.")
            except Exception as e:
                print(f"Error syncing {target}: {e}", file=sys.stderr)
                
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
