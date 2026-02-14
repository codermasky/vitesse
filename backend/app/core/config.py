from typing import List, Optional, Union
from pydantic import AnyHttpUrl, field_validator, ValidationInfo
from pydantic_settings import BaseSettings
import os
from pathlib import Path

# Project root (backend directory)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Application settings."""

    # Project
    PROJECT_NAME: str = "Vitesse AI"
    API_V1_STR: str = "/api/v1"

    # Server
    SERVER_NAME: str = "Vitesse AI"
    SERVER_HOST: AnyHttpUrl = "http://localhost"
    SERVER_PORT: int = 8000

    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Database
    POSTGRES_SERVER: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_PORT: int = 5433  # Mapped port in Docker
    DATABASE_URI: Optional[str] = None

    @property
    def sql_database_uri(self) -> str:
        """Generate SQLAlchemy database URI."""
        if self.DATABASE_URI:
            return self.DATABASE_URI
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None
    REDIS_URL: Optional[str] = None  # Allow direct URI configuration

    @property
    def redis_uri(self) -> str:
        """Generate Redis URI."""
        if self.REDIS_URL:
            return self.REDIS_URL
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # Vector Database
    VECTOR_DB_TYPE: str = "faiss"  # pinecone, weaviate, faiss
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENVIRONMENT: Optional[str] = None
    PINECONE_INDEX_NAME: str = "vitesse-knowledge"

    # LLM Configuration
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    DEFAULT_LLM_MODEL: str = "anthropic.claude-3-sonnet-20240229-v1:0"
    ENABLE_VISION: bool = False  # Enable multi-modal analysis by default
    ENABLE_VISION: bool = False  # Enable multi-modal analysis by default
    ENABLE_DEVILS_ADVOCATE: bool = True  # Enable critique agent by default

    # Ollama Remote (Fallback/Production)
    OLLAMA_REMOTE_API_BASE: str = "https://aitools-internal.linedata.com/api/v1"
    OLLAMA_REMOTE_API_KEY: str = "sk-c364bc614cd44e7c8c73726c3ce6f539"

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hour

    # Azure AD SSO
    AZURE_AD_ENABLED: bool = False
    AZURE_AD_CLIENT_ID: Optional[str] = None
    AZURE_AD_CLIENT_SECRET: Optional[str] = None
    AZURE_AD_TENANT_ID: Optional[str] = None
    AZURE_AD_REDIRECT_URI: Optional[str] = None
    AZURE_AD_SCOPES: str = "User.Read"
    AZURE_AD_AUTHORITY: Optional[str] = None

    @property
    def azure_ad_authority(self) -> Optional[str]:
        """Generate Azure AD authority URL."""
        if self.AZURE_AD_TENANT_ID:
            return f"https://login.microsoftonline.com/{self.AZURE_AD_TENANT_ID}"
        return None

    # File Upload
    UPLOAD_DIR: str = str(ROOT_DIR / "uploads")
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB

    # Celery
    CELERY_BROKER_URL: Optional[str] = None
    CELERY_RESULT_BACKEND: Optional[str] = None

    @property
    def celery_broker_uri(self) -> str:
        """Generate Celery broker URI."""
        return self.CELERY_BROKER_URL or self.redis_uri

    @property
    def celery_result_backend_uri(self) -> str:
        """Generate Celery result backend URI."""
        return self.CELERY_RESULT_BACKEND or self.redis_uri

    # SharePoint Integration
    SHAREPOINT_ENABLED: bool = False
    SHAREPOINT_CLIENT_ID: Optional[str] = None
    SHAREPOINT_CLIENT_SECRET: Optional[str] = None
    SHAREPOINT_TENANT_ID: Optional[str] = None
    SHAREPOINT_SITE_URL: Optional[str] = None
    SHAREPOINT_SERVER_URL: Optional[str] = None  # For SharePoint Server
    SHAREPOINT_USERNAME: Optional[str] = None  # For SharePoint Server
    SHAREPOINT_PASSWORD: Optional[str] = None  # For SharePoint Server
    SHAREPOINT_TYPE: str = "online"  # online or server
    SHAREPOINT_SYNC_INTERVAL: int = 3600  # seconds, default 1 hour

    # Email Integration
    EMAIL_ENABLED: bool = False
    EMAIL_IMAP_SERVER: str = "imap.gmail.com"
    EMAIL_IMAP_PORT: int = 993
    EMAIL_USERNAME: Optional[str] = None
    EMAIL_PASSWORD: Optional[str] = None
    EMAIL_POLL_INTERVAL: int = 60  # seconds
    EMAIL_ALLOWED_SENDERS: List[str] = []  # Empty list means allow all, verify in agent

    # Observability
    ENABLE_TELEMETRY: bool = False
    OTLP_ENDPOINT: str = "http://localhost:4317"
    SENTRY_DSN: Optional[str] = None
    ENVIRONMENT: str = "development"

    # LangFuse (LLM Monitoring)
    LANGFUSE_PUBLIC_KEY: Optional[str] = None
    LANGFUSE_SECRET_KEY: Optional[str] = None
    LANGFUSE_HOST: str = "http://localhost:3000"  # Self-hosted or cloud
    LANGFUSE_PUBLIC_HOST: Optional[str] = (
        None  # Public URL for dashboard (if different from internal host)
    )
    ENABLE_LANGFUSE: bool = False  # Set to True when deployed with LangFuse

    @property
    def langfuse_dashboard_url(self) -> str:
        """Get the public URL for LangFuse dashboard."""
        return self.LANGFUSE_PUBLIC_HOST or self.LANGFUSE_HOST

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
