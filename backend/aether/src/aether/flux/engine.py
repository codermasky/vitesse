import logging
from typing import Any, Dict, List, Optional, Type, TypeVar, Union
from langgraph.graph import StateGraph, END
from aether.core.state import BaseWorkflowState

T = TypeVar("T", bound=BaseWorkflowState)

logger = logging.getLogger(__name__)


class Flux:
    """
    The 'Flux' Orchestration Engine.
    A modern wrapper around LangGraph to simplify agentic workflow definitions.
    """

    def __init__(self, state_schema: Type[T]):
        self.state_schema = state_schema
        self.builder = StateGraph(state_schema)
        self.compiled_graph = None

    def add_node(self, name: str, action: Any):
        """Add a processing node to the workflow."""
        self.builder.add_node(name, action)
        return self

    def add_edge(self, start: str, end: Union[str, Any]):
        """Add a direct edge between two nodes."""
        self.builder.add_edge(start, end)
        return self

    def add_conditional_edges(
        self, source: str, path_selector: Any, path_map: Dict[str, str]
    ):
        """Add conditional routing logic."""
        self.builder.add_conditional_edges(source, path_selector, path_map)
        return self

    def set_entry_point(self, name: str):
        """Define the starting point of the workflow."""
        self.builder.set_entry_point(name)
        return self

    def compile(
        self,
        checkpointer: Optional[Any] = None,
        interrupt_before: Optional[List[str]] = None,
    ):
        """Compile the graph into an executable workflow."""
        self.compiled_graph = self.builder.compile(
            checkpointer=checkpointer, interrupt_before=interrupt_before
        )
        return self.compiled_graph

    async def execute(
        self, initial_state: T, config: Optional[Dict[str, Any]] = None
    ) -> T:
        """Execute the compiled workflow."""
        if not self.compiled_graph:
            raise RuntimeError("Flux: Graph must be compiled before execution.")

        logger.info(
            f"Flux: Executing workflow {initial_state.get('workflow_id', 'unknown')}"
        )
        return await self.compiled_graph.ainvoke(initial_state, config=config)
