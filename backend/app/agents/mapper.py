"""
Semantic Mapper Agent: Maps data across API schemas.
Generates transformation logic using LLM-powered semantic analysis.
"""

from typing import Any, Dict, Optional, List, Tuple
from datetime import datetime
import structlog
from app.agents.base import SemanticMapperAgent, AgentContext
from app.schemas.integration import (
    MappingLogic,
    DataTransformation,
    APISpecification,
)

logger = structlog.get_logger(__name__)

from app.services.semantic.layer import SemanticLayer
from app.db.session import async_session_factory


class VitesseMapper(SemanticMapperAgent):
    """
    Concrete implementation of Semantic Mapper agent.
    Uses LLM to understand and map schemas between APIs.
    """

    def __init__(self, context: AgentContext, agent_id: Optional[str] = None):
        super().__init__(agent_id=agent_id)
        self.context = context

    async def _execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate mapping logic between source and destination APIs.

        Input:
            - source_api_spec: APISpecification (from Ingestor)
            - dest_api_spec: APISpecification (from Ingestor)
            - user_intent: Human description of sync (e.g., "Sync Shopify customers to CRM")
            - source_endpoint: Specific source endpoint path
            - dest_endpoint: Specific dest endpoint path

        Output:
            - mapping_logic: MappingLogic with transformations
            - transformation_count: Number of field mappings
            - complexity_score: Mapping complexity (1-10)
        """
        source_spec = input_data.get("source_api_spec")
        dest_spec = input_data.get("dest_api_spec")
        user_intent = input_data.get("user_intent", "")
        source_endpoint = input_data.get("source_endpoint")
        dest_endpoint = input_data.get("dest_endpoint")

        if not all([source_spec, dest_spec, source_endpoint, dest_endpoint]):
            raise ValueError(
                "source_api_spec, dest_api_spec, source_endpoint, dest_endpoint required"
            )

        logger.info(
            "Mapper starting",
            source_api=source_spec.get("api_name"),
            dest_api=dest_spec.get("api_name"),
            user_intent=user_intent,
        )

        try:
            # Convert dicts to APISpecification objects if needed
            if isinstance(source_spec, dict):
                source_spec = APISpecification(**source_spec)
            if isinstance(dest_spec, dict):
                dest_spec = APISpecification(**dest_spec)

            # Step 1: Find endpoints
            source_ep = self._find_endpoint(source_spec.endpoints, source_endpoint)
            dest_ep = self._find_endpoint(dest_spec.endpoints, dest_endpoint)

            if not source_ep or not dest_ep:
                raise ValueError(
                    f"Endpoints not found: {source_endpoint}, {dest_endpoint}"
                )

            # Step 2: Extract schemas
            source_schema = source_ep.response_schema or {}
            dest_schema = dest_ep.request_schema or {}

            # Step 3: Generate semantic mappings using LLM
            transformations = await self._generate_transformations(
                user_intent=user_intent,
                source_schema=source_schema,
                dest_schema=dest_schema,
                source_api_name=source_spec.api_name,
                dest_api_name=dest_spec.api_name,
            )

            # Step 4: Create mapping logic
            mapping_logic = MappingLogic(
                source_api=source_spec.api_name,
                dest_api=dest_spec.api_name,
                source_endpoint=source_endpoint,
                dest_endpoint=dest_endpoint,
                transformations=transformations,
                error_handling={
                    "retry_count": 3,
                    "backoff_strategy": "exponential",
                    "skip_unmapped_fields": False,
                },
            )

            complexity = self._calculate_complexity(transformations)

            return {
                "status": "success",
                "mapping_logic": mapping_logic.model_dump(),
                "transformation_count": len(transformations),
                "complexity_score": complexity,
                "generation_time_seconds": (
                    datetime.utcnow() - context.get("start_time", datetime.utcnow())
                ).total_seconds(),
            }

        except Exception as e:
            logger.error("Mapper failed", error=str(e))
            return {
                "status": "failed",
                "error": str(e),
            }

    def _find_endpoint(
        self,
        endpoints: List[Dict[str, Any]],
        endpoint_path: str,
    ) -> Optional[Any]:
        """Find endpoint by path."""
        for ep in endpoints:
            if isinstance(ep, dict):
                if ep.get("path") == endpoint_path:
                    return ep
            else:
                if ep.path == endpoint_path:
                    return ep
        return None

    async def _generate_transformations(
        self,
        user_intent: str,
        source_schema: Dict[str, Any],
        dest_schema: Dict[str, Any],
        source_api_name: str,
        dest_api_name: str,
    ) -> List[DataTransformation]:
        """
        Generate semantic transformations using SemanticLayer (LLM + Vector Search).
        """
        # Initialize Semantic Layer with a DB session
        async with async_session_factory() as db:
            semantic_layer = SemanticLayer(db)

            # Use the new semantic layer to map the schemas
            transformations = await semantic_layer.map_schema(
                source_schema=source_schema,
                dest_schema=dest_schema,
                user_intent=user_intent,
            )

            # Fallback to naive matching if semantic layer returns nothing or fails
            # (Optional: implementation detail, for now we trust semantic layer or it returns empty)
            if not transformations:
                logger.warning(
                    "Semantic layer returned no mappings, falling back to naive matching"
                )
                transformations = self._fallback_naive_mapping(
                    source_schema, dest_schema, user_intent
                )

        return transformations

    def _fallback_naive_mapping(
        self,
        source_schema: Dict[str, Any],
        dest_schema: Dict[str, Any],
        user_intent: str,
    ) -> List[DataTransformation]:
        """Original naive mapping logic as fallback."""
        transformations = []
        dest_fields = self._extract_fields_from_schema(dest_schema)
        source_fields = self._extract_fields_from_schema(source_schema)

        for dest_field in dest_fields:
            best_match = self._find_best_source_field(
                dest_field["name"],
                dest_field["type"],
                source_fields,
                user_intent,
            )

            if best_match:
                transform_type = self._determine_transform_type(
                    best_match["type"],
                    dest_field["type"],
                )
                transformation = DataTransformation(
                    source_field=best_match["name"],
                    dest_field=dest_field["name"],
                    transform_type=transform_type,
                    transform_config=self._build_transform_config(
                        best_match["type"],
                        dest_field["type"],
                    ),
                    required=dest_field.get("required", False),
                )
                transformations.append(transformation)
        return transformations

    def _extract_fields_from_schema(
        self, schema: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Extract fields from a JSON schema."""
        fields = []

        if schema.get("type") == "object":
            properties = schema.get("properties", {})
            required = schema.get("required", [])

            for field_name, field_schema in properties.items():
                field_type = field_schema.get("type", "string")
                fields.append(
                    {
                        "name": field_name,
                        "type": field_type,
                        "required": field_name in required,
                        "description": field_schema.get("description", ""),
                    }
                )

        return fields

    def _find_best_source_field(
        self,
        dest_field_name: str,
        dest_field_type: str,
        source_fields: List[Dict[str, Any]],
        user_intent: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Find best matching source field for destination field.
        Uses semantic similarity and type matching.
        """
        if not source_fields:
            return None

        # Direct name match (highest priority)
        for source_field in source_fields:
            if source_field["name"].lower() == dest_field_name.lower():
                return source_field

        # Partial name match
        for source_field in source_fields:
            if dest_field_name.lower() in source_field["name"].lower():
                return source_field

        # Type-based match
        for source_field in source_fields:
            if source_field["type"] == dest_field_type:
                return source_field

        # Return first field as fallback
        return source_fields[0] if source_fields else None

    def _determine_transform_type(self, source_type: str, dest_type: str) -> str:
        """Determine transformation type based on source and dest types."""
        if source_type == dest_type:
            return "direct"
        elif source_type in ["string", "object"] and dest_type in ["string", "object"]:
            return "mapping"
        elif source_type == "string" and dest_type in ["integer", "number"]:
            return "parse"
        elif source_type in ["integer", "number"] and dest_type == "string":
            return "stringify"
        elif source_type == "string" and dest_type == "boolean":
            return "parse_bool"
        elif dest_type == "array":
            return "collect"
        else:
            return "custom"

    def _build_transform_config(
        self, source_type: str, dest_type: str
    ) -> Dict[str, Any]:
        """Build transformation configuration."""
        config: Dict[str, Any] = {}

        if dest_type == "number" or dest_type == "integer":
            config["decimal_places"] = 2
            config["thousands_separator"] = False

        elif dest_type == "string" and source_type == "object":
            config["format"] = "json"

        elif dest_type == "datetime" or dest_type == "date":
            config["input_format"] = "auto"
            config["output_format"] = "iso8601"

        return config

    def _calculate_complexity(self, transformations: List[DataTransformation]) -> float:
        """Calculate mapping complexity score (1-10)."""
        base_score = min(len(transformations) / 10, 5)  # Up to 5 based on field count

        # Add points for complex transform types
        complex_transforms = sum(
            1
            for t in transformations
            if t.transform_type in ["custom", "collect", "parse_bool"]
        )
        complexity_score = base_score + (complex_transforms / len(transformations) * 5)

        return min(complexity_score, 10.0)
