"""
Enhanced Intelligence Provider for Aether

Extends the base IntelligenceProvider protocol with production-ready features:
- Automatic PII masking for compliance
- Structured output with fallback JSON parsing
- Error handling and retry logic
- Convenience methods for common patterns
- Metrics integration

This is a reference implementation that can be extended or replaced.
"""

import json
import re
import structlog
from typing import Any, Dict, Optional, Type
from pydantic import BaseModel

from aether.protocols.intelligence import IntelligenceProvider
from aether.security import mask_pii_in_data
from aether.resilience import async_error_handler, ErrorSeverity

logger = structlog.get_logger(__name__)


class EnhancedIntelligenceProvider:
    """
    Enhanced implementation of IntelligenceProvider with production features.

    This is a wrapper around any LLM that adds:
    - PII masking
    - Structured output with fallback parsing
    - Error handling
    - Convenience methods

    Usage:
        llm = YourLLMInstance()  # langchain LLM
        provider = EnhancedIntelligenceProvider(llm, agent_id="my_agent")

        # Structured output
        result = await provider.ainvoke_structured(
            prompt="Extract info from text",
            output_schema=MySchema
        )
    """

    def __init__(
        self,
        llm: Any,
        agent_id: str = "default",
        mask_pii: bool = True,
        enable_fallback_parsing: bool = True,
    ):
        """
        Initialize enhanced intelligence provider.

        Args:
            llm: LangChain-compatible LLM instance
            agent_id: Identifier for this agent (for logging/metrics)
            mask_pii: Whether to automatically mask PII in prompts
            enable_fallback_parsing: Whether to attempt manual JSON parsing on failure
        """
        self.llm = llm
        self.agent_id = agent_id
        self.mask_pii = mask_pii
        self.enable_fallback_parsing = enable_fallback_parsing

    @async_error_handler(
        fallback_value=None,
        error_severity=ErrorSeverity.ERROR,
        context="LLM invocation",
    )
    async def ainvoke(
        self, prompt: Any, config: Optional[Dict[str, Any]] = None, **kwargs
    ) -> Any:
        """
        Invoke the LLM asynchronously with PII masking.

        Args:
            prompt: The prompt (str, list of messages, etc.)
            config: Optional configuration
            **kwargs: Additional arguments to pass to LLM

        Returns:
            LLM response content
        """
        # Mask PII if enabled
        masked_prompt = mask_pii_in_data(prompt) if self.mask_pii else prompt

        response = await self.llm.ainvoke(masked_prompt, config=config, **kwargs)

        # Extract content from response
        if hasattr(response, "content"):
            return response.content
        return response

    async def ainvoke_structured(
        self,
        prompt: Any,
        output_schema: Type[BaseModel],
        config: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> BaseModel:
        """
        Invoke LLM and return structured Pydantic output.

        This method tries multiple strategies:
        1. Native structured output (if LLM supports it)
        2. Fallback JSON parsing from response text
        3. Error with helpful message

        Args:
            prompt: The prompt
            output_schema: Pydantic model class for output
            config: Optional configuration
            **kwargs: Additional arguments

        Returns:
            Pydantic model instance

        Raises:
            ValueError: If parsing fails
        """
        # Mask PII if enabled
        masked_prompt = mask_pii_in_data(prompt) if self.mask_pii else prompt

        # Try native structured output first
        if hasattr(self.llm, "with_structured_output"):
            try:
                structured_llm = self.llm.with_structured_output(
                    output_schema, method="function_calling"
                )
                result = await structured_llm.ainvoke(
                    masked_prompt, config=config, **kwargs
                )

                if result:
                    return result

                logger.warning(
                    f"with_structured_output returned None for {self.agent_id}, falling back to manual parse"
                )
            except Exception as e:
                logger.warning(
                    f"Structured output failed for {self.agent_id}: {e}, falling back to manual parse"
                )

        # Fallback to manual JSON parsing
        if self.enable_fallback_parsing:
            try:
                response = await self.llm.ainvoke(
                    masked_prompt, config=config, **kwargs
                )
                content = (
                    response.content if hasattr(response, "content") else str(response)
                )

                # Extract JSON from response
                parsed_data = self._extract_json(content)

                # Validate and return
                return output_schema.model_validate(parsed_data)

            except Exception as e:
                logger.error(
                    f"Failed to parse LLM response for {self.agent_id}: {e}",
                    content=content[:500] if "content" in locals() else "N/A",
                )
                raise ValueError(
                    f"Could not parse structured output from LLM response. "
                    f"Schema: {output_schema.__name__}, Error: {e}"
                )
        else:
            raise ValueError(
                f"LLM does not support structured output and fallback parsing is disabled"
            )

    def _extract_json(self, text: str) -> Dict[str, Any]:
        """
        Extract JSON object from text response.

        Args:
            text: Text potentially containing JSON

        Returns:
            Parsed JSON dict

        Raises:
            ValueError: If no valid JSON found
        """
        # Try to find JSON block in markdown code fence
        code_fence_pattern = r"```(?:json)?\s*(\{.*?\})\s*```"
        match = re.search(code_fence_pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to find raw JSON object
        json_pattern = r"\{.*\}"
        match = re.search(json_pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        # Last resort: try parsing entire text
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise ValueError(f"No valid JSON found in response: {e}")

    async def generate_structured_output(
        self,
        schema: Type[BaseModel],
        system_prompt: str,
        user_prompt: str,
        **kwargs,
    ) -> BaseModel:
        """
        Convenience method for structured generation with system/user prompts.

        Args:
            schema: Pydantic model for output
            system_prompt: System instruction
            user_prompt: User message
            **kwargs: Additional arguments

        Returns:
            Pydantic model instance
        """
        from langchain_core.messages import SystemMessage, HumanMessage

        prompt = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        return await self.ainvoke_structured(prompt, schema, **kwargs)

    async def batch_ainvoke(
        self,
        prompts: list,
        config: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> list:
        """
        Invoke LLM on multiple prompts in batch (if supported).

        Args:
            prompts: List of prompts
            config: Optional configuration
            **kwargs: Additional arguments

        Returns:
            List of responses
        """
        if self.mask_pii:
            prompts = [mask_pii_in_data(p) for p in prompts]

        if hasattr(self.llm, "abatch"):
            responses = await self.llm.abatch(prompts, config=config, **kwargs)
            return [r.content if hasattr(r, "content") else r for r in responses]
        else:
            # Fallback to sequential if batch not supported
            logger.warning(f"LLM does not support batch, falling back to sequential")
            results = []
            for prompt in prompts:
                result = await self.ainvoke(prompt, config=config, **kwargs)
                results.append(result)
            return results
