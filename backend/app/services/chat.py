from typing import Dict, List, Any, Optional
import json
import structlog
import uuid
import os
import hashlib
from langchain_core.messages import SystemMessage, HumanMessage

from fastapi import WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

from app.services.llm_provider import LLMProviderService
from app.services.knowledge_base import knowledge_base_manager
from app.core.cache import cache_service
from app.models.chat import ChatSession as DBChatSession, ChatMessage as DBChatMessage
from app.db.session import async_session_factory
from sqlalchemy import select, desc
from app.core.langfuse_client import (
    trace_llm_call,
    record_llm_call_result,
    record_error,
    is_langfuse_enabled,
)


logger = structlog.get_logger(__name__)


SYSTEM_PROMPT = """You are an expert AI assistant for Vitesse AI, a powerful API integration platform.
Your expertise includes:
1. Vitesse AI Platform: Deep knowledge of API discovery, field mapping, and integration deployment.
2. System Infrastructure: Expert knowledge of Vitesse's architecture and security standards.
3. Integration & Deployment: Specialized knowledge of deploying and managing integrations across various environments.

Answer questions as a helpful, knowledgeable expert.
"""

GUIDE_SYSTEM_PROMPT = """You are the Vitesse Navigator, an expert AI assistant dedicated to helping users navigate and master the Vitesse AI platform.
Your goal is to provide clear, actionable instructions on how to discover APIs, map data flows, deploy integrations, and perform integration tasks.

Key Areas of Expertise:
1. API Discovery: Ingesting API specifications and endpoints.
2. Field Mapping: Semantic mapping between source and destination APIs.
3. Integration Testing: Validating integration mappings and endpoints.
4. Deployment: Deploying integrations to various targets (local, EKS, ECS).
5. Monitoring: Tracking integration health and performance metrics.

Style Guidelines:
- Be friendly, helpful, and concise.
- Use step-by-step instructions when explaining "how-to".
- Reference specific UI elements like "Integrations", "Settings", or "Dashboard".
- **IMPORTANT**: Always prioritize information provided in the "Relevant Context from Knowledge Base" section. This context contains the official Vitesse AI documentation.
- If you don't know the answer based on the provided context, suggest checking the official documentation or contacting support.
"""

SIDEKICK_SYSTEM_PROMPT = """You are the Vitesse Assistant, a proactive collaborator that works alongside the user.
Your goal is to provide contextual insights, suggestions, and actions based on the user's specific activity and current page context.

Instead of a chat conversation, you provide a structured feed of intelligence.

CONTEXT-AWARE GUIDELINES:
1. Look at the provided "PAGE_CONTEXT" in the user message (Path, Title, Headers).
2. Tailor your insights to the specific page the user is on.
   - If they are on Dashboard: Focus on integration health, deployment status, and recent activity.
   - If they are on Integrations: Focus on integration status, mapping completeness, and test results.
   - If they are on Chat: Focus on conversation quality and knowledge base retrieval.
3. Be proactive: don't just state facts; suggest improvements or explain why something is happening.

You MUST respond with a valid JSON object containing a list of insights. 
Each insight must have:
- id: A unique string
- type: One of "insight", "suggestion", or "action"
- title: A concise title  
- description: A brief explanation
- icon: One of "sparkles", "lightbulb", "zap", "target"

Example format:
{
  "insights": [
    {
      "id": "1",
      "type": "insight",
      "title": "Contextual Insight",
      "description": "I see you're viewing the Dashboard. Your success rate is high, but 2 agents are idle.",
      "icon": "sparkles"
    }
  ]
}

Only return the JSON. Do not include any other text.
"""


class ChatSession:
    """Represents a chat session with a user."""

    def __init__(
        self,
        session_id: str,
        websocket: WebSocket,
        user_id: int = None,
        session_type: str = "general",
    ):
        self.session_id = session_id
        self.websocket = websocket
        self.user_id = user_id
        self.session_type = session_type
        self.conversation_history: List[Dict[str, Any]] = []
        self.context_documents: List[Dict[str, Any]] = []

    async def send_message(self, message_type: str, data: Dict[str, Any]):
        """Send a message to the client."""
        try:
            await self.websocket.send_json(
                {"type": message_type, "data": data, "session_id": self.session_id}
            )
        except Exception as e:
            logger.error(
                "Failed to send message", error=str(e), session_id=self.session_id
            )

    def add_to_history(self, role: str, content: str, metadata: Dict[str, Any] = None):
        """Add a message to conversation history."""
        self.conversation_history.append(
            {
                "role": role,
                "content": content,
                "timestamp": None,  # Would add timestamp
                "metadata": metadata or {},
            }
        )


class ChatService:
    """Service for managing chat sessions and interactions."""

    def __init__(self):
        self.active_sessions: Dict[str, ChatSession] = {}
        self.knowledge_base = knowledge_base_manager

    async def create_session(
        self,
        websocket: WebSocket,
        session_id: str,
        user_id: int = None,
        session_type: str = "general",
    ) -> ChatSession:
        """Create a new chat session."""
        session = ChatSession(session_id, websocket, user_id, session_type)

        self.active_sessions[session_id] = session

        # Load existing history from DB if it exists
        history = await self.get_session_history_from_db(session_id)
        for msg in history:
            session.add_to_history(msg["role"], msg["content"], msg.get("metadata"))

        # Send history to client so frontend can populate
        if history:
            await session.send_message("history", {"messages": history})

        logger.info(
            "Chat session initialized",
            session_id=session_id,
            history_count=len(session.conversation_history),
        )

        return session

    async def create_new_session_for_user(self, user_id: int) -> str:
        """Create a new session ID for a user (lazy creation)."""
        # Just return a new UUID, don't create in DB yet
        return str(uuid.uuid4())

    async def handle_message(
        self, session: ChatSession, message: Dict[str, Any]
    ) -> None:
        """Handle incoming chat message."""
        try:
            message_type = message.get("type", "unknown")
            data = message.get("data", {})

            if message_type == "user_message":
                await self._handle_user_message(session, data)
            elif message_type == "context_update":
                await self._handle_context_update(session, data)
            elif message_type == "clear_history":
                await self._handle_clear_history(session)
            else:
                await session.send_message(
                    "error", {"message": f"Unknown message type: {message_type}"}
                )

        except Exception as e:
            logger.error(
                "Error handling chat message",
                error=str(e),
                session_id=session.session_id,
            )
            await session.send_message("error", {"message": "Internal server error"})

    async def _handle_user_message(
        self, session: ChatSession, data: Dict[str, Any]
    ) -> None:
        """Handle user message and generate AI response."""
        user_message = data.get("message", "")
        verbosity = data.get("verbosity", "concise")
        if not user_message.strip():
            await session.send_message("error", {"message": "Empty message"})
            return

        # Add user message to history
        session.add_to_history("user", user_message)

        # Check cache for Sidekick insights
        cache_key = None
        cache_ttl = data.get("cache_ttl", 3600)  # Default 1 hour

        if session.session_type == "sidekick" and cache_ttl > 0:
            # Create a stable cache key
            context_str = f"{user_message}-{verbosity}"
            # Add context details to key if available in the message data
            if "context" in data:
                ctx = data["context"]
                context_str += f"-{ctx.get('path', '')}-{ctx.get('title', '')}-{str(ctx.get('visible_headers', []))}"

            cache_key = (
                f"sidekick:insights:{hashlib.md5(context_str.encode()).hexdigest()}"
            )

            cached_response = await cache_service.get(cache_key)
            if cached_response:
                logger.info("Cache hit for sidekick", session_id=session.session_id)
                await session.send_message("ai_response", cached_response)
                return

            logger.info("Cache miss for sidekick", session_id=session.session_id)

        # 1. Ensure Session Exists in DB (Lazy Persistence) & Generate Title
        try:
            async with async_session_factory() as db:
                existing = await db.execute(
                    select(DBChatSession).where(DBChatSession.id == session.session_id)
                )
                db_session = existing.scalar_one_or_none()

                if not db_session:
                    # Generate simple title from first few words of message
                    title = "New Chat"
                    if len(user_message) > 0:
                        title = (
                            user_message[:30] + "..."
                            if len(user_message) > 30
                            else user_message
                        )

                    new_session = DBChatSession(
                        id=session.session_id,
                        user_id=session.user_id,  # Use authenticated user_id
                        title=title,
                        is_saved=False,  # Explicitly default to False (Temporary)
                    )
                    db.add(new_session)
                    await db.commit()
                    logger.info(
                        "Lazily persisted chat session (temporary)",
                        session_id=session.session_id,
                    )
        except Exception as e:
            logger.error("Failed to lazily persist session", error=str(e))

        # Persist user message
        await self.persist_message(session.session_id, "user", user_message)

        try:
            # Query knowledge base for relevant information
            kb_limit = 10 if session.session_type == "guide" else 3
            kb_results = await self.knowledge_base.search_similar_documents(
                query=user_message, limit=kb_limit
            )

            sources = kb_results

            # Format context from KB results
            # Format context from KB results and prepare sources for frontend
            context_text = ""
            formatted_sources = []
            if kb_results:
                context_text = "\n\nRelevant Context from Knowledge Base:\n"
                for i, doc in enumerate(kb_results, 1):
                    content = doc.get("content", "")
                    # Source for Frontend
                    metadata = doc.get("metadata", {})
                    source_name = (
                        metadata.get("original_filename")
                        or metadata.get("source")
                        or "Unnamed Source"
                    )
                    if "/" in source_name or "\\" in source_name:
                        source_name = os.path.basename(source_name)

                    doc_id = metadata.get("document_id")

                    url = "/documents"  # Fallback
                    if doc_id:
                        # Use the new download endpoint
                        url = f"/api/v1/documents/{doc_id}/download"

                    formatted_sources.append(
                        {
                            "title": source_name,
                            "url": url,
                            "content_preview": content[:150] + "...",
                        }
                    )

            sources = formatted_sources
            logger.info(
                "Retrieved sources from KB",
                count=len(sources),
                session_id=session.session_id,
            )

            # Generate AI response using Orchestrator agent
            llm = await LLMProviderService.create_llm(agent_id="Orchestrator")

            # Combine System Prompt with Context and Formatting Instructions
            premium_formatting = "\n\nCRITICAL: Use professional markdown formatting. Use **bold** for emphasis, bullet points for lists, and clear spacing between paragraphs for a premium, readable feel."

            base_prompt = SYSTEM_PROMPT
            if session.session_type == "guide":
                base_prompt = GUIDE_SYSTEM_PROMPT
            elif session.session_type == "sidekick":
                base_prompt = SIDEKICK_SYSTEM_PROMPT

            full_system_prompt = base_prompt + context_text + premium_formatting

            # Create message history with system prompt
            from langchain_core.messages import AIMessage

            langchain_history = []
            # Skip history for sidekick to keep it stateless and fast
            if session.session_type != "sidekick":
                for msg in session.conversation_history[:-1]:
                    if msg["role"] == "user":
                        langchain_history.append(HumanMessage(content=msg["content"]))
                    else:
                        langchain_history.append(AIMessage(content=msg["content"]))

            # Add verbosity as a final, strong instruction
            verbosity_instruction = ""
            if verbosity == "concise":
                verbosity_instruction = "\n\nINSTRUCTION: Provide a very CONCISE and brief answer. Get straight to the point."
            else:
                verbosity_instruction = "\n\nINSTRUCTION: Provide a DETAILED, comprehensive, and thorough answer. Explore all aspects."

            messages = [
                SystemMessage(content=full_system_prompt),
                *langchain_history,
                HumanMessage(content=user_message + verbosity_instruction),
            ]

            # Invoke LLM with message list
            logger.info(
                "Invoking LLM for chat response",
                session_id=session.session_id,
                message_count=len(messages),
            )

            trace_ctx = None
            if is_langfuse_enabled():
                trace_ctx = trace_llm_call(
                    name="Orchestrator Chat",
                    model=getattr(llm, "model_name", "gpt-4o"),
                    metadata={
                        "session_id": session.session_id,
                        "session_type": session.session_type,
                        "user_id": session.user_id,
                    },
                )

            try:
                if trace_ctx:
                    async with trace_ctx as span:
                        response = await llm.ainvoke(messages)
                        if span:
                            record_llm_call_result(span, output=response.content)
                else:
                    response = await llm.ainvoke(messages)
            except Exception as e:
                # If tracing failed or call failed
                if trace_ctx:
                    logger.error("Error during traced LLM call", error=str(e))
                raise e

            ai_response = response.content
            logger.info(
                "LLM response received",
                session_id=session.session_id,
                response_length=len(ai_response),
            )

            confidence_score = 0.8  # Placeholder until we have a real confidence agent
            # sources are already set from kb_results

            # Add AI response to history
            session.add_to_history(
                "assistant",
                ai_response,
                {"confidence_score": confidence_score, "sources_count": len(sources)},
            )

            # Send response to client
            response_payload = {
                "message": ai_response,
                "confidence_score": confidence_score,
                "sources": sources,
                "timestamp": None,  # Would add timestamp
            }

            await session.send_message("ai_response", response_payload)

            # Cache the response if it's a sidekick session
            if cache_key and session.session_type == "sidekick" and cache_ttl > 0:
                await cache_service.set(cache_key, response_payload, ttl=cache_ttl)

            logger.info(
                "AI response generated",
                session_id=session.session_id,
                user_message_length=len(user_message),
                response_length=len(ai_response),
                confidence_score=confidence_score,
            )

            # Persist AI response
            await self.persist_message(
                session.session_id,
                "assistant",
                ai_response,
                {"confidence_score": confidence_score, "sources_count": len(sources)},
            )

        except Exception as e:
            logger.error(
                "AI response generation failed",
                error=str(e),
                session_id=session.session_id,
            )
            await session.send_message(
                "error", {"message": "Failed to generate response"}
            )

    async def _handle_context_update(
        self, session: ChatSession, data: Dict[str, Any]
    ) -> None:
        """Handle context document updates."""
        document_ids = data.get("document_ids", [])

        # Update session context
        session.context_documents = document_ids

        await session.send_message(
            "context_updated",
            {
                "document_count": len(document_ids),
                "message": f"Context updated with {len(document_ids)} documents",
            },
        )

        logger.info(
            "Chat context updated",
            session_id=session.session_id,
            document_count=len(document_ids),
        )

    async def _handle_clear_history(self, session: ChatSession) -> None:
        """Clear conversation history."""
        session.conversation_history = []

        await session.send_message(
            "history_cleared", {"message": "Conversation history cleared"}
        )

        logger.info("Chat history cleared", session_id=session.session_id)

    async def remove_session(self, session_id: str) -> None:
        """Remove a chat session."""
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]
            logger.info("Chat session removed", session_id=session_id)

    async def get_session_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get conversation history for a session."""
        session = self.active_sessions.get(session_id)
        if session:
            return session.conversation_history
        return []

    async def get_active_sessions_count(self) -> int:
        """Get count of active chat sessions."""
        return len(self.active_sessions)

    async def persist_message(
        self, session_id: str, role: str, content: str, metadata: Dict[str, Any] = None
    ):
        """Persist a message to the database."""
        try:
            async with async_session_factory() as db:
                message = DBChatMessage(
                    session_id=session_id,
                    role=role,
                    content=content,
                    metadata_=metadata or {},
                )
                db.add(message)
                await db.commit()
        except Exception as e:
            logger.error(
                "Failed to persist message", error=str(e), session_id=session_id
            )

    async def get_user_sessions(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all chat sessions for a user."""
        try:
            async with async_session_factory() as db:
                result = await db.execute(
                    select(DBChatSession)
                    .where(DBChatSession.user_id == user_id)
                    .where(DBChatSession.is_saved == True)  # Only return saved sessions
                    .order_by(desc(DBChatSession.updated_at))
                )
                sessions = result.scalars().all()
                return [
                    {
                        "id": s.id,
                        "title": s.title,
                        "created_at": s.created_at.isoformat(),
                        "updated_at": s.updated_at.isoformat(),
                    }
                    for s in sessions
                ]
        except Exception as e:
            logger.error("Failed to get user sessions", error=str(e), user_id=user_id)
            return []
            return []

    async def delete_session_from_db(self, session_id: str, user_id: int) -> bool:
        """Delete a chat session from the database."""
        try:
            async with async_session_factory() as db:
                result = await db.execute(
                    select(DBChatSession).where(
                        DBChatSession.id == session_id, DBChatSession.user_id == user_id
                    )
                )
                session = result.scalar_one_or_none()

                if session:
                    await db.delete(session)
                    await db.commit()

                    # Also remove from active sessions if present
                    if session_id in self.active_sessions:
                        del self.active_sessions[session_id]

                    return True
                return False
        except Exception as e:
            logger.error(
                "Failed to delete session", error=str(e), session_id=session_id
            )
            return False

    async def get_session_history_from_db(
        self, session_id: str
    ) -> List[Dict[str, Any]]:
        """Get message history from database."""
        try:
            async with async_session_factory() as db:
                result = await db.execute(
                    select(DBChatMessage)
                    .where(DBChatMessage.session_id == session_id)
                    .order_by(DBChatMessage.created_at)
                )
                messages = result.scalars().all()
                return [
                    {
                        "role": m.role,
                        "content": m.content,
                        "metadata": m.metadata_,
                        "timestamp": m.created_at.isoformat(),
                    }
                    for m in messages
                ]
        except Exception as e:
            logger.error(
                "Failed to get session history", error=str(e), session_id=session_id
            )
            return []

    async def save_session(self, session_id: str, user_id: int) -> bool:
        """Mark a chat session as saved."""
        try:
            async with async_session_factory() as db:
                result = await db.execute(
                    select(DBChatSession).where(
                        DBChatSession.id == session_id, DBChatSession.user_id == user_id
                    )
                )
                session = result.scalar_one_or_none()

                if session:
                    session.is_saved = True
                    await db.commit()
                    logger.info("Chat session saved", session_id=session_id)
                    return True
                return False
        except Exception as e:
            logger.error("Failed to save session", error=str(e), session_id=session_id)
            return False


# Global chat service instance
chat_service = ChatService()
