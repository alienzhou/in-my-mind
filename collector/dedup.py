"""
DEPRECATED (2026-04): This module is being replaced by Gateway API.

The Gateway service now handles:
- URL normalization (via gateway/src/utils/normalize.ts)
- Deduplication (via SQLite database)
- Content storage

This module is kept for backward compatibility but will be removed in a future version.
Use `BaseCollector._send_to_gateway()` for new implementations.

Migration guide:
- Old: dedup.exists(url) -> BaseCollector.should_collect(url)
- New: Gateway handles dedup automatically in /api/v1/collect endpoint
"""

import sqlite3
from pathlib import Path
from datetime import datetime

class DedupManager:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path)
        self._init_schema()
        
    def _init_schema(self):
        """Create the deduplication table and indexes."""
        with self.conn:
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS collected_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT NOT NULL UNIQUE,
                    collection TEXT NOT NULL,
                    file_path TEXT,
                    collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME
                )
            ''')
            self.conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_url ON collected_items(url)'
            )
            self.conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_collection ON collected_items(collection)'
            )

    def exists(self, url: str) -> bool:
        """Check if a URL has already been collected."""
        cursor = self.conn.execute(
            "SELECT 1 FROM collected_items WHERE url = ?", (url,)
        )
        return cursor.fetchone() is not None

    def add(self, url: str, collection: str, file_path: str) -> None:
        """Record a collected URL."""
        with self.conn:
            self.conn.execute(
                "INSERT OR IGNORE INTO collected_items (url, collection, file_path) VALUES (?, ?, ?)",
                (url, collection, file_path)
            )

    def get_stats(self, collection: str = None) -> dict:
        """Get statistics about collected items."""
        if collection:
            cursor = self.conn.execute(
                "SELECT COUNT(*) FROM collected_items WHERE collection = ?", (collection,)
            )
        else:
            cursor = self.conn.execute("SELECT COUNT(*) FROM collected_items")
        return {"total": cursor.fetchone()[0]}

    def close(self):
        """Close the database connection."""
        self.conn.close()
