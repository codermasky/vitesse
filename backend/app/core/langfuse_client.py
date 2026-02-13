"""
LangFuse client initialization for LLM call monitoring and tracing.

LangFuse captures:
- Every LLM API call (input, output, model, latency)
- Token usage (input/output tokens)
- Cost tracking
- Trace hierarchies (e.g., Agent A calls LLM, then Agent B calls LLM)
- Custom metadata (deal_id, agent_name, workflow_id)

Documentation: https://langfuse.com/docs
"""

import structlog
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

logger = structlog.get_logger(__name__)

# Global LangFuse client instance
_langfuse_client = None


def init_langfuse(
    public_key: Optional[str] = None,
    secret_key: Optional[str] = None,
    host: str = "http://localhost:3000",
    enabled: bool = True,
) -> None:
    """
    Initialize LangFuse client.

    Args:
        public_key: LangFuse public API key
        secret_key: LangFuse secret API key
        host: LangFuse host (self-hosted or cloud)
        enabled: Whether to enable LangFuse tracking
    """
    global _langfuse_client

    if not enabled or not public_key or not secret_key:
        logger.warning(
            "LangFuse not enabled or credentials missing",
            enabled=enabled,
            has_public_key=bool(public_key),
            has_secret_key=bool(secret_key),
        )
        _langfuse_client = None
        return

    try:
        from langfuse import Langfuse

        _langfuse_client = Langfuse(
            public_key=public_key,
            secret_key=secret_key,
            host=host,
        )

        logger.info(
            "LangFuse initialized successfully",
            host=host,
            public_key_preview=public_key[:10] + "..." if public_key else None,
            client_id=id(_langfuse_client),
        )
        try:
            logger.info(f"Langfuse Client State: {dir(_langfuse_client)}")
        except:
            pass
    except ImportError:
        logger.error("LangFuse package not installed")
        _langfuse_client = None
    except Exception as e:
        logger.error(f"Failed to initialize LangFuse: {e}")
        _langfuse_client = None


def get_langfuse_client():
    """Get the global LangFuse client instance."""
    return _langfuse_client


def is_langfuse_enabled() -> bool:
    """Check if LangFuse is enabled and configured."""
    return _langfuse_client is not None


@asynccontextmanager
async def trace_llm_call(
    name: str,
    model: str,
    input_tokens: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
    # NEW: Prompt template metadata for linking traces to Vitesse prompts
    prompt_template_id: Optional[str] = None,
    prompt_template_name: Optional[str] = None,
    prompt_version: Optional[int] = None,
    prompt_content: Optional[str] = None,
):
    """
    Context manager to trace an LLM call with LangFuse.

    Usage:
        async with trace_llm_call(
            name="extract_covenants",
            model="gpt-4",
            metadata={"agent": "covenant_compliance", "deal_id": "DEAL-123"},
            prompt_template_id="uuid-123",
            prompt_template_name="extract_covenants_v3",
            prompt_version=3,
            prompt_content=full_prompt_text
        ):
            response = await llm.invoke(prompt)

    Args:
        name: Name of the operation (e.g., "extract_covenants")
        model: Model name (e.g., "gpt-4", "claude-3-5-sonnet")
        input_tokens: Optional input token count
        metadata: Optional custom metadata dict
        prompt_template_id: ID of prompt template from Vitesse's prompt_templates table
        prompt_template_name: Human-readable name of the prompt template
        prompt_version: Version number of the prompt template
        prompt_content: Full prompt text (for Langfuse prompt tracking)

    Yields:
        LangFuse trace object for recording output
    """
    if not is_langfuse_enabled():
        # No-op if LangFuse not enabled
        yield None
        return

    generation = None
    try:
        client = get_langfuse_client()
        # Debug logging to catch weird URL issues
        if client:
            logger.debug(
                "Starting LangFuse span",
                client_id=id(client),
                base_url=getattr(
                    client, "base_url", getattr(client, "_base_url", "unknown")
                ),
                host_arg=getattr(client, "_host", "unknown"),
            )

        # Enrich metadata with prompt information
        enriched_metadata = metadata.copy() if metadata else {}

        # Add prompt template metadata for linking
        if prompt_template_id:
            enriched_metadata["vitesse_prompt_template_id"] = prompt_template_id
        if prompt_template_name:
            enriched_metadata["vitesse_prompt_template_name"] = prompt_template_name
        if prompt_version is not None:
            enriched_metadata["vitesse_prompt_version"] = prompt_version

        # Create a trace (root span) for this LLM call - v2.x API
        trace = client.trace(
            name=name,
            metadata=enriched_metadata,
        )

        # Create a generation (not span) for LLM operations - v2.x API
        # Generations are specifically for LLM calls and track model, tokens, etc.
        generation = trace.generation(
            name=f"{name}:llm",
            model=model,
            metadata=enriched_metadata,
            # Include prompt content if provided (Langfuse can track prompt versions)
            prompt=prompt_content if prompt_content else None,
        )

        # Set input if available
        if input_tokens:
            generation.update(
                input={"tokens": input_tokens},
            )

        logger.info(
            f"LangFuse generation created successfully for {name}",
            prompt_template_id=prompt_template_id,
            prompt_version=prompt_version,
        )
        yield generation

    except Exception as e:
        logger.warning(f"Error during LangFuse tracing: {e}")
        import traceback

        logger.error(f"Traceback: {traceback.format_exc()}")
        if generation:
            generation.end(level="ERROR", status_message=str(e))
        yield None
    finally:
        if generation:
            generation.end()


def record_llm_call_result(
    generation,
    output: Optional[str] = None,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    cost_usd: Optional[float] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Record the result of an LLM call to LangFuse.

    Args:
        generation: The generation object from trace_llm_call context manager
        output: The LLM output text
        input_tokens: Input token count
        output_tokens: Output token count
        cost_usd: Cost in USD
        metadata: Additional metadata to record
    """
    if not generation or not is_langfuse_enabled():
        return

    try:
        # Update generation with output and usage
        update_data = {}

        if output:
            update_data["output"] = output

        # Set usage with both input and output tokens
        usage = {}
        if input_tokens is not None:
            usage["input"] = input_tokens
        if output_tokens is not None:
            usage["output"] = output_tokens

        if usage:
            update_data["usage"] = usage

        if cost_usd is not None:
            update_data["cost"] = cost_usd

        if metadata:
            update_data["metadata"] = metadata

        if update_data:
            generation.update(**update_data)

    except Exception as e:
        logger.warning(f"Error recording LLM call result to LangFuse: {e}")


def record_error(
    span,
    error: Exception,
    error_type: str = "llm_error",
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Record an error that occurred during an LLM call.

    Args:
        span: The span object
        error: The exception that was raised
        error_type: Type of error
        metadata: Additional metadata
    """
    if not span or not is_langfuse_enabled():
        return

    try:
        span.end(
            status_code="error",
            error=str(error),
        )
    except Exception as e:
        logger.warning(f"Error recording error to LangFuse: {e}")
