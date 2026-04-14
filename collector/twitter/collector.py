"""
X (Twitter) Collector

采集用户 X 账号的 Likes、Bookmarks 和 Reposts：
- 按从新到旧顺序遍历
- 先获取列表，再获取推文详情
- 支持增量采集（基于连续跳过阈值）

API 参考:
- Likes: https://developer.x.com/en/docs/x-api/tweets/likes/api-reference/get-users-id-liked-tweets
- Bookmarks: https://developer.x.com/en/docs/x-api/tweets/bookmarks/api-reference/get-users-id-bookmarks
- Timeline: https://developer.x.com/en/docs/x-api/tweets/timelines/api-reference/get-users-id-tweets

认证方式: OAuth 2.0 Authorization Code Flow with PKCE
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Generator, Literal
from collector.base import BaseCollector
from collector.dedup import DedupManager
from collector.config import get_config
from collector.logger import get_logger

logger = get_logger(__name__)

# 采集类型
CollectType = Literal['likes', 'bookmarks', 'reposts']


class XCollector(BaseCollector):
    """
    X (Twitter) Collector - 采集用户的 Likes、Bookmarks 和 Reposts.
    
    Features:
    - 支持三类内容采集：likes（点赞）、bookmarks（书签）、reposts（转发）
    - 按时间倒序遍历（从新到旧）
    - 分页获取推文列表
    - 获取每条推文的完整内容
    - 支持增量采集
    """
    
    # X API v2 endpoints
    API_BASE = "https://api.x.com/2"
    
    def __init__(self, dedup: DedupManager):
        super().__init__(dedup)
        # OAuth 2.0 Bearer Token
        self._bearer_token = os.environ.get('X_BEARER_TOKEN')
        # 用户 ID（X API 需要数字形式的 user_id）
        # 可以设置数字 ID 或用户名，如果是用户名会自动转换
        self._user_id_or_username = os.environ.get('X_USER_ID')
        self._user_id: Optional[str] = None  # 缓存解析后的数字 ID
        
    @property
    def name(self) -> str:
        return "twitter"
    
    def _headers(self) -> Dict[str, str]:
        """构建请求头"""
        return {
            'Authorization': f'Bearer {self._bearer_token}',
            'Content-Type': 'application/json',
        }
    
    def _api_get(self, path: str, params: Dict = None) -> Optional[Dict]:
        """API GET 请求"""
        url = f"{self.API_BASE}{path}"
        if params:
            query = '&'.join(f"{k}={v}" for k, v in params.items())
            url = f"{url}?{query}"
        
        logger.debug("GET: %s", url)
        try:
            req = urllib.request.Request(url, headers=self._headers())
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))
                return result
        except urllib.error.HTTPError as e:
            error_body = None
            try:
                error_body = json.loads(e.read().decode('utf-8'))
            except:
                pass
            
            if e.code == 401:
                logger.error("Authentication failed. Check X_BEARER_TOKEN.")
            elif e.code == 402:
                # Credits depleted - X API 付费限制
                logger.error("API credits depleted. X API requires a paid subscription for this endpoint.")
                if error_body:
                    logger.error("Detail: %s", error_body.get('detail', ''))
            elif e.code == 403:
                logger.error("Access forbidden. This endpoint requires OAuth 2.0 User Context (not App-only Bearer Token).")
                logger.error("You need to implement OAuth 2.0 Authorization Code Flow with PKCE.")
                if error_body:
                    logger.error("Detail: %s", error_body.get('detail', ''))
            elif e.code == 429:
                logger.warning("Rate limited. Please wait before retrying.")
            else:
                logger.error("HTTP %d: %s", e.code, url)
                if error_body:
                    logger.error("Error: %s", error_body)
            return None
        except Exception as e:
            logger.error("Error fetching %s: %s", url, e)
            return None
    
    def _resolve_user_id(self) -> Optional[str]:
        """
        解析用户 ID：如果配置的是用户名，则通过 API 转换为数字 ID
        
        Returns:
            数字形式的用户 ID，或 None（如果解析失败）
        """
        if self._user_id:
            return self._user_id
        
        if not self._user_id_or_username:
            return None
        
        # 检查是否已经是数字 ID
        if self._user_id_or_username.isdigit():
            self._user_id = self._user_id_or_username
            return self._user_id
        
        # 是用户名，需要通过 API 转换
        logger.info("Resolving username '%s' to user ID...", self._user_id_or_username)
        
        response = self._api_get(f"/users/by/username/{self._user_id_or_username}")
        
        if response and 'data' in response:
            self._user_id = response['data'].get('id')
            logger.info("Resolved user ID: %s", self._user_id)
            return self._user_id
        
        logger.error("Failed to resolve username '%s' to user ID", self._user_id_or_username)
        return None
    
    def _get_tweet_fields(self) -> str:
        """返回推文字段参数"""
        # 请求完整的推文信息
        return "created_at,public_metrics,entities,attachments,referenced_tweets,in_reply_to_user_id,source"
    
    def _get_expansions(self) -> str:
        """返回扩展字段参数"""
        # 包含作者信息、媒体信息、以及引用的推文
        return "author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id"
    
    def _get_user_fields(self) -> str:
        """返回用户字段参数"""
        return "name,username,profile_image_url,verified"
    
    def _get_media_fields(self) -> str:
        """返回媒体字段参数"""
        return "url,preview_image_url,type"
    
    def _paginate_tweets(
        self, 
        endpoint: str, 
        per_page: int = 100
    ) -> Generator[Dict, None, None]:
        """
        分页获取推文列表
        
        Args:
            endpoint: API 端点路径（如 /users/{id}/liked_tweets）
            per_page: 每页数量，最大 100
            
        Yields:
            推文数据（包含 tweet 和 includes）
        """
        pagination_token = None
        
        while True:
            params = {
                'max_results': per_page,
                'tweet.fields': self._get_tweet_fields(),
                'expansions': self._get_expansions(),
                'user.fields': self._get_user_fields(),
                'media.fields': self._get_media_fields(),
            }
            
            if pagination_token:
                params['pagination_token'] = pagination_token
            
            response = self._api_get(endpoint, params)
            
            if not response:
                break
            
            data = response.get('data', [])
            includes = response.get('includes', {})
            meta = response.get('meta', {})
            
            if not data:
                break
            
            yield {
                'tweets': data,
                'includes': includes,
            }
            
            # 检查是否有下一页
            next_token = meta.get('next_token')
            if not next_token:
                break
            
            pagination_token = next_token
            logger.info("Fetching next page...")
    
    def _find_author_username(self, author_id: str, includes: Dict) -> str:
        """从 includes 中查找作者用户名"""
        if 'users' in includes:
            for user in includes['users']:
                if user.get('id') == author_id:
                    return user.get('username', 'unknown')
        return 'unknown'
    
    def _format_tweet_content(
        self, 
        tweet: Dict, 
        includes: Dict,
        collect_type: CollectType
    ) -> str:
        """
        格式化推文内容为 Markdown
        
        Args:
            tweet: 推文数据
            includes: 包含的扩展数据（用户、媒体等）
            collect_type: 采集类型（likes/bookmarks/reposts）
            
        Returns:
            Markdown 格式的内容
        """
        tweet_id = tweet.get('id', '')
        text = tweet.get('text', '')
        created_at = tweet.get('created_at', '')
        public_metrics = tweet.get('public_metrics', {})
        entities = tweet.get('entities', {})
        referenced_tweets = tweet.get('referenced_tweets', [])
        
        # 获取作者信息
        author_id = tweet.get('author_id', '')
        author_info = {}
        if 'users' in includes:
            for user in includes['users']:
                if user.get('id') == author_id:
                    author_info = user
                    break
        
        author_name = author_info.get('name', 'Unknown')
        author_username = author_info.get('username', 'unknown')
        
        # 对于 repost，获取原推文信息
        original_tweet = None
        original_username = author_username
        original_tweet_id = tweet_id
        
        if collect_type == 'reposts':
            for ref in referenced_tweets:
                if ref.get('type') == 'retweeted':
                    original_tweet_id = ref.get('id')
                    # 从 includes 中获取原推文信息
                    if 'tweets' in includes:
                        for t in includes['tweets']:
                            if t.get('id') == original_tweet_id:
                                original_tweet = t
                                original_author_id = t.get('author_id', '')
                                original_username = self._find_author_username(original_author_id, includes)
                                break
                    break
        
        # 构建 Markdown
        lines = []
        
        # 标题行（使用推文前 50 字符或 ID）
        if collect_type == 'reposts' and original_tweet:
            display_text = original_tweet.get('text', text)
        else:
            display_text = text
        title_preview = display_text[:50].replace('\n', ' ')
        if len(display_text) > 50:
            title_preview += '...'
        lines.append(f"# @{author_username}: {title_preview}")
        lines.append('')
        
        # 元数据
        if collect_type == 'reposts' and original_tweet:
            lines.append(f"- **Original Author**: {author_name} (@{author_username})")
            lines.append(f"- **Original Tweet**: [{original_tweet_id}](https://x.com/{original_username}/status/{original_tweet_id})")
            lines.append(f"- **Posted**: {original_tweet.get('created_at', created_at)}")
        else:
            lines.append(f"- **Author**: {author_name} (@{author_username})")
            lines.append(f"- **Tweet ID**: [{tweet_id}](https://x.com/{author_username}/status/{tweet_id})")
            lines.append(f"- **Posted**: {created_at}")
        lines.append(f"- **Collected as**: {collect_type}")
        
        # 互动数据
        metrics_tweet = original_tweet if (collect_type == 'reposts' and original_tweet) else tweet
        metrics = metrics_tweet.get('public_metrics', public_metrics)
        if metrics:
            likes = metrics.get('like_count', 0)
            retweets = metrics.get('retweet_count', 0)
            replies = metrics.get('reply_count', 0)
            lines.append(f"- **Metrics**: {likes} likes, {retweets} retweets, {replies} replies")
        
        lines.append('')
        lines.append('---')
        lines.append('')
        
        # 推文正文
        if collect_type == 'reposts' and original_tweet:
            lines.append(original_tweet.get('text', text))
        else:
            lines.append(text)
        lines.append('')
        
        # 附件信息
        media_tweet = original_tweet if (collect_type == 'reposts' and original_tweet) else tweet
        if 'attachments' in media_tweet:
            media_keys = media_tweet['attachments'].get('media_keys', [])
            if 'media' in includes:
                lines.append('**Media:**')
                for key in media_keys:
                    for media in includes['media']:
                        if media.get('media_key') == key:
                            media_type = media.get('type', 'unknown')
                            media_url = media.get('url') or media.get('preview_image_url', '')
                            lines.append(f"- [{media_type}] {media_url}")
                lines.append('')
        
        # 链接信息
        url_entities = original_tweet.get('entities', {}).get('urls', []) if (collect_type == 'reposts' and original_tweet) else entities.get('urls', [])
        if url_entities:
            lines.append('**Links:**')
            for url_info in url_entities:
                expanded_url = url_info.get('expanded_url', url_info.get('url', ''))
                lines.append(f"- {expanded_url}")
            lines.append('')
        
        # 标签信息
        hashtag_entities = original_tweet.get('entities', {}).get('hashtags', []) if (collect_type == 'reposts' and original_tweet) else entities.get('hashtags', [])
        if hashtag_entities:
            lines.append('**Hashtags:** ' + ' '.join(f"#{h['tag']}" for h in hashtag_entities))
            lines.append('')
        
        return '\n'.join(lines)
    
    def _collect_likes_bookmarks(
        self, 
        collect_type: Literal['likes', 'bookmarks'],
        output_dir: Path
    ) -> int:
        """
        采集 Likes 或 Bookmarks
        
        Args:
            collect_type: 采集类型（likes/bookmarks）
            output_dir: 输出目录
            
        Returns:
            本次新增采集数量
        """
        config = get_config()
        
        # 确定端点
        user_id = self._resolve_user_id()
        if not user_id:
            logger.error("Cannot collect %s: user ID not resolved", collect_type)
            return 0
        
        if collect_type == 'likes':
            endpoint = f"/users/{user_id}/liked_tweets"
        else:  # bookmarks
            endpoint = f"/users/{user_id}/bookmarks"
        
        total_count = 0
        collected_count = 0
        skipped_count = 0
        consecutive_skipped = 0
        incremental_threshold = config.incremental_threshold
        
        for page_data in self._paginate_tweets(endpoint):
            tweets = page_data.get('tweets', [])
            includes = page_data.get('includes', {})
            
            for tweet in tweets:
                total_count += 1
                tweet_id = tweet.get('id', '')
                
                # 获取作者信息（用于构建 URL）
                author_id = tweet.get('author_id', '')
                author_username = self._find_author_username(author_id, includes)
                
                # 构建 URL
                url = f"https://x.com/{author_username}/status/{tweet_id}"
                
                # 格式化内容
                content = self._format_tweet_content(tweet, includes, collect_type)
                
                # 构建标题
                text = tweet.get('text', '')
                title_preview = text[:50].replace('\n', ' ')
                if len(text) > 50:
                    title_preview += '...'
                title = f"@{author_username}: {title_preview}"
                
                # 构建标签
                tags = [f"x-{collect_type}", "twitter"]
                entities = tweet.get('entities', {})
                if 'hashtags' in entities:
                    for h in entities['hashtags'][:5]:
                        tags.append(h['tag'])
                
                # 解析创建时间
                created_at_str = tweet.get('created_at', '')
                collected_at_ms = None
                if created_at_str:
                    try:
                        dt = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                        collected_at_ms = int(dt.timestamp() * 1000)
                    except (ValueError, TypeError):
                        pass
                
                # 发送到 Gateway
                payload = {
                    'title': title,
                    'url': url,
                    'content': content,
                    'source': 'twitter',
                    'format': 'markdown',
                    'tags': tags,
                    'author': author_username,
                    'collected_at': collected_at_ms,
                    'collect_type': collect_type,  # 新增：采集类型字段
                }
                
                result = self._send_to_gateway(payload)
                
                if result.get('status') == 'created':
                    collected_count += 1
                    consecutive_skipped = 0
                    logger.info("[%d] ✓ %s", total_count, url)
                elif result.get('status') == 'skipped':
                    skipped_count += 1
                    consecutive_skipped += 1
                    logger.debug("[%d] ⊘ Skipped: %s", total_count, url)
                    
                    # 检查增量采集阈值
                    if incremental_threshold > 0 and consecutive_skipped >= incremental_threshold:
                        logger.info("=" * 60)
                        logger.info("🛑 Reached incremental boundary: %d consecutive skipped", consecutive_skipped)
                        logger.info("   Stopping %s collection", collect_type)
                        logger.info("=" * 60)
                        return collected_count
                else:
                    logger.warning("[%d] ✗ Failed: %s", total_count, url)
        
        logger.info("%s collection complete: %d processed, %d collected, %d skipped",
                   collect_type, total_count, collected_count, skipped_count)
        
        return collected_count
    
    def _collect_reposts(self, output_dir: Path) -> int:
        """
        采集用户的转发（Reposts）
        
        通过用户时间线 API 筛选转发内容
        
        Args:
            output_dir: 输出目录
            
        Returns:
            本次新增采集数量
        """
        config = get_config()
        
        # 使用用户时间线 API
        user_id = self._resolve_user_id()
        if not user_id:
            logger.error("Cannot collect reposts: user ID not resolved")
            return 0
        
        endpoint = f"/users/{user_id}/tweets"
        
        total_count = 0
        collected_count = 0
        skipped_count = 0
        consecutive_skipped = 0
        incremental_threshold = config.incremental_threshold
        
        logger.info("Fetching user timeline to find reposts...")
        
        for page_data in self._paginate_tweets(endpoint):
            tweets = page_data.get('tweets', [])
            includes = page_data.get('includes', {})
            
            for tweet in tweets:
                # 检查是否为转发
                referenced_tweets = tweet.get('referenced_tweets', [])
                is_retweet = any(
                    ref.get('type') == 'retweeted' 
                    for ref in referenced_tweets
                )
                
                if not is_retweet:
                    continue
                
                total_count += 1
                tweet_id = tweet.get('id', '')
                
                # 获取原推文信息
                original_tweet = None
                original_tweet_id = tweet_id
                original_author_id = tweet.get('author_id', '')
                original_username = self._find_author_username(original_author_id, includes)
                
                for ref in referenced_tweets:
                    if ref.get('type') == 'retweeted':
                        original_tweet_id = ref.get('id')
                        break
                
                # 从 includes 中获取原推文
                if 'tweets' in includes:
                    for t in includes['tweets']:
                        if t.get('id') == original_tweet_id:
                            original_tweet = t
                            original_author_id = t.get('author_id', '')
                            original_username = self._find_author_username(original_author_id, includes)
                            break
                
                # 构建 URL（指向原推文）
                url = f"https://x.com/{original_username}/status/{original_tweet_id}"
                
                # 格式化内容
                content = self._format_tweet_content(tweet, includes, 'reposts')
                
                # 构建标题
                if original_tweet:
                    text = original_tweet.get('text', tweet.get('text', ''))
                else:
                    text = tweet.get('text', '')
                title_preview = text[:50].replace('\n', ' ')
                if len(text) > 50:
                    title_preview += '...'
                title = f"@{original_username}: {title_preview}"
                
                # 构建标签
                tags = ["x-reposts", "twitter"]
                entities = original_tweet.get('entities', {}) if original_tweet else {}
                if 'hashtags' in entities:
                    for h in entities['hashtags'][:5]:
                        tags.append(h['tag'])
                
                # 解析创建时间
                created_at_str = None
                if original_tweet:
                    created_at_str = original_tweet.get('created_at')
                if not created_at_str:
                    created_at_str = tweet.get('created_at', '')
                    
                collected_at_ms = None
                if created_at_str:
                    try:
                        dt = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                        collected_at_ms = int(dt.timestamp() * 1000)
                    except (ValueError, TypeError):
                        pass
                
                # 发送到 Gateway
                payload = {
                    'title': title,
                    'url': url,
                    'content': content,
                    'source': 'twitter',
                    'format': 'markdown',
                    'tags': tags,
                    'author': original_username,
                    'collected_at': collected_at_ms,
                    'collect_type': 'reposts',  # 新增：采集类型字段
                }
                
                result = self._send_to_gateway(payload)
                
                if result.get('status') == 'created':
                    collected_count += 1
                    consecutive_skipped = 0
                    logger.info("[%d] ✓ %s (repost)", total_count, url)
                elif result.get('status') == 'skipped':
                    skipped_count += 1
                    consecutive_skipped += 1
                    logger.debug("[%d] ⊘ Skipped: %s", total_count, url)
                    
                    # 检查增量采集阈值
                    if incremental_threshold > 0 and consecutive_skipped >= incremental_threshold:
                        logger.info("=" * 60)
                        logger.info("🛑 Reached incremental boundary: %d consecutive skipped", consecutive_skipped)
                        logger.info("   Stopping reposts collection")
                        logger.info("=" * 60)
                        return collected_count
                else:
                    logger.warning("[%d] ✗ Failed: %s", total_count, url)
        
        logger.info("Reposts collection complete: %d reposts found, %d collected, %d skipped",
                   total_count, collected_count, skipped_count)
        
        return collected_count
    
    def sync(self, output_dir: Path, since=None) -> int:
        """
        同步 X 数据
        
        流程：
        1. 采集 Likes（从新到旧）
        2. 采集 Bookmarks（从新到旧）
        3. 采集 Reposts（从新到旧）
        4. 增量采集：连续 N 个 skipped 后停止
        
        Returns:
            本次新增采集总数
        """
        config = get_config()
        
        logger.info("=" * 60)
        logger.info("X (Twitter) Collector")
        logger.info("=" * 60)
        
        # 检查配置
        if not self._bearer_token:
            logger.error("X_BEARER_TOKEN not set. Please configure in .env")
            logger.error("See: https://developer.x.com/en/docs/authentication/oauth-2-0")
            return 0
        
        if not self._user_id_or_username:
            logger.error("X_USER_ID not set. Please configure in .env")
            logger.error("You can set either your numeric user ID or username (e.g., 'foralienzhou')")
            return 0
        
        # 解析用户 ID
        user_id = self._resolve_user_id()
        if not user_id:
            logger.error("Failed to resolve user ID. Check your X_USER_ID setting.")
            return 0
        
        logger.info("User ID: %s (from: %s)", user_id, self._user_id_or_username)
        
        total_collected = 0
        
        # 采集 Likes
        logger.info("")
        logger.info(">>> Collecting Likes...")
        logger.info("-" * 40)
        total_collected += self._collect_likes_bookmarks('likes', output_dir)
        
        # 采集 Bookmarks
        logger.info("")
        logger.info(">>> Collecting Bookmarks...")
        logger.info("-" * 40)
        total_collected += self._collect_likes_bookmarks('bookmarks', output_dir)
        
        # 采集 Reposts
        logger.info("")
        logger.info(">>> Collecting Reposts...")
        logger.info("-" * 40)
        total_collected += self._collect_reposts(output_dir)
        
        logger.info("=" * 60)
        logger.info("X sync complete. Total collected: %d", total_collected)
        logger.info("=" * 60)
        
        return total_collected
