"""
Aether Infrastructure Module

Provides infrastructure capabilities for agentic applications:
- Multi-tier caching with TTL and request deduplication
- Checkpoint management for workflow persistence
- Performance optimization utilities
"""

from aether.infrastructure.caching import (
    CacheManager,
    CacheEntry,
    get_llm_cache,
    get_api_cache,
    cache_llm_result,
    get_cached_llm_result,
    get_cache_stats,
    clear_all_caches,
)

__all__ = [
    # Core classes
    "CacheManager",
    "CacheEntry",
    # Cache instances
    "get_llm_cache",
    "get_api_cache",
    # Utilities
    "cache_llm_result",
    "get_cached_llm_result",
    "get_cache_stats",
    "clear_all_caches",
]
