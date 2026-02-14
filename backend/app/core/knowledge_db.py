"""
Knowledge Database Layer: Vector Database Integration

Provides a unified interface for vector storage and semantic search.
Supports ChromaDB (local, open-source) and Pinecone (cloud, managed).

This layer enables:
- Semantic search of API documentation and schemas
- Storage of harvested knowledge for self-onboarding
- Financial services domain knowledge persistence
- Pattern matching and similarity-based integration discovery
"""

import structlog
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
from abc import ABC, abstractmethod
import uuid
import json
import os

logger = structlog.get_logger(__name__)


# =========== Base Interface ===========


class KnowledgeDB(ABC):
    """Abstract base class for knowledge database implementations."""

    @abstractmethod
    async def add_documents(
        self,
        collection: str,
        documents: List[Dict[str, Any]],
        ids: Optional[List[str]] = None,
    ) -> List[str]:
        """Add documents to a collection."""
        pass

    @abstractmethod
    async def search(
        self,
        collection: str,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        Search for similar documents.
        Returns: [(document, similarity_score), ...]
        """
        pass

    @abstractmethod
    async def get_document(
        self,
        collection: str,
        doc_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Get a specific document."""
        pass

    @abstractmethod
    async def delete_document(
        self,
        collection: str,
        doc_id: str,
    ) -> bool:
        """Delete a document."""
        pass

    @abstractmethod
    async def list_collections(self) -> List[str]:
        """List all collections."""
        pass

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the knowledge database."""
        pass


# =========== ChromaDB Implementation ===========


class ChromaDBKnowledge(KnowledgeDB):
    """
    ChromaDB-backed Knowledge Database.

    Best for:
    - Local development
    - Self-hosted deployments
    - Small to medium knowledge bases
    - Privacy-sensitive deployments
    """

    def __init__(
        self,
        persist_directory: str = "./chroma_data",
        embedding_model: str = "all-MiniLM-L6-v2",
    ):
        self.persist_directory = persist_directory
        self.embedding_model = embedding_model
        self.client = None
        self.collections: Dict[str, Any] = {}

    async def initialize(self) -> None:
        """Initialize ChromaDB client."""
        try:
            import chromadb

            # Create persist directory if needed
            os.makedirs(self.persist_directory, exist_ok=True)

            # Use modern PersistentClient to avoid migration warnings
            self.client = chromadb.PersistentClient(path=self.persist_directory)

            logger.info(
                "ChromaDB initialized (Modern API)",
                persist_directory=self.persist_directory,
                embedding_model=self.embedding_model,
            )
        except ImportError:
            logger.error("ChromaDB not installed. Install with: pip install chromadb")
            raise

    async def add_documents(
        self,
        collection: str,
        documents: List[Dict[str, Any]],
        ids: Optional[List[str]] = None,
    ) -> List[str]:
        """Add documents to a collection."""
        if self.client is None:
            await self.initialize()

        # Get or create collection
        col = self.client.get_or_create_collection(
            name=collection,
            metadata={"hnsw:space": "cosine"},
        )

        # Prepare documents
        docs_to_add = []
        metas_to_add = []
        ids_to_add = ids or [str(uuid.uuid4()) for _ in documents]

        for i, doc in enumerate(documents):
            # Extract text content
            text_content = doc.get("content", "")
            if isinstance(text_content, dict):
                text_content = json.dumps(text_content)

            docs_to_add.append(text_content)

            # Prepare metadata (exclude large content)
            meta = {
                k: str(v)
                for k, v in doc.items()
                if k != "content" and len(str(v)) < 5000
            }
            metas_to_add.append(meta)

        # Add to collection
        col.add(
            ids=ids_to_add,
            documents=docs_to_add,
            metadatas=metas_to_add,
        )

        logger.info(
            "Documents added to knowledge collection",
            collection=collection,
            count=len(ids_to_add),
        )

        return ids_to_add

    async def search(
        self,
        collection: str,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Search for similar documents."""
        if self.client is None:
            await self.initialize()

        try:
            col = self.client.get_collection(name=collection)

            # Perform search
            results = col.query(
                query_texts=[query],
                n_results=top_k,
                where=filters,
            )

            # Format results
            formatted_results = []
            if results["ids"] and len(results["ids"]) > 0:
                for i, doc_id in enumerate(results["ids"][0]):
                    # ChromaDB returns distances, convert to similarity (0-1)
                    distance = results["distances"][0][i]
                    similarity = 1 / (1 + distance)  # Convert distance to similarity

                    doc = {
                        "id": doc_id,
                        "content": (
                            results["documents"][0][i] if results["documents"] else ""
                        ),
                        "metadata": (
                            results["metadatas"][0][i] if results["metadatas"] else {}
                        ),
                    }
                    formatted_results.append((doc, similarity))

            return formatted_results

        except Exception as e:
            logger.error("Search failed", collection=collection, error=str(e))
            return []

    async def get_document(
        self,
        collection: str,
        doc_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Get a specific document."""
        if self.client is None:
            await self.initialize()

        try:
            col = self.client.get_collection(name=collection)
            results = col.get(ids=[doc_id])

            if results["ids"]:
                return {
                    "id": doc_id,
                    "content": results["documents"][0] if results["documents"] else "",
                    "metadata": results["metadatas"][0] if results["metadatas"] else {},
                }
            return None
        except Exception as e:
            logger.error(
                "Get document failed",
                collection=collection,
                doc_id=doc_id,
                error=str(e),
            )
            return None

    async def delete_document(
        self,
        collection: str,
        doc_id: str,
    ) -> bool:
        """Delete a document."""
        if self.client is None:
            await self.initialize()

        try:
            col = self.client.get_collection(name=collection)
            col.delete(ids=[doc_id])
            return True
        except Exception as e:
            logger.error(
                "Delete document failed",
                collection=collection,
                doc_id=doc_id,
                error=str(e),
            )
            return False

    async def list_collections(self) -> List[str]:
        """List all collections."""
        if self.client is None:
            await self.initialize()

        try:
            collections = self.client.list_collections()
            return [c.name for c in collections]
        except Exception as e:
            logger.error("List collections failed", error=str(e))
            return []


# =========== Qdrant Implementation ===========


class QdrantKnowledge(KnowledgeDB):
    """
    Qdrant-backed Knowledge Database.

    Enterprise-grade vector database with:
    - High-performance similarity search (40x with quantization)
    - Horizontal scaling
    - Built-in security and monitoring
    - Docker deployment ready

    Best for:
    - Production deployments
    - High-volume knowledge bases
    - Mission-critical financial integrations
    - Enterprise compliance requirements

    Deploy via Docker:
    docker run -p 6333:6333 qdrant/qdrant:latest

    Or use Qdrant Cloud (managed):
    https://qdrant.to/cloud
    """

    def __init__(
        self,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        embedding_model: str = "all-MiniLM-L6-v2",
        prefer_grpc: bool = True,
    ):
        self.url = url or os.getenv("QDRANT_URL", "http://localhost:6333")
        self.api_key = api_key or os.getenv("QDRANT_API_KEY")
        self.embedding_model = embedding_model
        self.prefer_grpc = prefer_grpc
        self.client = None
        self.embedder = None

    async def initialize(self) -> None:
        """Initialize Qdrant client."""
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.http import models
            from sentence_transformers import SentenceTransformer

            # Initialize client
            # Use gRPC only if specifically requested and reachable
            self.client = QdrantClient(
                url=self.url,
                api_key=self.api_key,
                prefer_grpc=self.prefer_grpc,
                timeout=10,
            )

            # Initialize embedder
            self.embedder = SentenceTransformer(self.embedding_model)

            # Test connection
            await self._test_connection()

            logger.info(
                "Qdrant initialized",
                url=self.url,
                embedding_model=self.embedding_model,
                prefer_grpc=self.prefer_grpc,
            )

        except ImportError:
            logger.error(
                "Qdrant SDK not installed. Install with: pip install qdrant-client"
            )
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant: {str(e)}")
            raise

    async def _test_connection(self) -> None:
        """Test connection to Qdrant."""
        try:
            # Try to get collections to verify connection
            self.client.get_collections()
            logger.info("Qdrant connection test successful")
        except Exception as e:
            logger.error(f"Qdrant connection test failed: {str(e)}")
            raise

    async def _ensure_collection_exists(
        self, collection: str, vector_size: int = 384
    ) -> None:
        """Create collection if it doesn't exist."""
        try:
            from qdrant_client.http import models

            collections = self.client.get_collections()
            collection_names = [c.name for c in collections.collections]

            if collection not in collection_names:
                self.client.create_collection(
                    collection_name=collection,
                    vectors_config=models.VectorParams(
                        size=vector_size,
                        distance=models.Distance.COSINE,
                    ),
                    # Enable quantization for 40x performance improvement
                    quantization_config=models.ScalarQuantization(
                        scalar=models.ScalarQuantizationConfig(
                            type=models.ScalarType.INT8,
                            quantile=0.99,
                            always_ram=False,
                        ),
                    ),
                )
                logger.info(
                    "Collection created",
                    collection=collection,
                    vector_size=vector_size,
                )
        except Exception as e:
            logger.error(f"Failed to ensure collection exists: {str(e)}")
            raise

    async def add_documents(
        self,
        collection: str,
        documents: List[Dict[str, Any]],
        ids: Optional[List[str]] = None,
    ) -> List[str]:
        """Add documents to Qdrant."""
        if self.client is None or self.embedder is None:
            await self.initialize()

        try:
            from qdrant_client.http import models

            # Ensure collection exists
            await self._ensure_collection_exists(collection)

            # Generate IDs if not provided
            ids_to_add = ids or [str(uuid.uuid4()) for _ in documents]

            # Extract content and generate embeddings
            contents = []
            payloads = []

            for i, doc in enumerate(documents):
                # Extract text content
                text_content = doc.get("content", "")
                if isinstance(text_content, dict):
                    text_content = json.dumps(text_content)

                contents.append(text_content)

                # Prepare payload (metadata)
                payload = {
                    k: str(v)
                    for k, v in doc.items()
                    if k != "content" and len(str(v)) < 5000
                }
                payloads.append(payload)

            # Generate embeddings (synchronous call)
            embeddings = self.embedder.encode(contents, show_progress_bar=False)

            # Prepare points for Qdrant
            points = [
                models.PointStruct(
                    id=int(
                        uuid.UUID(ids_to_add[i]).int % (2**63)
                    ),  # Convert UUID to int64
                    vector=embeddings[i].tolist(),
                    payload=payloads[i],
                )
                for i in range(len(documents))
            ]

            # Upload points to Qdrant
            self.client.upsert(
                collection_name=collection,
                points=points,
            )

            logger.info(
                "Documents added to Qdrant",
                collection=collection,
                count=len(ids_to_add),
            )

            return ids_to_add

        except Exception as e:
            logger.error(
                "Failed to add documents to Qdrant", collection=collection, error=str(e)
            )
            raise

    async def search(
        self,
        collection: str,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Search documents in Qdrant."""
        if self.client is None or self.embedder is None:
            await self.initialize()

        try:
            # Generate embedding for query
            query_embedding = self.embedder.encode([query], show_progress_bar=False)[
                0
            ].tolist()

            # Search in Qdrant
            search_results = self.client.search(
                collection_name=collection,
                query_vector=query_embedding,
                limit=top_k,
                query_filter=filters,
            )

            # Format results
            formatted_results = []
            for result in search_results:
                doc = {
                    "id": str(result.id),
                    "content": "",  # Content not stored as metadata
                    "metadata": result.payload or {},
                    "score": result.score,
                }
                formatted_results.append((doc, result.score))

            return formatted_results

        except Exception as e:
            logger.error("Search failed in Qdrant", collection=collection, error=str(e))
            # If Qdrant fails, we should return empty list or handle gracefully
            # Discovery agent will try fallback or LLM
            return []

    async def get_document(
        self,
        collection: str,
        doc_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Get a specific document from Qdrant."""
        if self.client is None:
            await self.initialize()

        try:
            # Convert UUID to int64 for Qdrant
            int_id = int(uuid.UUID(doc_id).int % (2**63))

            point = self.client.retrieve(
                collection_name=collection,
                ids=[int_id],
                with_payload=True,
            )

            if point:
                return {
                    "id": doc_id,
                    "content": "",
                    "metadata": point[0].payload or {},
                }
            return None

        except Exception as e:
            logger.error(
                "Get document failed in Qdrant",
                collection=collection,
                doc_id=doc_id,
                error=str(e),
            )
            return None

    async def delete_document(
        self,
        collection: str,
        doc_id: str,
    ) -> bool:
        """Delete a document from Qdrant."""
        if self.client is None:
            await self.initialize()

        try:
            # Convert UUID to int64 for Qdrant
            int_id = int(uuid.UUID(doc_id).int % (2**63))

            self.client.delete(
                collection_name=collection,
                points_selector=int_id,
            )

            logger.info(
                "Document deleted from Qdrant", collection=collection, doc_id=doc_id
            )
            return True

        except Exception as e:
            logger.error(
                "Delete document failed in Qdrant",
                collection=collection,
                doc_id=doc_id,
                error=str(e),
            )
            return False

    async def list_collections(self) -> List[str]:
        """List all Qdrant collections."""
        if self.client is None:
            await self.initialize()

        try:
            collections = self.client.get_collections()
            return [c.name for c in collections.collections]
        except Exception as e:
            logger.error("List collections failed in Qdrant", error=str(e))
            return []


# =========== Pinecone Implementation (stub for future) ===========


class PineconeKnowledge(KnowledgeDB):
    """
    Pinecone-backed Knowledge Database (stub for future implementation).
    """

    def __init__(self, **kwargs):
        logger.warning(
            "Pinecone backend not yet implemented. Use Qdrant or ChromaDB instead."
        )

    async def initialize(self) -> None:
        pass

    async def add_documents(self, *args, **kwargs) -> List[str]:
        return []

    async def search(self, *args, **kwargs) -> List[Tuple[Dict[str, Any], float]]:
        return []

    async def get_document(self, *args, **kwargs) -> Optional[Dict[str, Any]]:
        return None

    async def delete_document(self, *args, **kwargs) -> bool:
        return False

    async def list_collections(self, *args, **kwargs) -> List[str]:
        return []


# =========== Knowledge Database Manager ===========


class KnowledgeDBManager:
    """
    Manager for knowledge database operations.
    Abstracts away specific DB implementation details.
    """

    def __init__(self, backend: str = "chromadb", **kwargs):
        self.backend = backend
        self.kwargs = kwargs
        self.db: Optional[KnowledgeDB] = None

    async def initialize(self) -> None:
        """Initialize the configured backend with fallback logic."""
        try:
            if self.backend == "chromadb":
                self.db = ChromaDBKnowledge(**self.kwargs)
            elif self.backend == "qdrant":
                self.db = QdrantKnowledge(**self.kwargs)
            elif self.backend == "pinecone":
                self.db = PineconeKnowledge(**self.kwargs)
            else:
                raise ValueError(f"Unknown knowledge DB backend: {self.backend}")

            await self.db.initialize()
            logger.info("Knowledge DB manager initialized", backend=self.backend)
        except Exception as e:
            logger.warning(f"Failed to initialize primary backend {self.backend}: {e}")
            if self.backend != "chromadb":
                logger.info("Falling back to ChromaDB for knowledge storage")
                self.db = ChromaDBKnowledge()
                await self.db.initialize()
                self.backend = "chromadb"
            else:
                raise

    # Delegate methods to the backend
    async def add_documents(self, *args, **kwargs):
        if self.db is None:
            await self.initialize()
        return await self.db.add_documents(*args, **kwargs)

    async def search(self, *args, **kwargs):
        if self.db is None:
            await self.initialize()
        return await self.db.search(*args, **kwargs)

    async def get_document(self, *args, **kwargs):
        if self.db is None:
            await self.initialize()
        return await self.db.get_document(*args, **kwargs)

    async def delete_document(self, *args, **kwargs):
        if self.db is None:
            await self.initialize()
        return await self.db.delete_document(*args, **kwargs)

    async def list_collections(self, *args, **kwargs):
        if self.db is None:
            await self.initialize()
        return await self.db.list_collections(*args, **kwargs)


# =========== Collections Name Constants ===========

# Financial service collections
FINANCIAL_APIS_COLLECTION = "financial_apis"
FINANCIAL_SCHEMAS_COLLECTION = "financial_schemas"
FINANCIAL_STANDARDS_COLLECTION = "financial_standards"

# Core integration collections
API_SPECS_COLLECTION = "api_specifications"
MAPPING_PATTERNS_COLLECTION = "mapping_patterns"
TRANSFORMATION_RULES_COLLECTION = "transformation_rules"

# Knowledge libraries
DOMAIN_KNOWLEDGE_COLLECTION = "domain_knowledge"
INTEGRATION_PATTERNS_COLLECTION = "integration_patterns"


# =========== Global Knowledge DB Instance ===========

_knowledge_db: Optional[KnowledgeDBManager] = None


async def get_knowledge_db(backend: str = "chromadb", **kwargs) -> KnowledgeDBManager:
    """Get global knowledge database instance."""
    global _knowledge_db
    if _knowledge_db is None:
        _knowledge_db = KnowledgeDBManager(backend=backend, **kwargs)
        await _knowledge_db.initialize()
    return _knowledge_db


async def initialize_knowledge_db(
    backend: str = "chromadb", **kwargs
) -> KnowledgeDBManager:
    """Initialize the global knowledge database."""
    global _knowledge_db
    _knowledge_db = KnowledgeDBManager(backend=backend, **kwargs)
    await _knowledge_db.initialize()
    return _knowledge_db
