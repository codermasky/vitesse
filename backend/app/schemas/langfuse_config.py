"""LangFuse Configuration Schemas"""

from pydantic import BaseModel, Field
from datetime import datetime


class LangFuseConfigCreate(BaseModel):
    """Schema for creating LangFuse configuration"""

    public_key: str = Field(..., description="LangFuse public key")
    secret_key: str = Field(..., description="LangFuse secret key")
    host: str = Field(
        default="https://cloud.langfuse.com",
        description="LangFuse host URL (cloud or self-hosted)",
    )
    enabled: bool = Field(default=True, description="Enable LangFuse monitoring")


class LangFuseConfigUpdate(BaseModel):
    """Schema for updating LangFuse configuration"""

    public_key: str | None = Field(None, description="LangFuse public key")
    secret_key: str | None = Field(None, description="LangFuse secret key")
    host: str | None = Field(None, description="LangFuse host URL")
    enabled: bool | None = Field(None, description="Enable/disable LangFuse")


class LangFuseConfigResponse(BaseModel):
    """Schema for LangFuse configuration response"""

    id: str
    public_key: str
    secret_key: str  # Return masked for security
    host: str
    enabled: bool
    created_at: datetime
    updated_at: datetime
    created_by: str | None
    updated_by: str | None

    class Config:
        from_attributes = True

    @property
    def masked_secret_key(self) -> str:
        """Return masked secret key"""
        if self.secret_key and len(self.secret_key) > 4:
            return f"***{self.secret_key[-4:]}"
        return "***"
