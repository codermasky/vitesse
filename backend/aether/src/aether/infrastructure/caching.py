"""
Caching layer for agent operations and external API calls.

This module provides:
1. LLM call result caching (hash prompt → cache result)
2. API response caching with TTL
3. Request deduplication (prevent duplicate concurrent requests)
4. Cache statistics and monitoring
"""

import hashlib
import json
import asyncio
from typing import Any, Dict, Optional, TypeVar, Union
from datetime import datetime, timedelta
from dataclasses import dataclass
import structlog

logger = structlog.get_logger(__name__)

T = TypeVar("T")


@dataclass
class CacheEntry:
    """Represents a cached value with metadata."""

    value: Any
    created_at: datetime
    expires_at: datetime
    hit_count: int = 0

    def is_expired(self) -> bool:
        """Check if entry has expired."""
        return datetime.now() > self.expires_at

    def record_hit(self) -> None:
        """Record a cache hit."""
        self.hit_count += 1


class CacheManager:
    """Manages caching of LLM calls and API responses."""

    def __init__(self, default_ttl_seconds: int = 3600):
        """
        Initialize cache manager.

        Args:
            default_ttl_seconds: Default time-to-live for cache entries (1 hour)
        """
        self.cache: Dict[str, CacheEntry] = {}
        self.default_ttl = timedelta(seconds=default_ttl_seconds)
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self.stats = {
            "hits": 0,
            "misses": 0,
            "expirations": 0,
            "deduplications": 0,
        }

    @staticmethod
    def _hash_key(key_data: Union[str, Dict[str, Any]]) -> str:
        """
        Create a hash key from input data.

        Args:
            key_data: String or dict to hash

        Returns:
            SHA256 hash as hex string
        """
        if isinstance(key_data, dict):
            # Sort dict for consistent hashing
            key_str = json.dumps(key_data, sort_keys=True)
        else:
            key_str = str(key_data)

        return hashlib.sha256(key_str.encode()).hexdigest()

    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.

        Args:
            key: Cache key (will be hashed)

        Returns:
            Cached value or None if not found/expired
        """
        hash_key = self._hash_key(key)

        if hash_key not in self.cache:
            self.stats["misses"] += 1
            return None

        entry = self.cache[hash_key]

        if entry.is_expired():
            del self.cache[hash_key]
            self.stats["expirations"] += 1
            logger.debug(f"Cache entry expired: {hash_key[:8]}...")
            return None

        entry.record_hit()
        self.stats["hits"] += 1
        logger.debug(
            f"Cache hit: {hash_key[:8]}... (hits: {entry.hit_count})",
        )
        return entry.value

    def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        """
        Set value in cache.

        Args:
            key: Cache key (will be hashed)
            value: Value to cache
            ttl_seconds: Time-to-live in seconds (uses default if None)
        """
        hash_key = self._hash_key(key)
        ttl = timedelta(seconds=ttl_seconds) if ttl_seconds else self.default_ttl

        entry = CacheEntry(
            value=value,
            created_at=datetime.now(),
            expires_at=datetime.now() + ttl,
        )
        self.cache[hash_key] = entry
        logger.debug(f"Cache set: {hash_key[:8]}... (TTL: {ttl_seconds}s)")

    def clear(self) -> None:
        """Clear all cache entries."""
        self.cache.clear()
        self.pending_requests.clear()
        logger.info("Cache cleared")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_requests = self.stats["hits"] + self.stats["misses"]
        hit_rate = (
            (self.stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        )

        return {
            "total_entries": len(self.cache),
            "hits": self.stats["hits"],
            "misses": self.stats["misses"],
            "hit_rate_percent": f"{hit_rate:.1f}",
            "expirations": self.stats["expirations"],
            "deduplications": self.stats["deduplications"],
        }

    async def get_or_fetch(
        self,
        key: str,
        fetch_fn: callable,
        ttl_seconds: Optional[int] = None,
    ) -> Any:
        """
        Get value from cache, or fetch if not cached.

        Also implements request deduplication - if the same request is already
        pending, await the existing request instead of making a duplicate.

        Args:
            key: Cache key
            fetch_fn: Async function to fetch value if not cached
            ttl_seconds: Time-to-live in seconds

        Returns:
            Cached or fetched value
        """
        hash_key = self._hash_key(key)

        # Check cache first
        cached_value = self.get(key)
        if cached_value is not None:
            return cached_value

        # Check if request is already pending (deduplication)
        if hash_key in self.pending_requests:
            self.stats["deduplications"] += 1
            logger.debug(f"Request deduplication: {hash_key[:8]}...")
            return await self.pending_requests[hash_key]

        # Fetch new value
        future: asyncio.Future = asyncio.get_event_loop().create_future()
        self.pending_requests[hash_key] = future

        try:
            result = await fetch_fn()
            self.set(key, result, ttl_seconds)
            future.set_result(result)
            return result
        except Exception as e:
            future.set_exception(e)
            raise
        finally:
            # Clean up pending request
            if hash_key in self.pending_requests:
                del self.pending_requests[hash_key]


# Global cache instances
_llm_cache = CacheManager(default_ttl_seconds=7200)  # 2 hours for LLM
_api_cache = CacheManager(default_ttl_seconds=3600)  # 1 hour for APIs
_collateral_cache = CacheManager(default_ttl_seconds=1800)  # 30 min for collateral


def get_llm_cache() -> CacheManager:
    """Get LLM result cache instance."""
    return _llm_cache


def get_api_cache() -> CacheManager:
    """Get API response cache instance."""
    return _api_cache


def get_collateral_cache() -> CacheManager:
    """Get collateral data cache instance."""
    return _collateral_cache


def cache_llm_result(prompt: Union[str, Dict[str, Any]], result: Any) -> None:
    """Cache an LLM result by prompt."""
    _llm_cache.set(prompt, result)


async def get_cached_llm_result(
    prompt: Union[str, Dict[str, Any]],
    fetch_fn: callable,
) -> Any:
    """Get cached LLM result or fetch if not cached."""
    return await _llm_cache.get_or_fetch(prompt, fetch_fn)


def cache_api_response(endpoint: str, params: Dict[str, Any], result: Any) -> None:
    """Cache an API response."""
    key = f"{endpoint}:{json.dumps(params, sort_keys=True)}"
    _api_cache.set(key, result)


async def get_cached_api_response(
    endpoint: str,
    params: Dict[str, Any],
    fetch_fn: callable,
) -> Any:
    """Get cached API response or fetch if not cached."""
    key = f"{endpoint}:{json.dumps(params, sort_keys=True)}"
    return await _api_cache.get_or_fetch(key, fetch_fn)


def get_cache_stats() -> Dict[str, Any]:
    """Get statistics for all caches."""
    return {
        "llm_cache": _llm_cache.get_stats(),
        "api_cache": _api_cache.get_stats(),
        "collateral_cache": _collateral_cache.get_stats(),
    }


def clear_all_caches() -> None:
    """Clear all caches."""
    _llm_cache.clear()
    _api_cache.clear()
    _collateral_cache.clear()
    logger.info("All caches cleared")
