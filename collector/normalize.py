"""
DEPRECATED (2026-04): This module is being replaced by Gateway API.

The Gateway service now handles URL normalization via:
- gateway/src/utils/normalize.ts

This module is kept for backward compatibility but will be removed in a future version.
New collectors should rely on Gateway's built-in normalization.

Migration guide:
- Old: from collector.normalize import normalize_url
- New: Gateway normalizes URLs automatically in /api/v1/collect endpoint
"""

from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
import re
from typing import Dict, Any

PLATFORM_RULES = {
    'github': {
        # https://github.com/owner/repo -> https://github.com/owner/repo
        # https://github.com/owner/repo/tree/main -> https://github.com/owner/repo
        'pattern': r'^(https://github\.com/[^/]+/[^/]+).*$',
        'replace': r'\1'
    },
    'twitter': {
        'alias': ['x.com'],
        'canonical': 'twitter.com'
    },
    'xiaohongshu': {
        'strip_www': True
    }
}

def normalize_url(url: str, platform=None) -> str:
    """
    Standardize a URL to prevent duplicate collections of the same content.
    
    Basic Rules:
    1. Lowercase scheme and netloc
    2. Remove trailing slash
    3. Remove tracking parameters
    4. Remove URL fragments
    5. Sort query parameters alphabetically
    """
    parsed = urlparse(url)
    
    # 1. Scheme + netloc to lowercase
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    
    # 2. Remove trailing slash
    path = parsed.path.rstrip('/')
    if not path:
        path = ''
        
    # 3. Filter tracking parameters
    query_params = parse_qs(parsed.query, keep_blank_values=True)
    tracking_params = {
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 
        'utm_content', 'ref', 'source', 'from', 'spm', 'fbclid'
    }
    filtered_params = {
        k: v for k, v in query_params.items() 
        if k.lower() not in tracking_params
    }
    
    # 4. Remove fragment
    fragment = ''
    
    # 5. Sort query params
    sorted_query = urlencode(sorted(filtered_params.items()), doseq=True)
    
    # Rebuild basic normalized URL
    normalized = urlunparse((scheme, netloc, path, '', sorted_query, fragment))
    
    # Apply platform-specific rules
    if platform and platform in PLATFORM_RULES:
        rules = PLATFORM_RULES[platform]
        
        # Apply regex replacement
        if 'pattern' in rules and 'replace' in rules:
            normalized = re.sub(rules['pattern'], rules['replace'], normalized)
            
        # Handle domain aliases
        if 'alias' in rules and 'canonical' in rules:
            for alias in rules['alias']:
                if netloc.endswith(alias):
                    normalized = normalized.replace(alias, rules['canonical'], 1)
                    
        # Remove www prefix
        if 'strip_www' in rules and rules['strip_www']:
            if netloc.startswith('www.'):
                normalized = normalized.replace('www.', '', 1)
                
    return normalized
