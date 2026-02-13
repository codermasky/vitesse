from typing import Any, Optional
import json
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.models.setting import SystemSetting
from app.core.config import settings
import structlog

logger = structlog.get_logger(__name__)

# Create sync engine for settings (needed because email service uses sync imaplib)
# We use the standard URI (psycopg2) not the async one
sync_engine = create_engine(settings.sql_database_uri, pool_pre_ping=True, echo=False)
SyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)


class SettingsService:
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Get a setting value by key."""
        with SyncSessionLocal() as db:
            setting = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
            if setting:
                return setting.value
        return default

    def set_setting(
        self, key: str, value: Any, description: Optional[str] = None
    ) -> SystemSetting:
        """Set a setting value by key."""
        with SyncSessionLocal() as db:
            setting = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
            if not setting:
                setting = SystemSetting(key=key, value=value, description=description)
                db.add(setting)
            else:
                setting.value = value
                if description:
                    setting.description = description
            db.commit()
            db.refresh(setting)
            return setting

    def get_email_config(self) -> dict:
        """Get email configuration, falling back to env vars."""
        return {
            "EMAIL_ENABLED": self.get_setting("EMAIL_ENABLED", settings.EMAIL_ENABLED),
            "EMAIL_IMAP_SERVER": self.get_setting(
                "EMAIL_IMAP_SERVER", settings.EMAIL_IMAP_SERVER
            ),
            "EMAIL_IMAP_PORT": self.get_setting(
                "EMAIL_IMAP_PORT", settings.EMAIL_IMAP_PORT
            ),
            "EMAIL_USERNAME": self.get_setting(
                "EMAIL_USERNAME", settings.EMAIL_USERNAME
            ),
            "EMAIL_PASSWORD": self.get_setting(
                "EMAIL_PASSWORD", settings.EMAIL_PASSWORD
            ),
            "EMAIL_POLL_INTERVAL": self.get_setting(
                "EMAIL_POLL_INTERVAL", settings.EMAIL_POLL_INTERVAL
            ),
        }

    def update_email_config(self, config: dict):
        """Update email configuration."""
        for key, value in config.items():
            self.set_setting(key, value, description="Email configuration")

    def get_azure_ad_config(self) -> dict:
        """Get Azure AD configuration, falling back to env vars."""
        return {
            "AZURE_AD_ENABLED": self.get_setting(
                "AZURE_AD_ENABLED", settings.AZURE_AD_ENABLED
            ),
            "AZURE_AD_CLIENT_ID": self.get_setting(
                "AZURE_AD_CLIENT_ID", settings.AZURE_AD_CLIENT_ID
            ),
            "AZURE_AD_CLIENT_SECRET": self.get_setting(
                "AZURE_AD_CLIENT_SECRET", settings.AZURE_AD_CLIENT_SECRET
            ),
            "AZURE_AD_TENANT_ID": self.get_setting(
                "AZURE_AD_TENANT_ID", settings.AZURE_AD_TENANT_ID
            ),
            "AZURE_AD_REDIRECT_URI": self.get_setting(
                "AZURE_AD_REDIRECT_URI", settings.AZURE_AD_REDIRECT_URI
            ),
            "AZURE_AD_SCOPES": self.get_setting(
                "AZURE_AD_SCOPES", settings.AZURE_AD_SCOPES
            ),
        }

    def update_azure_ad_config(self, config: dict):
        """Update Azure AD configuration."""
        for key, value in config.items():
            self.set_setting(key, value, description="Azure AD SSO configuration")

    def get_sharepoint_config(self) -> dict:
        """Get SharePoint configuration, falling back to env vars."""
        return {
            "SHAREPOINT_ENABLED": self.get_setting(
                "SHAREPOINT_ENABLED", settings.SHAREPOINT_ENABLED
            ),
            "SHAREPOINT_CLIENT_ID": self.get_setting(
                "SHAREPOINT_CLIENT_ID", settings.SHAREPOINT_CLIENT_ID
            ),
            "SHAREPOINT_CLIENT_SECRET": self.get_setting(
                "SHAREPOINT_CLIENT_SECRET", settings.SHAREPOINT_CLIENT_SECRET
            ),
            "SHAREPOINT_TENANT_ID": self.get_setting(
                "SHAREPOINT_TENANT_ID", settings.SHAREPOINT_TENANT_ID
            ),
            "SHAREPOINT_SITE_URL": self.get_setting(
                "SHAREPOINT_SITE_URL", settings.SHAREPOINT_SITE_URL
            ),
            "SHAREPOINT_SERVER_URL": self.get_setting(
                "SHAREPOINT_SERVER_URL", settings.SHAREPOINT_SERVER_URL
            ),
            "SHAREPOINT_USERNAME": self.get_setting(
                "SHAREPOINT_USERNAME", settings.SHAREPOINT_USERNAME
            ),
            "SHAREPOINT_PASSWORD": self.get_setting(
                "SHAREPOINT_PASSWORD", settings.SHAREPOINT_PASSWORD
            ),
            "SHAREPOINT_TYPE": self.get_setting(
                "SHAREPOINT_TYPE", settings.SHAREPOINT_TYPE
            ),
            "SHAREPOINT_SYNC_INTERVAL": self.get_setting(
                "SHAREPOINT_SYNC_INTERVAL", settings.SHAREPOINT_SYNC_INTERVAL
            ),
        }

    def update_sharepoint_config(self, config: dict):
        """Update SharePoint configuration."""
        for key, value in config.items():
            self.set_setting(
                key, value, description="SharePoint integration configuration"
            )

    def get_products(self) -> list:
        """Get product list."""
        return self.get_setting("products", [])

    def update_products(self, products: list):
        """Update product list."""
        self.set_setting(
            "products", products, description="Product list for segregation"
        )

    def get_feature_flags(self) -> dict:
        """Get all feature flags with defaults."""
        default_flags = {
            "digital_credit_analyst": True,
            "covenant_compliance_officer": True,
            "knowledge_base": True,
            "document_intelligence": True,
            "agentic_credit_memos": True,
        }
        flags = self.get_setting("feature_flags", {})
        # Merge with defaults, preserving any existing flags
        return {**default_flags, **flags}

    def set_feature_flag(self, feature: str, enabled: bool) -> dict:
        """Set a specific feature flag."""
        flags = self.get_feature_flags()
        flags[feature] = enabled
        self.set_setting(
            "feature_flags", flags, description="Feature flag configuration"
        )
        return flags

    def is_feature_enabled(self, feature: str) -> bool:
        """Check if a feature is enabled."""
        flags = self.get_feature_flags()
        return flags.get(feature, True)  # Default to enabled

    def update_feature_flags(self, flags: dict) -> dict:
        """Update multiple feature flags."""
        current_flags = self.get_feature_flags()
        current_flags.update(flags)
        self.set_setting(
            "feature_flags", current_flags, description="Feature flag configuration"
        )
        return current_flags

    def get_whitelabel_config(self) -> dict:
        """Get whitelabel configuration for branding."""
        default_config = {
            "brand_name": "Vitesse",
            "creator": "Your Company",
            "logo_url": None,
            "primary_color": "#EF4444",
            "enabled": True,
        }
        config = self.get_setting("whitelabel_config", {})
        return {**default_config, **config}

    def update_whitelabel_config(self, config: dict) -> dict:
        """Update whitelabel configuration."""
        current_config = self.get_whitelabel_config()
        current_config.update(config)
        self.set_setting(
            "whitelabel_config",
            current_config,
            description="Whitelabel and branding configuration",
        )
        return current_config


settings_service = SettingsService()
