from abc import ABC, abstractmethod
from pathlib import Path
from datetime import date
import json
import urllib.request
import urllib.error
from typing import Optional, Dict
from .dedup import DedupManager
from .logger import get_logger

logger = get_logger(__name__)

# Gateway API endpoint for collecting content
GATEWAY_URL = "http://localhost:3020/api/v1/collect"

class BaseCollector(ABC):
    """
    Abstract base class for all external knowledge base collectors.
    Each platform collector should inherit from this and implement its logic in `sync()`.
    
    NOTE: As of 2026-04, collectors are transitioning to use Gateway API for:
    - URL normalization
    - Deduplication
    - Content storage
    
    Use `_send_to_gateway()` for new implementations.
    """
    
    def __init__(self, dedup: DedupManager):
        self.dedup = dedup
        self._gateway_url = GATEWAY_URL

    @property
    @abstractmethod
    def name(self) -> str:
        """
        Returns the collection name for this platform.
        This must match the subdirectory name in `raw/` and `collector/`.
        E.g., "github", "twitter"
        """
        pass
    
    @abstractmethod
    def sync(self, output_dir: Path, since=None) -> int:
        """
        Execute the synchronization logic for the platform.
        
        This method must:
        1. Fetch data from the source (API, scraping, etc.)
        2. Call `normalize.py` to standardize URLs
        3. Call `self.should_collect(url)` to check if it's a new item
        4. If new: Write markdown content to `output_dir`
        5. Call `self.mark_collected(url, file_path)` after writing
        
        Args:
            output_dir: The directory where raw markdown files should be saved
                        (e.g., raw/github/2026-04-13/)
            since: Optional date to start syncing from (for incremental updates)
            
        Returns:
            The number of newly added items during this sync.
        """
        pass
    
    def should_collect(self, url: str) -> bool:
        """
        Check if the item should be collected based on its normalized URL.
        """
        from .normalize import normalize_url
        norm_url = normalize_url(url, self.name)
        return not self.dedup.exists(norm_url)
    
    def mark_collected(self, url: str, file_path) -> None:
        """
        Mark a normalized URL as collected in the SQLite database.
        
        DEPRECATED: Use `_send_to_gateway()` for new implementations.
        """
        from .normalize import normalize_url
        norm_url = normalize_url(url, self.name)
        self.dedup.add(norm_url, self.name, str(file_path))
    
    def _send_to_gateway(self, payload: dict) -> Dict:
        """
        Send collected content to the Gateway API.
        
        The Gateway handles:
        - URL normalization
        - Deduplication check
        - Content storage
        
        Args:
            payload: Dictionary containing:
                - title (required): Content title
                - url (required): The source URL
                - content (required): The content body
                - source (optional): Source identifier (defaults to collector name)
                - format (optional): 'markdown' or 'html'
                - tags (optional): List of tags
                - author (optional): Author name
                
        Returns:
            Response dict with 'status' key:
            - 'created': Content was newly created
            - 'skipped': Content already exists (duplicate)
            - 'error': Failed to process
        """
        # Ensure source is set
        if 'source' not in payload:
            payload['source'] = self.name
        
        url = payload.get('url', 'unknown')
        logger.debug("Sending to Gateway: %s", url)
            
        try:
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                self._gateway_url,
                data=data,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))
                status = result.get('status', 'unknown')
                
                if status == 'created':
                    logger.info("✓ Collected: %s", url)
                    return {'status': 'created'}
                elif status == 'skipped':
                    logger.debug("⊘ Skipped (duplicate): %s", url)
                    return {'status': 'skipped'}
                elif status == 'error':
                    error = result.get('message', 'Unknown error')
                    logger.error("✗ Failed: %s - %s", url, error)
                    return {'status': 'error', 'message': error}
                else:
                    logger.warning("? Unknown status %s: %s", status, url)
                    return {'status': 'unknown'}
                    
        except urllib.error.HTTPError as e:
            try:
                error_body = json.loads(e.read().decode('utf-8'))
                error_msg = error_body.get('message', str(e))
            except:
                error_msg = str(e)
            logger.error("Gateway error (%d): %s - %s", e.code, url, error_msg)
            return {'status': 'error', 'message': error_msg}
        except urllib.error.URLError as e:
            logger.error("Gateway connection failed: %s", e.reason)
            logger.error("Make sure Gateway is running: ./bin/imm gateway")
            return {'status': 'error', 'message': str(e.reason)}
        except Exception as e:
            logger.error("Unexpected error sending to Gateway: %s", e)
            return {'status': 'error', 'message': str(e)}
