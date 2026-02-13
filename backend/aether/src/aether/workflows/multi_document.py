"""
Aether Workflows - Multi-Document Patterns

Provides patterns for handling multiple input documents in workflows:
- State management for multiple files
- Backward compatibility patterns
- Document batching utilities
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# ============================================================================
# MULTI-DOCUMENT STATE PATTERN
# ============================================================================


class MultiDocumentState(BaseModel):
    """
    Standard pattern for multi-document workflow state.

    Provides backward compatibility with single-document workflows.

    Example:
        class MyWorkflowState(MultiDocumentState):
            analysis_results: dict = {}

        # Single document (backward compatible)
        state = MyWorkflowState(source_file_path="/path/to/doc.pdf")

        # Multiple documents
        state = MyWorkflowState(source_file_paths=[
            "/path/to/doc1.pdf",
            "/path/to/doc2.pdf",
        ])
    """

    # Backward compatible: single file
    source_file_path: Optional[str] = None

    # New pattern: multiple files
    source_file_paths: List[str] = []

    # Track which document is being processed
    current_document_index: int = 0

    def get_current_document(self) -> Optional[str]:
        """Get the currently processing document path."""
        if self.source_file_paths:
            if self.current_document_index < len(self.source_file_paths):
                return self.source_file_paths[self.current_document_index]
        return self.source_file_path

    def get_all_documents(self) -> List[str]:
        """Get all document paths."""
        if self.source_file_paths:
            return self.source_file_paths
        elif self.source_file_path:
            return [self.source_file_path]
        return []

    def has_more_documents(self) -> bool:
        """Check if there are more documents to process."""
        docs = self.get_all_documents()
        return self.current_document_index < len(docs) - 1

    def next_document(self) -> bool:
        """
        Move to next document.

        Returns:
            True if moved to next document, False if no more documents
        """
        if self.has_more_documents():
            self.current_document_index += 1
            return True
        return False


def create_multi_document_state(
    files: List[str], state_class: type = None, **kwargs
) -> Dict[str, Any]:
    """
    Create a multi-document state with backward compatibility.

    Args:
        files: List of file paths
        state_class: Optional state class to use
        **kwargs: Additional state fields

    Returns:
        State dict ready for workflow

    Example:
        state = create_multi_document_state(
            files=["/path/to/doc1.pdf", "/path/to/doc2.pdf"],
            workflow_id="analysis_123",
        )
    """
    base_state = {
        "source_file_path": files[0] if files else None,
        "source_file_paths": files if files else [],
        "current_document_index": 0,
        **kwargs,
    }

    if state_class:
        return state_class(**base_state).model_dump()

    return base_state


# ============================================================================
# DOCUMENT BATCHING
# ============================================================================


def batch_documents(
    documents: List[str],
    batch_size: int = 5,
) -> List[List[str]]:
    """
    Batch documents for parallel processing.

    Args:
        documents: List of document paths
        batch_size: Number of documents per batch

    Returns:
        List of batches

    Example:
        batches = batch_documents(all_docs, batch_size=10)
        for batch in batches:
            await process_batch(batch)
    """
    batches = []
    for i in range(0, len(documents), batch_size):
        batches.append(documents[i : i + batch_size])
    return batches


async def process_documents_sequentially(
    documents: List[str],
    processor: Any,
    state_factory: Optional[Any] = None,
) -> List[Any]:
    """
    Process documents one at a time.

    Args:
        documents: List of document paths
        processor: Async function to process each document
        state_factory: Optional function to create state for each doc

    Returns:
        List of results

    Example:
        results = await process_documents_sequentially(
            documents=["/doc1.pdf", "/doc2.pdf"],
            processor=analyze_document,
        )
    """
    results = []

    for i, doc in enumerate(documents):
        if state_factory:
            state = state_factory(doc, index=i)
        else:
            state = {"source_file_path": doc, "index": i}

        result = await processor(state)
        results.append(result)

    return results


async def process_documents_in_batches(
    documents: List[str],
    batch_processor: Any,
    batch_size: int = 5,
) -> List[Any]:
    """
    Process documents in batches.

    Args:
        documents: List of document paths
        batch_processor: Async function to process a batch
        batch_size: Documents per batch

    Returns:
        Flattened list of results

    Example:
        results = await process_documents_in_batches(
            documents=all_docs,
            batch_processor=analyze_batch,
            batch_size=10,
        )
    """
    batches = batch_documents(documents, batch_size)
    all_results = []

    for batch in batches:
        batch_results = await batch_processor(batch)
        all_results.extend(batch_results)

    return all_results
