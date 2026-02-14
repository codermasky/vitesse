"""
Enhanced Discovery Agent Integration with Shared State and Knowledge Harvesting

This module demonstrates how the Discovery Agent works with:
1. Shared Whiteboard (SharedWhiteboardState) for collaborative context
2. Knowledge Harvester for accessing pre-loaded financial services knowledge
3. Vector DB for semantic search of APIs and standards

It gives the Discovery Agent the ability to:
- Find APIs from the harvested knowledge base
- Understand regulatory contexts (PSD2, FDX)
- Identify applicable integration patterns
- Improve discovery through learned patterns
"""

import structlog
from typing import Any, Dict, Optional, List
from datetime import datetime

from app.core.shared_state import SharedWhiteboardState
from app.core.knowledge_db import get_knowledge_db
from app.agents.knowledge_harvester import KnowledgeHarvester
from app.agents.base import AgentContext

logger = structlog.get_logger(__name__)


class EnhancedDiscoveryContext:
    """
    Enhanced discovery using shared state and knowledge harvesting.

    This context provides methods that can be integrated into the Discovery Agent
    to leverage the collaborative intelligence and harvested knowledge.
    """

    def __init__(
        self,
        shared_whiteboard: SharedWhiteboardState,
        knowledge_harvester: KnowledgeHarvester,
    ):
        self.shared_whiteboard = shared_whiteboard
        self.knowledge_harvester = knowledge_harvester
        self.knowledge_db = None

    async def discover_apis_with_knowledge(
        self,
        query: str,
        domain: str = "financial",
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Discover APIs combining:
        1. User query
        2. Domain context (financial services)
        3. Harvested knowledge from vector DB
        4. Previously successful integrations (from whiteboard)
        """
        logger.info(
            "Enhanced API discovery",
            query=query,
            domain=domain,
            limit=limit,
        )

        results = []

        try:
            # Initialize knowledge DB if needed
            if self.knowledge_db is None:
                self.knowledge_db = await get_knowledge_db()

            # 1. Search harvested knowledge for similar APIs
            similar_apis = await self.knowledge_harvester.find_similar_apis(
                query, top_k=limit
            )

            for api_result in similar_apis:
                results.append(
                    {
                        "api_name": api_result.get("api"),
                        "similarity_score": api_result.get("similarity_score"),
                        "source": "harvested_knowledge",
                        "doc_id": api_result.get("doc_id"),
                    }
                )

            # 2. Identify applicable standards for this domain
            applicable_standards = (
                await self.knowledge_harvester.find_applicable_standards(query)
            )

            # Store in shared whiteboard for next agents
            if applicable_standards:
                self.shared_whiteboard.domain_knowledge["applicable_standards"] = (
                    applicable_standards
                )

            # 3. Find relevant patterns that might help mapping
            relevant_patterns = await self.knowledge_harvester.find_relevant_patterns(
                query, top_k=3
            )

            if relevant_patterns:
                self.shared_whiteboard.domain_knowledge["relevant_patterns"] = (
                    relevant_patterns
                )

            logger.info(
                "Enhanced discovery complete",
                discovered_apis=len(similar_apis),
                applicable_standards=len(applicable_standards),
                relevant_patterns=len(relevant_patterns),
            )

            return results

        except Exception as e:
            logger.error("Enhanced discovery failed", error=str(e))
            return results

    async def check_regulatory_compliance(
        self,
        api_name: str,
        region: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Check if an API complies with applicable standards.

        Example:
        - Plaid + EU → check PSD2 compliance
        - Stripe + FX → check FDX compliance
        """
        logger.info(
            "Checking regulatory compliance",
            api_name=api_name,
            region=region,
        )

        compliance_info = {
            "api": api_name,
            "region": region,
            "standards": [],
            "requirements": [],
            "certifications": [],
        }

        try:
            # Query knowledge DB for standards applicable to this region
            if self.knowledge_db is None:
                self.knowledge_db = await get_knowledge_db()

            search_query = f"{api_name} compliance {region or 'global'}"
            standards_results = (
                await self.knowledge_harvester.find_applicable_standards(search_query)
            )

            compliance_info["standards"] = standards_results

            # Store compliance check in shared whiteboard
            if "compliance_checks" not in self.shared_whiteboard.domain_knowledge:
                self.shared_whiteboard.domain_knowledge["compliance_checks"] = {}

            self.shared_whiteboard.domain_knowledge["compliance_checks"][
                api_name
            ] = compliance_info

        except Exception as e:
            logger.error("Compliance check failed", error=str(e))

        return compliance_info

    async def get_integration_guidance(
        self,
        source_api: str,
        dest_api: str,
    ) -> Dict[str, Any]:
        """
        Get guidance for integrating two APIs.

        Searches for similar patterns and provides:
        - Common field mappings
        - Transformation rules
        - Known challenges
        - Success rates
        """
        logger.info(
            "Getting integration guidance",
            source_api=source_api,
            dest_api=dest_api,
        )

        guidance = {
            "source": source_api,
            "destination": dest_api,
            "patterns": [],
            "common_mappings": [],
            "warnings": [],
            "success_rate": 0.0,
        }

        try:
            # Find patterns for this integration type
            search_query = f"{source_api} to {dest_api}"
            patterns = await self.knowledge_harvester.find_relevant_patterns(
                search_query, top_k=5
            )

            guidance["patterns"] = patterns

            # Calculate average success rate from patterns
            if patterns:
                success_rates = [p.get("relevance", 0) for p in patterns]
                guidance["success_rate"] = sum(success_rates) / len(success_rates)

            # Store guidance in whiteboard for mapper and guardian to use
            self.shared_whiteboard.domain_knowledge["integration_guidance"] = guidance

        except Exception as e:
            logger.error("Get guidance failed", error=str(e))

        return guidance

    async def enriched_discovery_workflow(
        self,
        user_intent: str,
        source_api_query: str,
        dest_api_query: str,
        region: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Complete enriched discovery workflow combining all above capabilities.

        Returns:
        - Discovered APIs
        - Regulatory requirements
        - Integration patterns and guidance
        - Risk assessment
        """
        logger.info(
            "Starting enriched discovery workflow",
            source_query=source_api_query,
            dest_query=dest_api_query,
        )

        workflow_result = {
            "workflow_id": self.shared_whiteboard.workflow_id,
            "timestamp": datetime.utcnow().isoformat(),
            "source_apis": [],
            "dest_apis": [],
            "regulatory_context": [],
            "integration_patterns": [],
            "risk_assessment": {},
        }

        try:
            # 1. Discover source APIs
            source_apis = await self.discover_apis_with_knowledge(
                source_api_query,
                limit=3,
            )
            workflow_result["source_apis"] = source_apis

            # 2. Discover destination APIs
            dest_apis = await self.discover_apis_with_knowledge(
                dest_api_query,
                limit=3,
            )
            workflow_result["dest_apis"] = dest_apis

            # 3. Check compliance for each discovered API
            for api in source_apis + dest_apis:
                compliance = await self.check_regulatory_compliance(
                    api.get("api_name"),
                    region=region,
                )
                if compliance.get("standards"):
                    workflow_result["regulatory_context"].append(compliance)

            # 4. Get integration guidance
            if source_apis and dest_apis:
                guidance = await self.get_integration_guidance(
                    source_apis[0].get("api_name"),
                    dest_apis[0].get("api_name"),
                )
                workflow_result["integration_patterns"] = guidance.get("patterns", [])
                workflow_result["risk_assessment"]["success_rate"] = guidance.get(
                    "success_rate", 0
                )

            # 5. Update shared whiteboard
            self.shared_whiteboard.discovered_apis = {
                "sources": source_apis,
                "destinations": dest_apis,
                "discovery_timestamp": datetime.utcnow().isoformat(),
            }

            logger.info(
                "Enriched discovery workflow complete",
                source_count=len(source_apis),
                dest_count=len(dest_apis),
                standards_count=len(workflow_result["regulatory_context"]),
            )

        except Exception as e:
            logger.error("Enriched discovery workflow failed", error=str(e))
            workflow_result["status"] = "error"
            workflow_result["error"] = str(e)

        return workflow_result


# =========== Integration with Discovery Agent ===========


async def enhance_discovery_agent_with_knowledge(
    discovery_agent: Any,
    shared_whiteboard: SharedWhiteboardState,
    knowledge_harvester: KnowledgeHarvester,
) -> None:
    """
    Inject enhanced discovery capabilities into the Discovery Agent.

    Usage:
    ```
    enhanced = EnhancedDiscoveryContext(shared_whiteboard, harvester)
    results = await enhanced.discover_apis_with_knowledge(query)
    ```
    """

    # Attach the enhanced context to the discovery agent
    discovery_agent.enhanced_discovery = EnhancedDiscoveryContext(
        shared_whiteboard,
        knowledge_harvester,
    )

    logger.info(
        "Discovery agent enhanced with knowledge capabilities",
        agent_id=discovery_agent.agent_id,
    )
