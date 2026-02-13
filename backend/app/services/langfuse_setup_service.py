"""
Service for automating LangFuse setup by directly provisioning configuration in the database.
This enables "Zero-Touch" configuration for the user.
"""

import uuid
import secrets
import string
import structlog
import asyncio
import bcrypt
from datetime import datetime
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.services.langfuse_config_service import LangFuseConfigService
from app.core.langfuse_client import init_langfuse

logger = structlog.get_logger(__name__)


class LangFuseSetupService:
    """
    Automates the setup of LangFuse by directly provisioning:
    1. Organization
    2. Project
    3. API Keys
    """

    @staticmethod
    async def ensure_configured():
        """
        Ensure LangFuse is configured and ready to use.
        If not configured, it will attempt to provision default resources.
        """
        try:
            # 1. Check if we already have config in Vitesse DB
            from app.db.session import async_session_factory

            async with async_session_factory() as db:
                config = await LangFuseConfigService.get_config(db)
                if (
                    config
                    and config.enabled
                    and config.public_key
                    and config.secret_key
                ):
                    # Verify if these keys actually work
                    logger.info(
                        "LangFuse config found in DB, verifying connectivity..."
                    )
                    try:
                        from langfuse import Langfuse

                        # Create a temporary client to test auth
                        test_client = Langfuse(
                            public_key=config.public_key,
                            secret_key=config.secret_key,
                            host=config.host,
                        )
                        # Attempt to authenticate
                        if test_client.auth_check():
                            logger.info(
                                "LangFuse setup check: valid configuration found. Skipping provisioning.",
                                public_key=config.public_key,
                            )
                            # Ensure global client is initialized
                            init_langfuse(
                                public_key=config.public_key,
                                secret_key=config.secret_key,
                                host=config.host,
                                enabled=True,
                            )
                            return
                            return
                        else:
                            logger.warning(
                                "LangFuse auth check failed with existing keys. Re-provisioning..."
                            )
                    except Exception as e:
                        if "validation error" in str(e).lower():
                            logger.warning(
                                "LangFuse auth check failed due to SDK version mismatch (validation error). Assuming keys are valid.",
                                error=str(e),
                            )
                            # Ensure global client is initialized even if check "fails" due to schema
                            init_langfuse(
                                public_key=config.public_key,
                                secret_key=config.secret_key,
                                host=config.host,
                                enabled=True,
                            )
                            return

                        logger.warning(
                            "LangFuse connectivity verification failed. Re-provisioning...",
                            error=str(e),
                        )

            # 2. If not configured OR verification failed, attempt to provision resources in LangFuse DB
            logger.info(
                "LangFuse not fully configured. Attempting auto-provisioning..."
            )

            # We need to connect to the LangFuse database
            # The LangFuse DB is in the same postgres instance but different DB name
            # We construct the connection string based on settings.DATABASE_URI but executing against 'langfuse' db

            # Extract connection details from DATABASE_URI
            # postgresql://user:pass@host:port/dbname
            base_uri = str(settings.DATABASE_URI).rsplit("/", 1)[0]
            langfuse_db_uri = f"{base_uri}/langfuse"

            # Use sync engine for setup tasks to keep it simple with sqlalchemy text execution
            engine = create_engine(langfuse_db_uri)

            with engine.connect() as conn:
                # A. Ensure Organization Exists
                org_id = "org-vitesse-default"
                org_exists = conn.execute(
                    text("SELECT id FROM organizations WHERE id = :id"), {"id": org_id}
                ).fetchone()

                if not org_exists:
                    logger.info("Creating default LangFuse organization")
                    conn.execute(
                        text("""
                            INSERT INTO organizations (id, name, created_at, updated_at)
                            VALUES (:id, :name, NOW(), NOW())
                        """),
                        {"id": org_id, "name": "Vitesse Default Org"},
                    )
                    conn.commit()

                # Create default admin user for the organization
                admin_email = "admin@vitesse.local"

                # Generate a secure random password if not provided via env var
                env_password = os.getenv("ADMIN_INITIAL_PASSWORD")
                if env_password:
                    admin_password = env_password
                    logger.info("Using ADMIN_INITIAL_PASSWORD from environment")
                else:
                    alphabet = string.ascii_letters + string.digits + string.punctuation
                    admin_password = "".join(
                        secrets.choice(alphabet) for i in range(20)
                    )
                    logger.warning(
                        f"Generated secure random admin password: {admin_password}"
                    )
                    logger.warning("Please save this password immediately!")

                user_exists = conn.execute(
                    text("SELECT id FROM users WHERE email = :email"),
                    {"email": admin_email},
                ).fetchone()

                if not user_exists:
                    logger.info(
                        "Creating default admin user for Langfuse", email=admin_email
                    )

                    # Hash password using bcrypt
                    hashed_password = bcrypt.hashpw(
                        admin_password.encode("utf-8"), bcrypt.gensalt(rounds=10)
                    ).decode("utf-8")

                    user_id = f"user-{uuid.uuid4().hex}"

                    # Create user
                    conn.execute(
                        text("""
                            INSERT INTO users (id, name, email, password, created_at, updated_at)
                            VALUES (:id, :name, :email, :password, NOW(), NOW())
                        """),
                        {
                            "id": user_id,
                            "name": "Vitesse Admin",
                            "email": admin_email,
                            "password": hashed_password,
                        },
                    )

                    # Add user to organization as OWNER
                    conn.execute(
                        text("""
                            INSERT INTO organization_memberships (id, org_id, user_id, role, created_at, updated_at)
                            VALUES (:id, :org_id, :user_id, :role, NOW(), NOW())
                        """),
                        {
                            "id": f"membership-{uuid.uuid4().hex}",
                            "org_id": org_id,
                            "user_id": user_id,
                            "role": "OWNER",
                        },
                    )

                    conn.commit()
                    logger.info(
                        "Default admin user created successfully",
                        email=admin_email,
                    )

                # B. Ensure Project Exists
                project_id = "project-vitesse-default"
                project_exists = conn.execute(
                    text("SELECT id FROM projects WHERE id = :id"), {"id": project_id}
                ).fetchone()

                if not project_exists:
                    logger.info("Creating default LangFuse project")
                    conn.execute(
                        text("""
                            INSERT INTO projects (id, org_id, name, created_at, updated_at)
                            VALUES (:id, :org_id, :name, NOW(), NOW())
                        """),
                        {"id": project_id, "org_id": org_id, "name": "Vitesse"},
                    )
                    conn.commit()

                # C. Create API Keys
                # We need a pair of keys
                new_public_key = f"pk-lf-{uuid.uuid4().hex}"
                new_secret_key = f"sk-lf-{uuid.uuid4().hex}"

                # Hash the secret key for storage using bcrypt directly
                # Langfuse expects standard bcrypt hash
                salt = bcrypt.gensalt(rounds=10)
                hashed_secret_key = bcrypt.hashpw(
                    new_secret_key.encode("utf-8"), salt
                ).decode("utf-8")

                # Insert keys
                logger.info("Provisioning new LangFuse API keys")
                conn.execute(
                    text("""
                        INSERT INTO api_keys (
                            id, 
                            project_id, 
                            public_key, 
                            hashed_secret_key, 
                            display_secret_key, 
                            created_at,
                            note
                        )
                        VALUES (:id, :project_id, :public_key, :hashed_secret_key, :display_secret_key, NOW(), :note)
                    """),
                    {
                        "id": f"key-{uuid.uuid4().hex}",
                        "project_id": project_id,
                        "public_key": new_public_key,
                        "hashed_secret_key": hashed_secret_key,
                        "display_secret_key": f"...{new_secret_key[-4:]}",
                        "note": "Auto-generated by Vitesse",
                    },
                )
                conn.commit()

                logger.info("Successfully provisioned LangFuse resources")

                # 3. Save to AgentStack DB
                async with async_session_factory() as db:
                    await LangFuseConfigService.create_or_update_config(
                        db=db,
                        public_key=new_public_key,
                        secret_key=new_secret_key,
                        host=settings.LANGFUSE_HOST,
                        enabled=True,
                        created_by="system-auto-provision",
                    )

                    # 4. Initialize Client
                    init_langfuse(
                        public_key=new_public_key,
                        secret_key=new_secret_key,
                        host=settings.LANGFUSE_HOST,
                        enabled=True,
                    )

        except Exception as e:
            logger.error(f"Failed to auto-configure LangFuse: {e}")
            # Non-blocking failure - we just log it
            pass


langfuse_setup_service = LangFuseSetupService()
