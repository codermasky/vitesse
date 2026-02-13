from fastapi import APIRouter, Depends, HTTPException, WebSocket
from typing import List, Any
from app.api import deps
from app.services.chat import chat_service

router = APIRouter()


@router.post("/")
async def chat(message: str, current_user: Any = Depends(deps.get_current_user)):
    """Generic chat endpoint."""
    return await chat_service.process_message(message, current_user.id)


@router.get("/sessions")
async def get_sessions(current_user: Any = Depends(deps.get_current_user)):
    """Get all chat sessions for the user."""
    return await chat_service.get_user_sessions(current_user.id)


@router.post("/sessions")
async def create_session(current_user: Any = Depends(deps.get_current_user)):
    """Create a new chat session."""
    session_id = await chat_service.create_new_session_for_user(current_user.id)
    return {"id": session_id}


@router.post("/sessions/{session_id}/save")
async def save_session(
    session_id: str, current_user: Any = Depends(deps.get_current_user)
):
    """Save a chat session."""
    success = await chat_service.save_session(session_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "success"}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str, current_user: Any = Depends(deps.get_current_user)
):
    """Delete a chat session."""
    success = await chat_service.delete_session_from_db(session_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "success"}


@router.get("/sessions/{session_id}/history/")
async def get_history(
    session_id: str, current_user: Any = Depends(deps.get_current_user)
):
    """Get message history for a session."""
    history = await chat_service.get_session_history_from_db(session_id)
    return {"messages": history}


@router.get("/stats/")
async def get_stats(current_user: Any = Depends(deps.get_current_user)):
    """Get chat statistics."""
    # Placeholder for actual stats
    return {
        "total_messages": 1500,
        "active_sessions": await chat_service.get_active_sessions_count(),
        "average_response_time": "1.2s",
    }


@router.websocket("/ws/{session_id}")
async def chat_ws(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time chat."""
    # We'll use the service to manage the full lifecycle
    await chat_service.create_session(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_json()
            await chat_service.handle_message(
                chat_service.active_sessions[session_id], data
            )
    except WebSocketDisconnect:
        await chat_service.remove_session(session_id)
    except Exception as e:
        await chat_service.remove_session(session_id)
