from fastapi import APIRouter

from app.api.endpoints import (
    auth,
    users,
    chat,
    knowledge,
    queue,
    agents,
    llm_configs,
    system,
    admin,
    sharepoint,
    integrations,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(queue.router, prefix="/queue", tags=["queue"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(
    llm_configs.router, prefix="/llm-configs", tags=["llm-configs"]
)
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(sharepoint.router, prefix="/sharepoint", tags=["sharepoint"])
api_router.include_router(integrations.router)
