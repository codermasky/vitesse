from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import structlog
import traceback

logger = structlog.get_logger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as e:
            # Generate a unique error ID for tracking
            import uuid

            error_id = str(uuid.uuid4())

            logger.error(
                "Unhandled exception",
                error_id=error_id,
                path=request.url.path,
                method=request.method,
                error=str(e),
                traceback=traceback.format_exc(),
            )

            # Determine status code based on exception type (simple heuristic)
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            if "ValueError" in str(type(e)):
                status_code = status.HTTP_400_BAD_REQUEST
            elif "PermissionError" in str(type(e)):
                status_code = status.HTTP_403_FORBIDDEN
            elif "NotFound" in str(type(e)):
                status_code = status.HTTP_404_NOT_FOUND

            return JSONResponse(
                status_code=status_code,
                content={
                    "status": "error",
                    "error_id": error_id,
                    "message": str(e) if status_code < 500 else "Internal Server Error",
                    "type": type(e).__name__,
                },
            )
