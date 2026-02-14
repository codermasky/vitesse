"""
LLM Call Wrapper with LangFuse Instrumentation

Wraps LLM invocations to capture:
- Input prompts and structured data
- Output responses
- Token usage
- Latency
- Errors
- Custom metadata (agent_id, deal_id, workflow_id)

This wrapper is injected into the LLM provider service to provide
transparent instrumentation without modifying agent code.
"""

import time
import structlog
import asyncio
from typing import Any, Optional, Dict
from datetime import datetime

from app.core.langfuse_client import (
    trace_llm_call,
    record_llm_call_result,
    record_error,
    is_langfuse_enabled,
)
from app.core.metrics import record_llm_call

logger = structlog.get_logger(__name__)


class LLMCallWrapper:
    """Wrapper to instrument LLM calls with monitoring and tracing."""

    @staticmethod
    async def invoke_with_monitoring(
        llm_instance: Any,
        prompt: str,
        agent_id: Optional[str] = None,
        operation_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Invoke an LLM with full monitoring instrumentation.

        Args:
            llm_instance: LangChain ChatOpenAI or similar instance
            prompt: Input prompt text
            agent_id: ID of the agent making the call
            operation_name: Name of the operation (e.g., "extract_covenants")
            metadata: Custom metadata (deal_id, workflow_id, etc.)

        Returns:
            LLM response text

        Raises:
            Exception: Re-raises LLM exceptions after recording
        """
        start_time = time.time()
        model_name = getattr(llm_instance, "model_name", "unknown")

        # Build operation name
        op_name = operation_name or f"{agent_id}_invoke" if agent_id else "llm_call"

        # Build metadata
        trace_metadata = {
            "agent_id": agent_id,
            "operation": op_name,
            "timestamp": datetime.utcnow().isoformat(),
            **(metadata or {}),
        }

        span = None
        try:
            # Start LangFuse trace if enabled
            if is_langfuse_enabled():
                ctx = trace_llm_call(
                    name=op_name,
                    model=model_name,
                    metadata=trace_metadata,
                )
                span = await ctx.__aenter__()
                logger.info(f"LANGFUSE_DEBUG: Span created. Object: {span}")
            else:
                logger.warning(
                    "LANGFUSE_DEBUG: LangFuse is NOT enabled. Skipping trace."
                )

            logger.info(
                "llm_call_started",
                agent_id=agent_id,
                operation=op_name,
                model=model_name,
            )

            # Invoke LLM with timeout
            try:
                response = await asyncio.wait_for(
                    llm_instance.ainvoke(prompt), timeout=30.0
                )
            except asyncio.TimeoutError:
                logger.error("llm_call_timeout", agent_id=agent_id, operation=op_name)
                raise Exception(f"LLM call timed out after 30s for {op_name}")

            output_text = (
                response.content if hasattr(response, "content") else str(response)
            )

            elapsed_time = time.time() - start_time

            # Extract token usage if available
            input_tokens = None
            output_tokens = None

            if hasattr(response, "usage_metadata"):
                usage = response.usage_metadata
                input_tokens = usage.get("input_tokens", 0)
                output_tokens = usage.get("output_tokens", 0)
            elif hasattr(response, "response_metadata"):
                metadata_dict = response.response_metadata
                if isinstance(metadata_dict, dict):
                    usage = metadata_dict.get("usage", {})
                    input_tokens = usage.get("input_tokens", 0)
                    output_tokens = usage.get("output_tokens", 0)

            # Estimate cost (simplified - should use provider-specific pricing)
            cost_usd = LLMCallWrapper._estimate_cost(
                model_name, input_tokens, output_tokens
            )

            # Record to Prometheus metrics
            record_llm_call(
                provider="unknown",  # Could extract from model name
                model=model_name,
                duration=elapsed_time,
                tokens_input=input_tokens or 0,
                tokens_output=output_tokens or 0,
                cost=cost_usd,
                success=True,
            )

            # Record to LangFuse if enabled
            if span:
                record_llm_call_result(
                    generation=span,
                    output=output_text[:1000],  # Truncate for display
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost_usd=cost_usd,
                    metadata={
                        "latency_seconds": elapsed_time,
                        "status": "success",
                    },
                )

            logger.info(
                "llm_call_completed",
                agent_id=agent_id,
                operation=op_name,
                model=model_name,
                duration=elapsed_time,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost=cost_usd,
            )

            return output_text

        except Exception as e:
            elapsed_time = time.time() - start_time

            # Record error to metrics
            record_llm_call(
                provider="unknown",
                model=model_name,
                duration=elapsed_time,
                tokens_input=0,
                tokens_output=0,
                cost=0,
                success=False,
            )

            # Record error to LangFuse
            if span:
                record_error(
                    span=span,
                    error=e,
                    error_type="llm_invocation_error",
                    metadata={"agent_id": agent_id, "operation": op_name},
                )

            logger.error(
                "llm_call_failed",
                agent_id=agent_id,
                operation=op_name,
                model=model_name,
                duration=elapsed_time,
                error=str(e),
            )

            raise

    @staticmethod
    async def invoke_structured_with_monitoring(
        llm_instance: Any,
        prompt: str,
        schema: Any,
        agent_id: Optional[str] = None,
        operation_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        db: Optional[Any] = None,  # NEW: Optional database session for prompt lookup
    ) -> Any:
        """
        Invoke an LLM with structured output parsing and monitoring.

        Args:
            llm_instance: LangChain ChatOpenAI instance with .with_structured_output()
            prompt: Input prompt text
            schema: Pydantic schema for output parsing
            agent_id: ID of the agent making the call
            operation_name: Name of the operation
            metadata: Custom metadata
            db: Optional database session for fetching prompt metadata

        Returns:
            Parsed structured output

        Raises:
            Exception: Re-raises LLM exceptions after recording
        """
        start_time = time.time()
        model_name = getattr(llm_instance, "model_name", "unknown")

        op_name = (
            operation_name or f"{agent_id}_structured"
            if agent_id
            else "llm_structured_call"
        )

        trace_metadata = {
            "agent_id": agent_id,
            "operation": op_name,
            "schema": schema.__name__ if hasattr(schema, "__name__") else str(schema),
            "timestamp": datetime.utcnow().isoformat(),
            **(metadata or {}),
        }

        # NEW: Fetch prompt metadata if agent_id and db provided
        prompt_metadata = None
        if agent_id and db:
            try:
                from app.services.prompt_template_service import (
                    prompt_template_service,
                )

                prompt_metadata = (
                    await prompt_template_service.get_prompt_metadata_for_agent(
                        db, agent_id
                    )
                )
                if prompt_metadata:
                    logger.debug(
                        f"Fetched prompt metadata for agent {agent_id}",
                        template_id=prompt_metadata.get("template_id"),
                        version=prompt_metadata.get("version"),
                    )
            except Exception as e:
                logger.warning(
                    f"Failed to fetch prompt metadata for agent {agent_id}: {e}"
                )

        span = None
        try:
            if is_langfuse_enabled():
                # Pass prompt metadata to trace_llm_call
                ctx = trace_llm_call(
                    name=op_name,
                    model=model_name,
                    metadata=trace_metadata,
                    # NEW: Include prompt template metadata
                    prompt_template_id=prompt_metadata.get("template_id")
                    if prompt_metadata
                    else None,
                    prompt_template_name=prompt_metadata.get("template_name")
                    if prompt_metadata
                    else None,
                    prompt_version=prompt_metadata.get("version")
                    if prompt_metadata
                    else None,
                    prompt_content=prompt_metadata.get("content")
                    if prompt_metadata
                    else None,
                )
                span = await ctx.__aenter__()

            logger.info(
                "llm_structured_call_started",
                agent_id=agent_id,
                operation=op_name,
                model=model_name,
                prompt_template=prompt_metadata.get("template_name")
                if prompt_metadata
                else None,
            )

            # Invoke with structured output and timeout
            structured_llm = llm_instance.with_structured_output(schema)
            try:
                response = await asyncio.wait_for(
                    structured_llm.ainvoke(prompt), timeout=60.0
                )
            except asyncio.TimeoutError:
                logger.error(
                    "llm_structured_call_timeout", agent_id=agent_id, operation=op_name
                )
                raise Exception(
                    f"Structured LLM call timed out after 60s for {op_name}"
                )
            except Exception as parse_err:
                # If it's a validation error, let's try to get the raw content for debugging
                logger.error("llm_structured_parsing_failed", error=str(parse_err))
                # Fallback: try standard invoke to see what the model actually returned
                try:
                    raw_resp = await llm_instance.ainvoke(prompt)
                    raw_content = (
                        raw_resp.content
                        if hasattr(raw_resp, "content")
                        else str(raw_resp)
                    )
                    logger.info(
                        "llm_raw_response_for_debug", raw_content=raw_content[:1000]
                    )
                except:
                    pass
                raise

            elapsed_time = time.time() - start_time

            # Extract token usage if available
            input_tokens = None
            output_tokens = None
            # Note: Token counts may not always be available for structured output

            cost_usd = LLMCallWrapper._estimate_cost(
                model_name, input_tokens, output_tokens
            )

            # Record to metrics
            record_llm_call(
                provider="unknown",
                model=model_name,
                duration=elapsed_time,
                tokens_input=input_tokens or 0,
                tokens_output=output_tokens or 0,
                cost=cost_usd,
                success=True,
            )

            # Record to LangFuse
            if span:
                record_llm_call_result(
                    generation=span,
                    output=str(response)[:1000],
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost_usd=cost_usd,
                    metadata={
                        "latency_seconds": elapsed_time,
                        "status": "success",
                        "output_type": "structured",
                    },
                )

            logger.info(
                "llm_structured_call_completed",
                agent_id=agent_id,
                operation=op_name,
                model=model_name,
                duration=elapsed_time,
                cost=cost_usd,
            )

            return response

        except Exception as e:
            elapsed_time = time.time() - start_time

            record_llm_call(
                provider="unknown",
                model=model_name,
                duration=elapsed_time,
                tokens_input=0,
                tokens_output=0,
                cost=0,
                success=False,
            )

            if span:
                record_error(
                    span=span,
                    error=e,
                    error_type="llm_structured_call_error",
                )

            logger.error(
                "llm_structured_call_failed",
                agent_id=agent_id,
                operation=op_name,
                error=str(e),
            )

            raise

    @staticmethod
    def _estimate_cost(
        model_name: str,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
    ) -> float:
        """
        Estimate cost for an LLM call.

        Uses simplified pricing - in production, should use actual provider pricing.
        """
        if not input_tokens or not output_tokens:
            return 0.0

        # Simplified pricing (as of Feb 2025)
        # These are estimates and should be updated based on actual provider pricing
        pricing = {
            "gpt-4": {"input": 0.03, "output": 0.06},  # per 1K tokens
            "gpt-4-turbo": {"input": 0.01, "output": 0.03},
            "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
            "claude-3-opus": {"input": 0.015, "output": 0.075},
            "claude-3-sonnet": {"input": 0.003, "output": 0.015},
            "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
            "claude-3-5-sonnet": {"input": 0.003, "output": 0.015},
        }

        # Find matching pricing
        model_lower = model_name.lower()
        pricing_info = None

        for model_key, price_info in pricing.items():
            if model_key in model_lower:
                pricing_info = price_info
                break

        if not pricing_info:
            # Default fallback pricing
            pricing_info = {"input": 0.001, "output": 0.003}

        cost = (input_tokens / 1000 * pricing_info["input"]) + (
            output_tokens / 1000 * pricing_info["output"]
        )

        return round(cost, 6)
