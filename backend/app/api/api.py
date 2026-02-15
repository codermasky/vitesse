from fastapi import APIRouter

from app.api.endpoints import (
    auth,
    users,
    chat,
    knowledge,
    documents,
    queue,
    agents,
    llm_configs,
    system,
    admin,
    sharepoint,
    integrations,
    harvest_sources,
    harvest_jobs,
    agent_collaboration,
    integration_builder,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(queue.router, prefix="/queue", tags=["queue"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(
    llm_configs.router, prefix="/llm-configs", tags=["llm-configs"]
)
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(sharepoint.router, prefix="/sharepoint", tags=["sharepoint"])
api_router.include_router(integrations.router)
api_router.include_router(harvest_sources.router, tags=["harvest-sources"])
api_router.include_router(harvest_jobs.router, tags=["harvest-jobs"])
api_router.include_router(
    agent_collaboration.router,
    prefix="/agent-collaboration",
    tags=["agent-collaboration"],
)
api_router.include_router(
    integration_builder.router,
    prefix="/integration-builder",
    tags=["integration-builder"],
)
