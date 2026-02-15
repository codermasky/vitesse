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
        embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2",
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
                timeout=30,  # Increased timeout
            )

            # Initialize embedder with explicit model download and caching
            # Try multiple cache locations to handle Docker environments
            cache_dirs = [
                os.path.expanduser("~/.cache/huggingface"),
                "/root/.cache/huggingface",
                "/app/.cache/huggingface",
                ".cache",
            ]
            
            embedder = None
            last_error = None
            
            for cache_dir in cache_dirs:
                try:
                    os.makedirs(cache_dir, exist_ok=True)
                    embedder = SentenceTransformer(
                        self.embedding_model,
                        cache_folder=cache_dir,
                    )
                    logger.info(
                        "Loaded embedder with cache_dir",
                        cache_dir=cache_dir,
                        embedding_model=self.embedding_model,
                    )
                    break
                except Exception as e:
                    last_error = e
                    logger.debug(
                        "Failed to load embedder with cache_dir",
                        cache_dir=cache_dir,
                        error=str(e),
                    )
                    continue
            
            if embedder is None:
                # Last resort: try without explicit cache
                embedder = SentenceTransformer(self.embedding_model)
            
            self.embedder = embedder

            # Test embedder to ensure it works correctly
            test_texts = ["test", "hello world", "financial API integration"]
            test_embedding = self.embedder.encode(test_texts, show_progress_bar=False)
            
            # Check for valid embedding shape
            if not hasattr(test_embedding, 'shape'):
                raise RuntimeError(
                    f"Embedder model '{self.embedding_model}' did not return a numpy array"
                )
            
            if len(test_embedding.shape) != 2 or test_embedding.shape[1] != 384:
                raise RuntimeError(
                    f"Embedder model '{self.embedding_model}' produced unexpected dimension: "
                    f"expected shape (n, 384), got {test_embedding.shape}"
                )

            logger.info(
                "Embedder initialized and tested",
                embedding_model=self.embedding_model,
                vector_dimension=test_embedding.shape[1],
                test_samples=len(test_texts),
            )

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
        """Add documents to Qdrant with proper validation."""
        if self.client is None or self.embedder is None:
            await self.initialize()

        try:
            from qdrant_client.http import models

            # Ensure collection exists
            await self._ensure_collection_exists(collection)

            # Generate IDs if not provided
            ids_to_add = ids or [str(uuid.uuid4()) for _ in documents]

            # Extract content and generate embeddings with validation
            contents = []
            payloads = []
            valid_indices = []
            skipped_indices = []

            for i, doc in enumerate(documents):
                # Extract text content
                text_content = doc.get("content", "")
                if isinstance(text_content, dict):
                    text_content = json.dumps(text_content)

                # Skip documents with empty content (will cause vector dimension errors)
                text_content = str(text_content).strip()
                if not text_content or len(text_content) < 10:
                    skipped_indices.append(i)
                    continue

                contents.append(text_content)
                valid_indices.append(i)

                # Prepare payload (metadata)
                payload = {
                    k: str(v)
                    for k, v in doc.items()
                    if k != "content" and len(str(v)) < 5000
                }
                payloads.append(payload)

            # Skip if no valid documents
            if not contents:
                logger.debug(
                    "No valid documents to add",
                    collection=collection,
                    total_docs=len(documents),
                    skipped_docs=len(skipped_indices),
                )
                return []

            # Generate embeddings (synchronous call)
            embeddings = self.embedder.encode(contents, show_progress_bar=False)

            # Debug log embedding details
            logger.debug(
                "Embeddings generated",
                collection=collection,
                num_embeddings=len(embeddings),
                embedding_shape=embeddings.shape if hasattr(embeddings, 'shape') else 'unknown',
                sample_first_elem=embeddings[0].tolist()[:5] if len(embeddings) > 0 else 'empty',
            )

            # Validate embeddings before inserting - check for empty or invalid vectors
            valid_embeddings = []
            valid_contents = []
            valid_payloads = []
            valid_ids = []
            
            for i, emb in enumerate(embeddings):
                # Handle both numpy array and list cases
                emb_array = emb.tolist() if hasattr(emb, 'tolist') else emb
                
                # Check if embedding has valid dimensions
                # embeddings is 2D: (num_docs, embedding_dim)
                # Each row should be a 384-dimensional vector
                # When iterating, each emb can be 1D (384,) or 2D (1, 384)
                emb_dim = len(emb_array) if isinstance(emb_array, list) else emb.shape[0]
                
                # For 1D array (384,), check the first dimension
                # For 2D array (1, 384), check the second dimension
                if hasattr(emb, 'shape'):
                    if len(emb.shape) == 1:
                        # 1D array: shape should be (384,)
                        if emb.shape[0] != 384:
                            logger.warning(
                                "Skipping document with invalid embedding dimension",
                                collection=collection,
                                doc_index=i,
                                expected_dim=384,
                                actual_dim=emb.shape[0],
                                embedding_shape=str(emb.shape),
                                content_preview=contents[i][:100] if contents[i] else "empty",
                            )
                            continue
                    elif len(emb.shape) == 2:
                        # 2D array: shape should be (1, 384) or (n, 384)
                        if emb.shape[1] != 384:
                            logger.warning(
                                "Skipping document with invalid embedding dimension",
                                collection=collection,
                                doc_index=i,
                                expected_dim=384,
                                actual_dim=emb.shape[1],
                                embedding_shape=str(emb.shape),
                                content_preview=contents[i][:100] if contents[i] else "empty",
                            )
                            continue
                    else:
                        logger.warning(
                            "Skipping document with invalid embedding dimension",
                            collection=collection,
                            doc_index=i,
                            expected_dim=384,
                            actual_dim="unknown",
                            embedding_shape=str(emb.shape),
                            content_preview=contents[i][:100] if contents[i] else "empty",
                        )
                        continue
                elif isinstance(emb_array, list) and len(emb_array) > 0:
                    # Check if it's a list of lists
                    if isinstance(emb_array[0], list) and len(emb_array[0]) != 384:
                        logger.warning(
                            "Skipping document with invalid embedding dimension",
                            collection=collection,
                            doc_index=i,
                            expected_dim=384,
                            actual_dim=len(emb_array[0]),
                            content_preview=contents[i][:100],
                        )
                        continue
                
                # Convert to flat list for Qdrant
                if hasattr(emb, 'tolist'):
                    emb_list = emb.tolist()
                    # If 2D, take the first row
                    if len(emb_list) == 1:
                        emb_list = emb_list[0]
                else:
                    emb_list = emb_array
                
                valid_embeddings.append(emb_list)
                valid_contents.append(contents[i])
                valid_payloads.append(payloads[i])
                valid_ids.append(ids_to_add[valid_indices[i]])

            # Skip if no valid embeddings
            if not valid_embeddings:
                logger.warning(
                    "No valid embeddings generated",
                    collection=collection,
                    total_docs=len(documents),
                )
                return []

            # Prepare points for Qdrant
            points = [
                models.PointStruct(
                    id=int(
                        uuid.UUID(valid_ids[i]).int % (2**63)
                    ),  # Convert UUID to int64
                    vector=valid_embeddings[i],
                    payload=valid_payloads[i],
                )
                for i in range(len(valid_embeddings))
            ]

            # Upload points to Qdrant
            self.client.upsert(
                collection_name=collection,
                points=points,
            )

            logger.debug(
                "Documents added to Qdrant",
                collection=collection,
                count=len(points),
                skipped=len(skipped_indices) + (len(embeddings) - len(valid_embeddings)),
            )

            return valid_ids

        except Exception as e:
            # Log at warning level to make errors visible
            logger.warning(
                "Failed to add documents to Qdrant",
                collection=collection,
                error_type=type(e).__name__,
                error_message=str(e),
                total_docs=len(documents),
                skipped_docs=len(skipped_indices),
            )
            return []

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

    def __init__(self, backend: str = "qdrant", **kwargs):
        self.backend = backend
        self.kwargs = kwargs
        self.db: Optional[KnowledgeDB] = None

    async def initialize(self) -> None:
        """Initialize the configured backend."""
        try:
            if self.backend == "qdrant":
                self.db = QdrantKnowledge(**self.kwargs)
            elif self.backend == "pinecone":
                self.db = PineconeKnowledge(**self.kwargs)
            else:
                raise ValueError(f"Unknown knowledge DB backend: {self.backend}")

            await self.db.initialize()
            logger.info("Knowledge DB manager initialized", backend=self.backend)
        except Exception as e:
            logger.error(f"Failed to initialize {self.backend} backend: {e}")
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


async def get_knowledge_db(backend: str = "qdrant", **kwargs) -> KnowledgeDBManager:
    """Get global knowledge database instance."""
    global _knowledge_db
    if _knowledge_db is None:
        _knowledge_db = KnowledgeDBManager(backend=backend, **kwargs)
        await _knowledge_db.initialize()
    return _knowledge_db


async def initialize_knowledge_db(
    backend: str = "qdrant", **kwargs
) -> KnowledgeDBManager:
    """Initialize the global knowledge database."""
    global _knowledge_db
    _knowledge_db = KnowledgeDBManager(backend=backend, **kwargs)
    await _knowledge_db.initialize()
    return _knowledge_db
