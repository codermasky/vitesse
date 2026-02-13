from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class LLMProviderConfig(BaseModel):
    provider_id: str = Field(
        ..., description="Unique ID for the provider (e.g., 'openai-1')"
    )
    name: str = Field(..., description="Display name for the provider")
    provider_type: str = Field(
        ..., description="Type: openai, anthropic, bedrock, azure, custom"
    )
    api_endpoint: Optional[str] = Field(
        None, description="API Gateway or direct endpoint URL"
    )
    api_key: Optional[str] = Field(None, description="API Key (stored securely)")
    models: List[str] = Field(
        default_factory=list, description="List of available models for this provider"
    )
    default_model: Optional[str] = None
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="Default parameters like temperature, top_p"
    )


class LLMConfigUpdate(BaseModel):
    name: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_key: Optional[str] = None
    models: Optional[List[str]] = None
    default_model: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None


class AgentModelMapping(BaseModel):
    agent_id: str
    provider_id: str
    model_name: str
    parameters: Optional[Dict[str, Any]] = None

    # Unified prompt management
    prompt_template_id: Optional[str] = Field(
        None, description="ID of prompt template from prompt_templates table"
    )

    # DEPRECATED: Legacy fields (kept for backward compatibility)
    system_prompt: Optional[str] = None
    refinement_prompt: Optional[str] = None

    role: Optional[str] = "Core Orchestrator"


class LLMSettings(BaseModel):
    providers: List[LLMProviderConfig]
    mappings: List[AgentModelMapping]
    global_default_provider: str
    global_default_model: str
