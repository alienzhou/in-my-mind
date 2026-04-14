"""
GitHub Stars Collector

采集用户 GitHub Stars，包含：
- 分页获取所有 starred repositories
- 获取每个仓库的 README
- 通过 GraphQL API 获取用户添加的笔记/标签

API 参考:
- REST: https://docs.github.com/rest/activity/starring
- GraphQL: https://docs.github.com/graphql
"""

import os
import json
import urllib.request
import urllib.error
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Optional, Generator
from collector.base import BaseCollector
from collector.dedup import DedupManager
from collector.config import get_config
from collector.logger import get_logger

logger = get_logger(__name__)


class GitHubStarsCollector(BaseCollector):
    """
    GitHub Stars Collector - 采集用户 GitHub Stars.
    
    Features:
    - Paginate through all starred repos
    - Fetch README content
    - Get user notes/tags via GraphQL (if available)
    """
    
    # GitHub API endpoints
    REST_API = "https://api.github.com"
    GRAPHQL_API = "https://api.github.com/graphql"
    
    def __init__(self, dedup: DedupManager):
        super().__init__(dedup)
        self._token = os.environ.get('GITHUB_TOKEN')
        self._username = os.environ.get('GITHUB_USERNAME')  # 用于获取个人 star notes
        
    @property
    def name(self) -> str:
        return "github-stars"
    
    def _headers(self, for_graphql: bool = False, for_star: bool = False) -> Dict[str, str]:
        """构建请求头
        
        Args:
            for_graphql: 是否为 GraphQL 请求
            for_star: 是否获取 starred_at 信息（需要特殊 Accept header）
        """
        headers = {
            'User-Agent': 'in-my-mind-collector',
        }
        if self._token:
            headers['Authorization'] = f'Bearer {self._token}'
        if for_graphql:
            headers['Content-Type'] = 'application/json'
        if for_star:
            # 使用 star+json 媒体类型来获取 starred_at 时间戳
            # 参考: https://docs.github.com/rest/activity/starring
            headers['Accept'] = 'application/vnd.github.star+json'
        return headers
    
    def _rest_get(self, path: str) -> Optional[Dict]:
        """REST API GET 请求"""
        url = f"{self.REST_API}{path}"
        logger.debug("REST GET: %s", url)
        try:
            req = urllib.request.Request(url, headers=self._headers())
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))
                logger.debug("REST GET success: %s", url)
                return result
        except urllib.error.HTTPError as e:
            if e.code == 403:
                logger.warning("Rate limited on %s. Set GITHUB_TOKEN for higher limits.", url)
            else:
                logger.error("HTTP %d: %s", e.code, url)
            return None
        except Exception as e:
            logger.error("Error fetching %s: %s", url, e)
            return None
    
    def _rest_get_starred(self, path: str) -> Optional[List[Dict]]:
        """REST API GET 请求（带 star+json Accept header 获取 starred_at）"""
        url = f"{self.REST_API}{path}"
        logger.debug("REST GET (starred): %s", url)
        try:
            req = urllib.request.Request(url, headers=self._headers(for_star=True))
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))
                logger.debug("REST GET starred success: %s", url)
                return result
        except urllib.error.HTTPError as e:
            if e.code == 403:
                logger.warning("Rate limited on %s. Set GITHUB_TOKEN for higher limits.", url)
            else:
                logger.error("HTTP %d: %s", e.code, url)
            return None
        except Exception as e:
            logger.error("Error fetching %s: %s", url, e)
            return None
    
    def _rest_get_raw(self, path: str) -> Optional[str]:
        """REST API GET 请求，返回原始文本"""
        url = f"{self.REST_API}{path}"
        headers = self._headers()
        headers['Accept'] = 'application/vnd.github.raw'  # 获取原始内容
        logger.debug("REST GET (raw): %s", url)
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as response:
                content = response.read().decode('utf-8')
                logger.debug("README fetched: %s (%d bytes)", url, len(content))
                return content
        except Exception as e:
            logger.debug("Could not fetch README: %s - %s", url, e)
            return None
    
    def _graphql_query(self, query: str, variables: Dict = None) -> Optional[Dict]:
        """GraphQL API 请求"""
        if not self._token:
            return None
        payload = {'query': query}
        if variables:
            payload['variables'] = variables
        logger.debug("GraphQL query: %s", query[:100])
        try:
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                self.GRAPHQL_API,
                data=data,
                headers=self._headers(for_graphql=True),
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))
                return result.get('data')
        except Exception as e:
            logger.warning("GraphQL error: %s", e)
            return None
    
    def get_starred_repos(self, per_page: int = 100) -> Generator[Dict, None, None]:
        """
        分页获取所有 starred repositories
        
        Args:
            per_page: 每页数量，最大 100
            
        Yields:
            仓库信息字典，包含：
            - full_name: owner/repo
            - html_url: 仓库 URL
            - description: 描述
            - topics: 标签列表
            - language: 主要语言
            - stargazers_count: star 数
            - pushed_at: 最后更新时间
        """
        page = 1
        while True:
            # 使用 authenticated user 的 starred 列表（如果已登录）
            # 否则使用公开列表
            if self._username:
                path = f"/users/{self._username}/starred"
            else:
                path = "/user/starred"
            
            path += f"?per_page={per_page}&page={page}&sort=created"
            
            repos = self._rest_get_starred(path)
            if not repos:
                break
            
            if not isinstance(repos, list):
                logger.warning("Unexpected response type: %s", type(repos))
                break
            
            if len(repos) == 0:
                break
            
            for item in repos:
                # 使用 star+json 格式时，响应格式为 {"starred_at": "...", "repo": {...}}
                yield item
            
            if len(repos) < per_page:
                break
            
            page += 1
            logger.info("Fetched page %d...", page - 1)
    
    def get_readme(self, owner: str, repo: str) -> Optional[str]:
        """
        获取仓库 README 内容
        
        会依次尝试：
        1. README.md
        2. README
        3. readme.md
        """
        # GitHub API 的 /readme 端点会自动找 README 文件
        content = self._rest_get_raw(f"/repos/{owner}/{repo}/readme")
        return content
    
    def get_star_notes(self, owner: str, repo: str) -> Optional[Dict]:
        """
        通过 GraphQL API 获取用户给 Star 添加的笔记和标签
        
        注意：这需要 GitHub GraphQL API 和适当的权限
        返回：{"notes": str, "tags": List[str]}
        """
        if not self._username or not self._token:
            return None
        
        # GraphQL 查询获取用户的 star 信息
        query = """
        query($username: String!, $owner: String!, $repo: String!) {
            user(login: $username) {
                starredRepositories(first: 100) {
                    edges {
                        node {
                            name
                            owner { login }
                        }
                        ... on StarredRepositoryEdge {
                            starredAt
                        }
                    }
                }
            }
        }
        """
        # 注意：GitHub GraphQL API 目前不直接支持获取单个仓库的 star notes
        # 这是一个已知的限制，可能需要使用其他方法
        return None
    
    def sync(self, output_dir: Path, since=None) -> int:
        """
        同步 GitHub Stars
        
        流程：
        1. 分页获取所有 starred repositories
        2. 对每个仓库获取 README
        3. 尝试获取用户添加的笔记/标签
        4. 发送到 Gateway 存储
        5. 增量采集：连续 N 个 skipped 后停止
        """
        config = get_config()
        
        logger.info("=" * 60)
        logger.info("GitHub Stars Collector")
        logger.info("=" * 60)
        
        if not self._token:
            logger.warning("GITHUB_TOKEN not set. API rate limit is 60/hour.")
            logger.warning("Set GITHUB_TOKEN in .env to increase to 5000/hour.")
        
        if self._username:
            logger.info("User: %s", self._username)
        else:
            logger.info("GITHUB_USERNAME not set. Using public API.")
        
        # 日志排除列表
        if config.exclude_users:
            logger.info("Excluding users: %s", ", ".join(config.exclude_users))
        
        # 获取所有 starred repos
        total_count = 0
        collected_count = 0
        skipped_count = 0
        excluded_count = 0
        
        # 增量采集计数器
        consecutive_skipped = 0
        incremental_threshold = config.incremental_threshold
        
        for item in self.get_starred_repos():
            total_count += 1
            
            # 使用 star+json 格式，解析 starred_at 和 repo
            starred_at_str = item.get('starred_at')  # "2026-04-13T10:00:00Z"
            repo = item.get('repo', item)  # 兼容两种格式
            
            # 解析 starred_at 为毫秒时间戳
            collected_at_ms = None
            if starred_at_str:
                try:
                    dt = datetime.fromisoformat(starred_at_str.replace('Z', '+00:00'))
                    collected_at_ms = int(dt.timestamp() * 1000)
                except (ValueError, TypeError) as e:
                    logger.debug("Failed to parse starred_at '%s': %s", starred_at_str, e)
            
            full_name = repo.get('full_name', '')
            html_url = repo.get('html_url', '')
            description = repo.get('description', '')
            topics = repo.get('topics', [])
            language = repo.get('language')
            
            # 检查用户排除列表
            owner, repo_name = full_name.split('/') if '/' in full_name else ('', full_name)
            if owner in config.exclude_users:
                logger.debug("Skipping excluded user: %s", full_name)
                excluded_count += 1
                continue
            
            logger.info("[%d] %s", total_count, full_name)
            if description:
                desc_preview = description[:80] + ('...' if len(description) > 80 else '')
                logger.debug("  Description: %s", desc_preview)
            if topics:
                logger.debug("  Topics: %s", ", ".join(topics[:5]))
            
            # 获取 README
            readme = self.get_readme(owner, repo_name) if owner else None
            
            if not readme:
                # 使用描述或仓库名作为内容
                readme = f"# {full_name}\n\n"
                if description:
                    readme += f"{description}\n\n"
                readme += f"Repository: {html_url}"
            
            # 构建元数据标签
            tags = list(topics) if topics else []
            if language:
                tags.append(f"lang:{language}")
            tags.append("github-star")
            
            # 发送到 Gateway
            payload = {
                'title': full_name,
                'url': html_url,
                'content': readme,
                'source': 'github',
                'format': 'markdown',
                'tags': tags,
                'author': owner,
                'collected_at': collected_at_ms,  # 毫秒时间戳，表示 star 时间
            }
            
            result = self._send_to_gateway(payload)
            
            if result.get('status') == 'created':
                collected_count += 1
                consecutive_skipped = 0  # 重置计数器
            elif result.get('status') == 'skipped':
                skipped_count += 1
                consecutive_skipped += 1
                
                # 检查是否达到增量采集阈值
                if incremental_threshold > 0 and consecutive_skipped >= incremental_threshold:
                    logger.info("=" * 60)
                    logger.info("🛑 Reached incremental boundary: %d consecutive skipped items", consecutive_skipped)
                    logger.info("   Stopping collection (all recent items already indexed)")
                    logger.info("=" * 60)
                    break
        
        logger.info("=" * 60)
        logger.info("GitHub Stars sync complete")
        logger.info("  Total processed: %d", total_count)
        logger.info("  Newly collected: %d", collected_count)
        logger.info("  Skipped (dupes): %d", skipped_count)
        if excluded_count > 0:
            logger.info("  Excluded users:  %d", excluded_count)
        logger.info("=" * 60)
        
        return collected_count
