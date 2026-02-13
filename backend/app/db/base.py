# Import all the models, so that Base has them before being
# imported by Alembic
from app.db.session import Base  # noqa
from app.models.queue_request import QueueRequest  # noqa
from app.models.user import User  # noqa
from app.models.llm_config import LLMProvider, AgentLLMMapping  # noqa
from app.models.chat import ChatSession, ChatMessage  # noqa
from app.models.setting import SystemSetting  # noqa
from app.models.checkpoint import Checkpoint  # noqa
from app.models.prompt_template import PromptTemplate, PromptTemplateHistory  # noqa
from app.models.langfuse_config import LangFuseConfig  # noqa
from app.models.queue_request import QueueRequest  # noqa
from app.models.integration import (
    Integration,
    Transformation,
    TestResult,
    IntegrationAuditLog,
    DeploymentLog,
)  # noqa
from app.models.mapping_feedback import MappingFeedback  # noqa
