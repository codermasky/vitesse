from sqlalchemy import Column, Integer, String, JSON, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, relationship

from app.db.session import Base


class LLMProvider(Base):
    """Database model for LLM Providers."""

    __tablename__ = "llm_providers"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    provider_id: Mapped[str] = Column(String, unique=True, index=True, nullable=False)
    name: Mapped[str] = Column(String, nullable=False)
    provider_type: Mapped[str] = Column(
        String, nullable=False
    )  # openai, bedrock, azure
    api_endpoint: Mapped[str] = Column(String, nullable=True)
    api_key: Mapped[str] = Column(String, nullable=True)
    models: Mapped[list] = Column(JSON, default=list)  # List of model strings
    default_model: Mapped[str] = Column(String, nullable=True)
    parameters: Mapped[dict] = Column(JSON, default=dict)

    mappings = relationship(
        "AgentLLMMapping", back_populates="provider", cascade="all, delete-orphan"
    )


class AgentLLMMapping(Base):
    """Database model for Agent-to-LLM mappings."""

    __tablename__ = "agent_llm_mappings"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    agent_id: Mapped[str] = Column(String, unique=True, index=True, nullable=False)
    provider_id: Mapped[str] = Column(
        String,
        ForeignKey("llm_providers.provider_id", ondelete="CASCADE"),
        nullable=False,
    )
    model_name: Mapped[str] = Column(String, nullable=False)
    parameters: Mapped[dict] = Column(JSON, default=dict)

    # Prompt management - NEW unified approach
    prompt_template_id: Mapped[str] = Column(
        String(36),
        ForeignKey("prompt_templates.id", ondelete="SET NULL"),
        nullable=True,
        comment="Reference to unified prompt_templates table",
    )

    # DEPRECATED: Legacy prompt fields (kept for backward compatibility)
    # TODO: Remove in future migration after all code migrated to prompt_templates
    system_prompt: Mapped[str] = Column(String, nullable=True)
    refinement_prompt: Mapped[str] = Column(String, nullable=True)

    role: Mapped[str] = Column(String, default="Core Orchestrator")

    provider = relationship("LLMProvider", back_populates="mappings")


class AgentPromptHistory(Base):
    """Database model for storing historical versions of agent prompts."""

    __tablename__ = "agent_prompt_history"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    agent_id: Mapped[str] = Column(
        String,
        ForeignKey("agent_llm_mappings.agent_id", ondelete="CASCADE"),
        index=True,
    )
    system_prompt: Mapped[str] = Column(String, nullable=True)
    refinement_prompt: Mapped[str] = Column(String, nullable=True)
    version: Mapped[int] = Column(Integer, default=1)
    created_at: Mapped[str] = Column(String, nullable=False)  # ISO format
    comment: Mapped[str] = Column(String, nullable=True)
