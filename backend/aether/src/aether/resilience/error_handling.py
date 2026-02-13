"""
Aether Error Handling & Resilience Utilities

Provides comprehensive error handling for agentic workflows:
1. Standardized exception handling across all agents
2. Validation utilities for input/output data
3. Fallback logic for graceful degradation
4. Error logging and classification
5. Recovery strategies for different error types

Philosophy:
- NEVER raise exceptions that break the workflow
- Always provide sensible defaults and fallbacks
- Log all errors with full context for debugging
- Allow workflow to complete even with partial failures
"""

import functools
import asyncio
from enum import Enum
from typing import Any, Callable, Type, TypeVar, Dict, Optional, List
from datetime import datetime
import structlog

logger = structlog.get_logger(__name__)

# ============================================================================
# ERROR TYPES & CLASSIFICATIONS
# ============================================================================


class ErrorSeverity(str, Enum):
    """Error severity levels for classification and handling."""

    INFO = "info"  # Non-critical informational messages
    WARNING = "warning"  # Potential issues that don't block workflow
    ERROR = "error"  # Significant problems affecting output quality
    CRITICAL = "critical"  # Blocking errors requiring fallback


class ErrorType(str, Enum):
    """Classification of error types for better handling."""

    # Data Validation Errors
    MISSING_FIELD = "missing_field"
    INVALID_TYPE = "invalid_type"
    INVALID_VALUE = "invalid_value"

    # Calculation Errors
    CALCULATION_ERROR = "calculation_error"
    DIVISION_BY_ZERO = "division_by_zero"
    CONSTRAINT_VIOLATION = "constraint_violation"

    # LLM/Service Errors
    LLM_TIMEOUT = "llm_timeout"
    LLM_ERROR = "llm_error"
    API_ERROR = "api_error"
    SERVICE_UNAVAILABLE = "service_unavailable"

    # Data Flow Errors
    MISSING_STATE = "missing_state"
    INCONSISTENT_STATE = "inconsistent_state"

    # Unknown Errors
    UNKNOWN = "unknown"


# ============================================================================
# VALIDATION UTILITIES
# ============================================================================


def validate_required_fields(
    data: Dict[str, Any], required_fields: List[str], context: str = "Data validation"
) -> tuple[bool, List[str]]:
    """
    Validate that all required fields are present in data dict.

    Args:
        data: Dictionary to validate
        required_fields: List of field names that must be present
        context: Context for error logging

    Returns:
        (is_valid, missing_fields): Boolean and list of missing field names
    """
    missing = [f for f in required_fields if f not in data or data[f] is None]

    if missing:
        logger.warning(
            f"{context}: Missing required fields",
            missing_fields=missing,
            provided_fields=list(data.keys()),
        )

    return len(missing) == 0, missing


def validate_numeric_range(
    value: Any, min_val: float = None, max_val: float = None, field_name: str = "Value"
) -> tuple[bool, Optional[str]]:
    """
    Validate that a numeric value is within acceptable range.

    Args:
        value: Value to validate
        min_val: Minimum acceptable value (inclusive)
        max_val: Maximum acceptable value (inclusive)
        field_name: Field name for error messages

    Returns:
        (is_valid, error_message): Validation result and message if invalid
    """
    try:
        num_value = float(value)

        if min_val is not None and num_value < min_val:
            msg = f"{field_name} {num_value} is below minimum {min_val}"
            return False, msg

        if max_val is not None and num_value > max_val:
            msg = f"{field_name} {num_value} exceeds maximum {max_val}"
            return False, msg

        return True, None

    except (ValueError, TypeError) as e:
        return False, f"{field_name} is not a valid number: {e}"


def validate_type(
    value: Any, expected_type: Type, field_name: str = "Value"
) -> tuple[bool, Optional[str]]:
    """
    Validate that a value matches the expected type.

    Args:
        value: Value to validate
        expected_type: Expected type(s)
        field_name: Field name for error messages

    Returns:
        (is_valid, error_message): Validation result
    """
    if isinstance(expected_type, tuple):
        if not isinstance(value, expected_type):
            return (
                False,
                f"{field_name} must be one of {expected_type}, got {type(value).__name__}",
            )
    else:
        if not isinstance(value, expected_type):
            return (
                False,
                f"{field_name} must be {expected_type.__name__}, got {type(value).__name__}",
            )

    return True, None


# ============================================================================
# ASYNC ERROR HANDLING DECORATOR
# ============================================================================

T = TypeVar("T")


def async_error_handler(
    fallback_value: Any = None,
    error_severity: ErrorSeverity = ErrorSeverity.ERROR,
    context: str = "Operation",
):
    """
    Decorator for async functions that provides standardized error handling.

    Usage:
        @async_error_handler(fallback_value={}, context="Data processing")
        async def process_data(input_data):
            return result

    Args:
        fallback_value: Value to return if function fails
        error_severity: Classification of error severity
        context: Context description for logging

    Returns:
        Decorated function that handles errors gracefully
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            try:
                return await func(*args, **kwargs)

            except asyncio.TimeoutError as e:
                logger.error(
                    f"{context} timeout",
                    function=func.__name__,
                    error=str(e),
                    severity=ErrorSeverity.CRITICAL,
                )
                return fallback_value

            except Exception as e:
                logger.error(
                    f"{context} failed",
                    function=func.__name__,
                    error=str(e),
                    error_type=type(e).__name__,
                    severity=error_severity,
                )
                return fallback_value

        return async_wrapper

    return decorator


# ============================================================================
# SAFE MATHEMATICAL OPERATIONS
# ============================================================================


def safe_divide(
    numerator: float,
    denominator: float,
    default: float = 0.0,
    field_name: str = "Ratio",
) -> float:
    """
    Safely perform division with sensible default for division by zero.

    Args:
        numerator: Numerator of division
        denominator: Denominator of division
        default: Value to return if denominator is zero
        field_name: Name of the calculation (for logging)

    Returns:
        Result of division or default value
    """
    if denominator == 0 or denominator is None:
        logger.warning(
            f"Division by zero prevented",
            field=field_name,
            numerator=numerator,
            using_default=default,
        )
        return default

    try:
        return float(numerator) / float(denominator)
    except (ValueError, TypeError) as e:
        logger.warning(
            f"Division calculation error",
            field=field_name,
            error=str(e),
            using_default=default,
        )
        return default


def safe_calculation(
    calculation: Callable[[], float], default: float = 0.0, context: str = "Calculation"
) -> float:
    """
    Safely execute a calculation with error handling.

    Args:
        calculation: Callable that performs the calculation
        default: Value to return if calculation fails
        context: Context for error logging

    Returns:
        Result of calculation or default value
    """
    try:
        result = calculation()
        # Validate result is numeric
        float_result = float(result)
        return float_result
    except Exception as e:
        logger.warning(
            f"{context} failed with error", error=str(e), using_default=default
        )
        return default


# ============================================================================
# GET SAFE VALUE
# ============================================================================


def get_safe_value(
    data: Dict[str, Any],
    key: str,
    default: Any = None,
    expected_type: Type = None,
    context: str = "Value extraction",
) -> Any:
    """
    Safely extract value from dictionary with type validation.

    Args:
        data: Dictionary to extract from
        key: Key to extract
        default: Default value if key missing
        expected_type: Optional type to validate
        context: Context for error logging

    Returns:
        Extracted value, with type checking and defaults applied
    """
    value = data.get(key, default)

    if value is None:
        return default

    if expected_type and not isinstance(value, expected_type):
        logger.warning(
            f"{context}: Type mismatch",
            key=key,
            expected_type=expected_type.__name__,
            actual_type=type(value).__name__,
            using_default=default,
        )
        return default

    return value


# ============================================================================
# ERROR RECOVERY STRATEGIES
# ============================================================================


class ErrorRecoveryStrategy:
    """Strategies for recovering from different error types."""

    @staticmethod
    def recover_from_missing_field(
        data: Dict[str, Any],
        field_name: str,
        field_type: Type,
        default_factory: Callable = None,
    ) -> Any:
        """Recover from missing field by using default or factory function."""
        if default_factory:
            try:
                return default_factory()
            except Exception as e:
                logger.error(f"Default factory failed for {field_name}: {e}")
                return None

        # Provide type-based defaults
        type_defaults = {
            int: 0,
            float: 0.0,
            str: "",
            list: [],
            dict: {},
            bool: False,
        }

        return type_defaults.get(field_type, None)

    @staticmethod
    def recover_from_invalid_value(
        current_value: Any,
        min_val: float = None,
        max_val: float = None,
        default: Any = None,
    ) -> Any:
        """Recover from invalid numeric value by clamping or using default."""
        if default is not None:
            return default

        # Try to clamp value to acceptable range
        try:
            num_val = float(current_value)

            if min_val is not None and num_val < min_val:
                return float(min_val)

            if max_val is not None and num_val > max_val:
                return float(max_val)

            return num_val
        except:
            return default

    @staticmethod
    def recover_from_llm_error(
        fallback_text: str = None, context: str = "LLM operation"
    ) -> str:
        """Recover from LLM error with fallback text."""
        if fallback_text:
            return fallback_text

        return f"[Unable to generate {context} due to service error. Please retry.]"


# ============================================================================
# WORKFLOW-LEVEL ERROR HANDLING
# ============================================================================


async def safe_agent_execution(
    agent_func: Callable,
    state: Any,
    agent_name: str,
    fallback_handler: Callable = None,
    **kwargs,
) -> Any:
    """
    Safely execute an agent function with comprehensive error handling.

    Args:
        agent_func: Agent's run() or execute() method
        state: State to process
        agent_name: Name of agent (for logging)
        fallback_handler: Optional callable to generate fallback state
        **kwargs: Additional arguments to pass to agent_func

    Returns:
        Result from agent_func, or fallback state if execution fails
    """
    try:
        workflow_id = getattr(state, "workflow_id", "unknown")
        logger.info(f"Starting {agent_name} execution", workflow_id=workflow_id)
        result = await agent_func(state, **kwargs)
        logger.info(f"{agent_name} completed successfully", workflow_id=workflow_id)
        return result

    except asyncio.TimeoutError as e:
        workflow_id = getattr(state, "workflow_id", "unknown")
        logger.error(
            f"{agent_name} timed out",
            workflow_id=workflow_id,
            timeout_error=str(e),
        )

        if fallback_handler:
            return fallback_handler(state, e)
        return state

    except Exception as e:
        workflow_id = getattr(state, "workflow_id", "unknown")
        logger.error(
            f"{agent_name} failed",
            workflow_id=workflow_id,
            error=str(e),
            error_type=type(e).__name__,
        )

        if fallback_handler:
            return fallback_handler(state, e)
        return state
