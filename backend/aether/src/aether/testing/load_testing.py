"""
Load Testing Framework for Agentic Workflows

Provides utilities for load testing agents and workflows:
- Concurrent request simulation
- Performance metrics collection
- Bottleneck identification
"""

import asyncio
import time
import structlog
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime

logger = structlog.get_logger(__name__)


@dataclass
class LoadTestResult:
    """Results from a load test run."""

    # Test configuration
    total_requests: int
    concurrency: int
    duration_seconds: float

    # Performance metrics
    successful_requests: int
    failed_requests: int
    requests_per_second: float

    # Latency metrics
    min_latency: float
    max_latency: float
    avg_latency: float
    p50_latency: float
    p95_latency: float
    p99_latency: float

    # Individual request data
    request_latencies: List[float] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "total_requests": self.total_requests,
            "concurrency": self.concurrency,
            "duration_seconds": round(self.duration_seconds, 2),
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "success_rate": round(
                self.successful_requests / self.total_requests * 100, 2
            ),
            "requests_per_second": round(self.requests_per_second, 2),
            "latency": {
                "min": round(self.min_latency, 3),
                "max": round(self.max_latency, 3),
                "avg": round(self.avg_latency, 3),
                "p50": round(self.p50_latency, 3),
                "p95": round(self.p95_latency, 3),
                "p99": round(self.p99_latency, 3),
            },
            "errors": {
                "count": len(self.errors),
                "samples": self.errors[:5],  # First 5 errors
            },
        }


class LoadTester:
    """
    Load tester for agentic workflows.

    Example:
        tester = LoadTester()

        async def request_generator():
            return {"query": "test"}

        results = await tester.run_load_test(
            target=my_agent.execute,
            request_generator=request_generator,
            total_requests=100,
            concurrency=10,
        )

        print(f"RPS: {results.requests_per_second}")
        print(f"P95 latency: {results.p95_latency}s")
    """

    def __init__(self):
        self.results: List[LoadTestResult] = []

    async def run_load_test(
        self,
        target: Callable,
        request_generator: Callable,
        total_requests: int = 100,
        concurrency: int = 10,
        warmup_requests: int = 0,
    ) -> LoadTestResult:
        """
        Run a load test.

        Args:
            target: Async function to test (e.g., agent.execute)
            request_generator: Async function that generates request data
            total_requests: Total number of requests to make
            concurrency: Number of concurrent requests
            warmup_requests: Number of warmup requests (not counted)

        Returns:
            LoadTestResult with metrics
        """
        logger.info(
            "load_test_starting",
            total_requests=total_requests,
            concurrency=concurrency,
            warmup=warmup_requests,
        )

        # Warmup
        if warmup_requests > 0:
            await self._run_requests(
                target,
                request_generator,
                warmup_requests,
                concurrency,
            )
            logger.info("warmup_complete", count=warmup_requests)

        # Actual test
        start_time = time.time()

        latencies, errors = await self._run_requests(
            target,
            request_generator,
            total_requests,
            concurrency,
        )

        duration = time.time() - start_time

        # Calculate metrics
        successful = len(latencies)
        failed = len(errors)

        if latencies:
            sorted_latencies = sorted(latencies)
            result = LoadTestResult(
                total_requests=total_requests,
                concurrency=concurrency,
                duration_seconds=duration,
                successful_requests=successful,
                failed_requests=failed,
                requests_per_second=successful / duration if duration > 0 else 0,
                min_latency=min(latencies),
                max_latency=max(latencies),
                avg_latency=sum(latencies) / len(latencies),
                p50_latency=sorted_latencies[int(len(sorted_latencies) * 0.50)],
                p95_latency=sorted_latencies[int(len(sorted_latencies) * 0.95)],
                p99_latency=sorted_latencies[int(len(sorted_latencies) * 0.99)],
                request_latencies=latencies,
                errors=errors,
            )
        else:
            result = LoadTestResult(
                total_requests=total_requests,
                concurrency=concurrency,
                duration_seconds=duration,
                successful_requests=0,
                failed_requests=failed,
                requests_per_second=0,
                min_latency=0,
                max_latency=0,
                avg_latency=0,
                p50_latency=0,
                p95_latency=0,
                p99_latency=0,
                errors=errors,
            )

        self.results.append(result)

        logger.info(
            "load_test_complete",
            **result.to_dict(),
        )

        return result

    async def _run_requests(
        self,
        target: Callable,
        request_generator: Callable,
        total: int,
        concurrency: int,
    ) -> tuple[List[float], List[str]]:
        """Run requests with concurrency control."""
        latencies = []
        errors = []

        semaphore = asyncio.Semaphore(concurrency)

        async def run_single_request():
            async with semaphore:
                try:
                    request_data = await request_generator()

                    start = time.time()
                    await target(request_data)
                    latency = time.time() - start

                    latencies.append(latency)

                except Exception as e:
                    errors.append(str(e))

        # Create all request tasks
        tasks = [run_single_request() for _ in range(total)]

        # Run all with concurrency limit
        await asyncio.gather(*tasks, return_exceptions=True)

        return latencies, errors

    def get_summary(self) -> Dict[str, Any]:
        """Get summary of all load tests run."""
        if not self.results:
            return {"message": "No load tests run yet"}

        return {
            "total_tests": len(self.results),
            "tests": [r.to_dict() for r in self.results],
        }


async def quick_load_test(
    target: Callable,
    sample_request: Dict[str, Any],
    requests: int = 100,
    concurrency: int = 10,
) -> LoadTestResult:
    """
    Quick helper for simple load tests.

    Args:
        target: Async function to test
        sample_request: Sample request to use for all requests
        requests: Number of requests
        concurrency: Concurrent requests

    Returns:
        LoadTestResult

    Example:
        results = await quick_load_test(
            target=agent.execute,
            sample_request={"query": "test"},
            requests=50,
            concurrency=5,
        )
    """

    async def request_gen():
        return sample_request

    tester = LoadTester()
    return await tester.run_load_test(
        target=target,
        request_generator=request_gen,
        total_requests=requests,
        concurrency=concurrency,
    )
