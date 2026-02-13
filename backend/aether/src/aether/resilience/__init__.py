"""
Aether Resilience Module

Provides error handling and resilience capabilities:
- Error classification and handling decorators
- Validation utilities
- Safe mathematical operations
- Error recovery strategies
- Graceful degradation patterns
"""

from aether.resilience.error_handling import (
    # Error types
    ErrorSeverity,
    ErrorType,
    # Decorators
    async_error_handler,
    # Validation
    validate_required_fields,
    validate_numeric_range,
    validate_type,
    get_safe_value,
    # Safe operations
    safe_divide,
    safe_calculation,
    # Recovery strategies
    ErrorRecoveryStrategy,
    # Agent execution
    safe_agent_execution,
)

__all__ = [
    # Enums
    "ErrorSeverity",
    "ErrorType",
    # Decorators
    "async_error_handler",
    # Validation
    "validate_required_fields",
    "validate_numeric_range",
    "validate_type",
    "get_safe_value",
    # Operations
    "safe_divide",
    "safe_calculation",
    # Recovery
    "ErrorRecoveryStrategy",
    "safe_agent_execution",
]
