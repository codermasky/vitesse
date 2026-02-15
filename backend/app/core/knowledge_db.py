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
import hashlib
import asyncio

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
    async def get_harvest_source_state(
        self, source_key: str
    ) -> Optional[Dict[str, Any]]:
        """Get the state of a harvested source (hash, last processed, etc.)."""
        pass

    @abstractmethod
    async def update_harvest_source_state(
        self,
        source_key: str,
        content_hash: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Update the state of a harvested source after processing."""
        pass

    @abstractmethod
    async def list_harvest_sources(
        self, source_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List all tracked harvest sources, optionally filtered by type."""
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
        prefer_grpc: bool = False,  # Default to HTTP to avoid gRPC serialization issues
    ):
        self.url = url or os.getenv("QDRANT_URL", "http://localhost:6333")
        self.api_key = api_key or os.getenv("QDRANT_API_KEY")
        self.embedding_model = embedding_model
        self.prefer_grpc = prefer_grpc
        self.client = None
        self.embedder = None
        self._existing_collections: Set[str] = set()
        self._last_collection_refresh = 0

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
                check_compatibility=False,  # Skip version check for compatibility
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
            if not hasattr(test_embedding, "shape"):
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

            # Ensure the harvest sources tracking collection exists
            await self._ensure_collection_exists(HARVEST_SOURCES_COLLECTION)
            logger.info("Harvest sources tracking collection ensured")

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
        self, collection: str, vector_size: int = 384, max_retries: int = 3
    ) -> None:
        """Create collection if it doesn't exist with retry logic."""
        import time

        last_error = None
        for attempt in range(max_retries):
            try:
                from qdrant_client.http import models

                # Check cache first
                if collection in self._existing_collections and (
                    time.time() - self._last_collection_refresh < 300
                ):
                    return

                # Use a longer timeout for collection operations
                collections = await asyncio.wait_for(
                    asyncio.to_thread(self.client.get_collections),
                    timeout=30.0,
                )
                self._existing_collections = {c.name for c in collections.collections}
                self._last_collection_refresh = time.time()

                if collection not in self._existing_collections:
                    logger.info(
                        "Creating collection",
                        collection=collection,
                        attempt=attempt + 1,
                    )
                    await asyncio.wait_for(
                        asyncio.to_thread(
                            self.client.create_collection,
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
                        ),
                        timeout=60.0,  # Longer timeout for collection creation
                    )
                    self._existing_collections.add(collection)
                    logger.info(
                        "Collection created",
                        collection=collection,
                        vector_size=vector_size,
                    )
                return  # Success, exit retry loop

            except asyncio.TimeoutError as e:
                last_error = e
                logger.warning(
                    "Collection operation timed out, retrying",
                    collection=collection,
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    error=str(e),
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(2**attempt)  # Exponential backoff
                continue
            except Exception as e:
                last_error = e
                # Check if it's a 404 (collection doesn't exist is ok on first try)
                # But if we're trying to create and it fails, we retry
                logger.warning(
                    "Collection operation failed, retrying",
                    collection=collection,
                    attempt=attempt + 1,
                    error=str(e)[:200],
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(2**attempt)  # Exponential backoff
                continue

        # All retries failed
        if last_error:
            logger.error(
                "Failed to ensure collection exists after retries",
                collection=collection,
                error=str(last_error),
            )
            raise last_error

    async def add_documents(
        self,
        collection: str,
        documents: List[Dict[str, Any]],
        ids: Optional[List[str]] = None,
    ) -> List[str]:
        """Add documents to Qdrant with proper validation."""
        skipped_indices = []
        if self.client is None or self.embedder is None:
            await self.initialize()

        # Initialize tracking variables
        skipped_indices: List[int] = []

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

            # Validate embedder is working before generating embeddings
            if self.embedder is None:
                logger.error("Embedder not initialized, attempting to reinitialize")
                await self.initialize()
                if self.embedder is None:
                    logger.error("Failed to initialize embedder")
                    return []

            # Test embedder with a simple text before batch encoding
            try:
                test_emb = self.embedder.encode(["test"], show_progress_bar=False)
                if not hasattr(test_emb, "shape") or test_emb.shape[1] != 384:
                    logger.error(
                        "Embedder test failed: invalid embedding dimension",
                        expected_dim=384,
                        actual_shape=str(test_emb.shape)
                        if hasattr(test_emb, "shape")
                        else "no shape",
                    )
                    return []
            except Exception as e:
                logger.error("Embedder test failed", error=str(e))
                return []

            # Generate embeddings (CPU intensive, run in thread)
            try:
                embeddings = await asyncio.to_thread(
                    self.embedder.encode, contents, show_progress_bar=False
                )
                logger.info(
                    "Embeddings encoding completed",
                    collection=collection,
                    input_count=len(contents),
                    output_shape=str(embeddings.shape)
                    if hasattr(embeddings, "shape")
                    else "unknown",
                )
            except Exception as e:
                logger.error(
                    "Failed to generate embeddings",
                    collection=collection,
                    error=str(e),
                    error_type=type(e).__name__,
                    num_docs=len(contents),
                )
                return []

            # Validate embeddings output is not empty or malformed
            if embeddings is None:
                logger.error(
                    "Embeddings generation returned None",
                    collection=collection,
                    num_docs=len(contents),
                )
                return []

            if not hasattr(embeddings, "shape"):
                logger.error(
                    "Embeddings do not have shape attribute",
                    collection=collection,
                    type=type(embeddings),
                )
                return []

            if len(embeddings.shape) != 2:
                logger.error(
                    "Embeddings have unexpected number of dimensions",
                    collection=collection,
                    expected_dims=2,
                    actual_dims=len(embeddings.shape),
                    actual_shape=embeddings.shape,
                )
                return []

            if embeddings.shape[0] == 0:
                logger.error(
                    "Embeddings have zero rows",
                    collection=collection,
                    actual_shape=embeddings.shape,
                )
                return []

            # Check dimension - safely handle both 1D and 2D cases
            actual_dim = (
                embeddings.shape[1]
                if len(embeddings.shape) > 1
                else embeddings.shape[0]
            )
            if actual_dim != 384:
                logger.error(
                    "Embeddings have wrong dimension",
                    collection=collection,
                    expected_dim=384,
                    actual_dim=actual_dim,
                    full_shape=str(embeddings.shape),
                )
                return []

            # Debug log embedding details
            logger.debug(
                "Embeddings generated",
                collection=collection,
                num_embeddings=len(embeddings),
                embedding_shape=embeddings.shape
                if hasattr(embeddings, "shape")
                else "unknown",
                sample_first_elem=embeddings[0].tolist()[:5]
                if len(embeddings) > 0
                else "empty",
            )

            # Validate embeddings before inserting - check for empty or invalid vectors
            valid_embeddings = []
            valid_contents = []
            valid_payloads = []
            valid_ids = []

            for i, emb in enumerate(embeddings):
                # Handle both numpy array and list cases
                emb_array = emb.tolist() if hasattr(emb, "tolist") else emb

                # Check if embedding is empty or has zero dimensions FIRST
                # This catches cases like [[]] or [] before dimension checks
                is_empty = False
                if isinstance(emb_array, list):
                    # Check if it's an empty list or a list containing empty lists
                    if len(emb_array) == 0:
                        is_empty = True
                    elif len(emb_array) == 1 and (
                        isinstance(emb_array[0], list) and len(emb_array[0]) == 0
                    ):
                        # Case: [[]] - 2D array with shape (1, 0)
                        is_empty = True

                if is_empty:
                    logger.warning(
                        "Skipping document with empty/zero-dimensional embedding",
                        collection=collection,
                        doc_index=i,
                        embedding_array=str(emb_array)[:100],
                        content_preview=contents[i][:100] if contents[i] else "empty",
                    )
                    continue

                # Check if embedding has valid dimensions using numpy shape
                if hasattr(emb, "shape"):
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
                                content_preview=contents[i][:100]
                                if contents[i]
                                else "empty",
                            )
                            continue
                    elif len(emb.shape) == 2:
                        # Check for zero dimensions first
                        if emb.shape[0] == 0 or emb.shape[1] == 0:
                            logger.warning(
                                "Skipping document with zero-dimensional embedding",
                                collection=collection,
                                doc_index=i,
                                embedding_shape=str(emb.shape),
                                content_preview=contents[i][:100]
                                if contents[i]
                                else "empty",
                            )
                            continue
                        if emb.shape[1] != 384:
                            logger.warning(
                                "Skipping document with invalid embedding dimension",
                                collection=collection,
                                doc_index=i,
                                expected_dim=384,
                                actual_dim=emb.shape[1],
                                embedding_shape=str(emb.shape),
                                content_preview=contents[i][:100]
                                if contents[i]
                                else "empty",
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
                            content_preview=contents[i][:100]
                            if contents[i]
                            else "empty",
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
                if hasattr(emb, "tolist"):
                    emb_list = emb.tolist()
                    # If 2D, take the first row
                    # Check for empty or zero-dimensional case
                    if len(emb_list) == 1:
                        # Check if the inner list is empty
                        if isinstance(emb_list[0], list) and len(emb_list[0]) == 0:
                            logger.warning(
                                "Skipping document with empty embedding after tolist",
                                collection=collection,
                                doc_index=i,
                                content_preview=contents[i][:100]
                                if contents[i]
                                else "empty",
                            )
                            continue
                        emb_list = emb_list[0]
                else:
                    emb_list = emb_array

                # Final validation: ensure the resulting list has 384 elements
                if not isinstance(emb_list, list) or len(emb_list) != 384:
                    logger.warning(
                        "Skipping document with invalid embedding after conversion",
                        collection=collection,
                        doc_index=i,
                        expected_dim=384,
                        actual_type=type(emb_list).__name__,
                        actual_len=len(emb_list)
                        if isinstance(emb_list, list)
                        else "N/A",
                        content_preview=contents[i][:100] if contents[i] else "empty",
                    )
                    continue

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
            logger.info(
                "Preparing points for Qdrant",
                collection=collection,
                num_valid_embeddings=len(valid_embeddings),
                sample_embedding_len=len(valid_embeddings[0])
                if valid_embeddings
                else 0,
                sample_embedding_first5=valid_embeddings[0][:5]
                if valid_embeddings and len(valid_embeddings[0]) > 0
                else "empty",
            )

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

            # Log the vector dimensions being sent to Qdrant
            for i, pt in enumerate(points):
                logger.info(
                    "Point vector info",
                    collection=collection,
                    point_id=pt.id,
                    vector_len=len(pt.vector),
                    vector_first3=pt.vector[:3] if len(pt.vector) > 0 else "empty",
                )

            # Upload points to Qdrant (CPU intensive, run in thread)
            await asyncio.to_thread(
                self.client.upsert,
                collection_name=collection,
                points=points,
            )

            logger.debug(
                "Documents added to Qdrant",
                collection=collection,
                count=len(points),
                skipped=len(skipped_indices)
                + (len(embeddings) - len(valid_embeddings)),
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
            from qdrant_client.http import models

            # Generate embedding for query
            embeddings = await asyncio.to_thread(
                self.embedder.encode, [query], show_progress_bar=False
            )
            query_embedding = embeddings[0].tolist()

            # Search in Qdrant using query_points (v1.7+ API)
            search_results = await asyncio.to_thread(
                self.client.query_points,
                collection_name=collection,
                query=query_embedding,
                limit=top_k,
                query_filter=filters,
            )

            # Format results
            formatted_results = []
            for result in search_results.points:
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
            from qdrant_client.http import models

            # Convert UUID to int64 for Qdrant
            int_id = int(uuid.UUID(doc_id).int % (2**63))

            # Use query_points with specific ID filter (v1.7+ API)
            search_results = self.client.query_points(
                collection_name=collection,
                query=[0.0] * 384,  # Dummy query vector
                limit=1,
                query_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="id",
                            match=models.MatchValue(value=str(int_id)),
                        )
                    ]
                ),
            )

            points = search_results.points
            if points:
                return {
                    "id": doc_id,
                    "content": "",
                    "metadata": points[0].payload or {},
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
            from qdrant_client.http import models

            # Convert UUID to int64 for Qdrant
            int_id = int(uuid.UUID(doc_id).int % (2**63))

            # Use delete_points (v1.7+ API)
            self.client.delete_points(
                collection_name=collection,
                points_selector=models.PointIdsList(points=[int_id]),
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

    async def get_harvest_source_state(
        self, source_key: str
    ) -> Optional[Dict[str, Any]]:
        """Get the state of a harvested source (hash, last processed, etc.)."""
        if self.client is None or self.embedder is None:
            logger.warning("Initializing knowledge DB from get_harvest_source_state")
            await self.initialize()

        # Quick check if collection exists - with short timeout
        try:
            from qdrant_client.http import models
            import asyncio

            # Try to ensure collection exists with longer timeout and retries
            try:
                await asyncio.wait_for(
                    self._ensure_collection_exists(HARVEST_SOURCES_COLLECTION),
                    timeout=30.0,
                )
            except asyncio.TimeoutError:
                logger.warning("Collection check timed out, continuing anyway")
            except Exception as e:
                logger.debug("Collection check skipped", error=str(e)[:100])

            # Search for the source by source_key
            search_results = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.query_points,
                    collection_name=HARVEST_SOURCES_COLLECTION,
                    query=[0.0] * 384,  # Dummy query vector
                    limit=1,
                    query_filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="source_key",
                                match=models.MatchValue(value=source_key),
                            )
                        ]
                    ),
                ),
                timeout=30.0,
            )

            points = search_results.points
            if points:
                return points[0].payload or {}
            return None

        except asyncio.TimeoutError:
            # Timeout - treat as if source doesn't exist
            logger.warning(
                "Get harvest source state timed out, treating as new source",
                source_key=source_key,
            )
            return None
        except Exception as e:
            error_str = str(e)
            # Check if it's a 404 (collection not found) or similar - treat as new source
            if (
                "404" in error_str
                or "Not Found" in error_str
                or "Collection" in error_str
            ):
                logger.debug(
                    "Harvest source collection not found or empty, treating as new source",
                    source_key=source_key,
                    error=error_str[:100],
                )
                return None
            # Other errors - log but don't fail
            logger.warning(
                "Get harvest source state failed, treating as new source",
                source_key=source_key,
                error=error_str[:200],
            )
            return None

    async def update_harvest_source_state(
        self,
        source_key: str,
        content_hash: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Update the state of a harvested source after processing."""
        if self.client is None or self.embedder is None:
            logger.warning("Initializing knowledge DB from update_harvest_source_state")
            await self.initialize()

        # Ensure collection exists before upserting
        try:
            await asyncio.wait_for(
                self._ensure_collection_exists(HARVEST_SOURCES_COLLECTION),
                timeout=30.0,
            )
        except Exception as e:
            logger.warning("Failed to ensure collection exists on update", error=str(e))

        try:
            from qdrant_client.http import models

            # Generate a deterministic ID based on source_key
            source_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, source_key))
            int_id = int(uuid.UUID(source_id).int % (2**63))

            # Prepare payload
            payload = {
                "source_key": source_key,
                "content_hash": content_hash,
                "last_processed": datetime.utcnow().isoformat(),
            }
            if metadata:
                payload.update(metadata)

            # Generate embedding for the source key (run in thread)
            embeddings = await asyncio.to_thread(
                self.embedder.encode, [source_key], show_progress_bar=False
            )
            embedding = embeddings[0].tolist()

            # Upsert the source state
            point = models.PointStruct(
                id=int_id,
                vector=embedding,
                payload=payload,
            )

            await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.upsert,
                    collection_name=HARVEST_SOURCES_COLLECTION,
                    points=[point],
                ),
                timeout=30.0,
            )

            logger.debug(
                "Harvest source state updated",
                source_key=source_key,
                content_hash=content_hash[:8],
            )
            return True

        except asyncio.TimeoutError:
            logger.warning(
                "Update harvest source state timed out",
                source_key=source_key,
            )
            return False
        except Exception as e:
            logger.warning(
                "Update harvest source state failed",
                source_key=source_key,
                error=str(e)[:200],
            )
            return False

    async def list_harvest_sources(
        self, source_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List all tracked harvest sources, optionally filtered by type."""
        if self.client is None or self.embedder is None:
            await self.initialize()

        try:
            from qdrant_client.http import models

            # Get all sources (using scroll)
            scroll_results = self.client.scroll(
                collection_name=HARVEST_SOURCES_COLLECTION,
                limit=1000,
            )

            sources = []
            for point in scroll_results[0]:
                payload = point.payload or {}
                if source_type and payload.get("source_type") != source_type:
                    continue
                sources.append(payload)

            return sources

        except Exception as e:
            logger.error(
                "List harvest sources failed",
                source_type=source_type,
                error=str(e),
            )
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

    async def get_harvest_source_state(
        self, source_key: str
    ) -> Optional[Dict[str, Any]]:
        return None

    async def update_harvest_source_state(
        self,
        source_key: str,
        content_hash: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        return False

    async def list_harvest_sources(
        self, source_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
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

    async def get_harvest_source_state(
        self, source_key: str
    ) -> Optional[Dict[str, Any]]:
        if self.db is None:
            await self.initialize()
        return await self.db.get_harvest_source_state(source_key)

    async def update_harvest_source_state(
        self,
        source_key: str,
        content_hash: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        if self.db is None:
            await self.initialize()
        return await self.db.update_harvest_source_state(
            source_key, content_hash, metadata
        )

    async def list_harvest_sources(
        self, source_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if self.db is None:
            await self.initialize()
        return await self.db.list_harvest_sources(source_type)


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

# Harvest source tracking - NEW: tracks processed sources to avoid reprocessing
HARVEST_SOURCES_COLLECTION = "harvest_sources_tracking"


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
