import logging
import json
from typing import List, Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pgvector.sqlalchemy import Vector
from pydantic import BaseModel, Field

from app.models.mapping_feedback import MappingFeedback
from app.schemas.integration import DataTransformation
from app.core.config import settings
from app.services.llm_provider import LLMProviderService

# We'll use langchain-openai for embeddings
from langchain_openai import OpenAIEmbeddings

logger = logging.getLogger(__name__)


class SemanticLayer:
    """
    Semantic understanding layer for field mapping using LLMs and Vector Search.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        # Initialize embedding model
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small", api_key=settings.OPENAI_API_KEY
        )

    async def _generate_embedding(self, text: str) -> List[float]:
        """Generate vector embedding for a text string."""
        return await self.embeddings.aembed_query(text)

    async def get_similar_mappings(
        self,
        source_field_name: str,
        source_field_desc: str,
        dest_field_name: str,
        dest_field_desc: str,
        limit: int = 5,
    ) -> List[MappingFeedback]:
        """
        Find similar past mappings using vector similarity search.
        We search for similar source fields AND similar destination fields.
        """
        # Create a combined context string for the search
        source_context = f"{source_field_name}: {source_field_desc or ''}"
        dest_context = f"{dest_field_name}: {dest_field_desc or ''}"

        # For now just use dest context for similarity as it's the target
        # A more complex strategy would combine both or search independently
        query_vector = await self._generate_embedding(dest_context)

        # Query for similar dest embeddings
        stmt = (
            select(MappingFeedback)
            .order_by(MappingFeedback.dest_embedding.cosine_distance(query_vector))
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def map_schema(
        self,
        source_schema: Dict[str, Any],
        dest_schema: Dict[str, Any],
        user_intent: str,
    ) -> List[DataTransformation]:
        """
        Main entry point for semantic mapping.
        """
        # 1. Flatten schemas for easier processing
        flat_source = self._flatten_schema(source_schema)
        flat_dest = self._flatten_schema(dest_schema)

        transformations = []

        for dest_field in flat_dest:
            # 2. Retrieve relevant past mappings (few-shot examples)
            examples = await self.get_similar_mappings(
                source_field_name="",
                source_field_desc="",
                dest_field_name=dest_field["name"],
                dest_field_desc=dest_field.get("description", ""),
                limit=3,
            )

            # 3. Construct prompt & Call LLM
            mapping = await self._propose_mapping(
                dest_field, flat_source, user_intent, examples
            )

            if mapping:
                transformations.append(mapping)

        return transformations

    def _flatten_schema(
        self, schema: Dict[str, Any], prefix: str = ""
    ) -> List[Dict[str, Any]]:
        """Helper to flatten nested JSON schemas into a list of fields."""
        fields = []
        properties = schema.get("properties", {})

        for key, value in properties.items():
            field_name = f"{prefix}.{key}" if prefix else key

            if value.get("type") == "object" and "properties" in value:
                fields.extend(self._flatten_schema(value, prefix=field_name))
            else:
                fields.append(
                    {
                        "name": field_name,
                        "type": value.get("type", "string"),
                        "description": value.get("description", ""),
                    }
                )
        return fields

    async def _propose_mapping(
        self,
        dest_field: Dict[str, Any],
        source_fields: List[Dict[str, Any]],
        user_intent: str,
        examples: List[MappingFeedback],
    ) -> Optional[DataTransformation]:
        """
        Use LLM to propose a single field mapping.
        """

        class SemanticMappingProposal(BaseModel):
            """Structured output from LLM for a single field mapping."""

            source_field: str = Field(
                ..., description="The name of the best matching source field"
            )
            transform_type: str = Field(
                ...,
                description="Type of transformation (direct, parse, stringify, etc.)",
            )
            confidence: int = Field(
                ..., description="Confidence score between 0 and 100"
            )
            reasoning: str = Field(
                ..., description="Explanation for why this mapping was chosen"
            )

        # Format examples for the prompt
        example_text = (
            "\n".join(
                [
                    f"- Mapped '{m.source_field_name}' to '{m.dest_field_name}' (Logic: {m.transformation_logic})"
                    for m in examples
                ]
            )
            if examples
            else "No specific past examples available."
        )

        # Flatten source fields for prompt to save tokens (name + type + desc)
        source_field_list = [
            f"{f['name']} ({f['type']}): {f.get('description', '')}"
            for f in source_fields
        ]

        prompt = f"""
        You are an expert data integration specialist.
        Map a field from the Source Schema to the Destination Field based on semantic meaning.
        
        User Intent: {user_intent}
        
        Destination Field:
        Name: {dest_field["name"]}
        Type: {dest_field["type"]}
        Description: {dest_field.get("description", "N/A")}
        
        Available Source Fields:
        {json.dumps(source_field_list, indent=2)}
        
        Past Relevant Mappings (Use as context):
        {example_text}
        
        Task:
        1. Select the best matching source field from the available list.
        2. Determine the transformation type (e.g., 'direct', 'parse', 'stringify', 'format_date').
        3. Assign a confidence score (0-100). If no good match exists, set confidence low (<50).
        4. Provide reasoning.
        """

        try:
            # Create LLM instance (Using Analyst Agent profile for reasoning)
            llm = await LLMProviderService.create_llm(agent_id="Analyst Agent")

            result = await LLMProviderService.invoke_structured_with_monitoring(
                llm_instance=llm,
                prompt=prompt,
                schema=SemanticMappingProposal,
                agent_id="Semantic Mapper",
                operation_name="propose_field_mapping",
                db=self.db,
            )

            if result.confidence < 50:
                return None

            return DataTransformation(
                source_field=result.source_field,
                dest_field=dest_field["name"],
                transform_type=result.transform_type,
                transform_config={"reasoning": result.reasoning},
                required=dest_field.get("required", False),
            )

        except Exception as e:
            logger.error(f"LLM mapping failed for field {dest_field['name']}: {e}")
            return None

    async def save_feedback(
        self,
        mapping: DataTransformation,
        source_schema: Dict,
        dest_schema: Dict,
        user_corrected: bool = False,
    ):
        """
        Save mapping result to feedback loop for future learning.
        Generates embeddings for the mapped fields.
        """

        source_context = f"{mapping.source_field}"
        dest_context = f"{mapping.dest_field}"

        s_vec = await self._generate_embedding(source_context)
        d_vec = await self._generate_embedding(dest_context)

        feedback = MappingFeedback(
            source_field_name=mapping.source_field,
            source_field_type="unknown",
            source_field_description="",
            dest_field_name=mapping.dest_field,
            dest_field_type="unknown",
            dest_field_description="",
            transformation_logic={
                "type": mapping.transform_type,
                "config": mapping.transform_config,
            },
            confidence_score=0.9,
            user_corrected=user_corrected,
            source_embedding=s_vec,
            dest_embedding=d_vec,
        )

        self.db.add(feedback)
        await self.db.commit()
