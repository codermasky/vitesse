import asyncio
import structlog
from app.agents.vitesse_orchestrator import VitesseOrchestrator
from app.agents.base import AgentContext
from app.schemas.integration import DeploymentConfig

logger = structlog.get_logger(__name__)


async def test_autonomous_loop():
    print("🚀 Starting Autonomous Loop Verification...")

    context = AgentContext()
    orchestrator = VitesseOrchestrator(context)

    # We use a mocked spec but valid looking URLs
    # The Ingestor and Mapper are heavily mocked/seeding in this environment
    # but the Deployer uses real Docker SDK.

    print("\nStep 1-5: Running full pipeline (Discovery -> Deploy)...")
    petstore_url = "https://petstore.swagger.io/v2/swagger.json"
    result = await orchestrator.create_integration(
        source_api_url=petstore_url,
        source_api_name="PetstoreSource",
        dest_api_url=petstore_url,
        dest_api_name="PetstoreDest",
        user_intent="Sync pets from source to destination",
        deployment_config=DeploymentConfig(target="local"),
        created_by="test-automator",
    )

    if result["status"] == "success":
        integration = result["integration"]
        print(f"✅ Integration Created: {integration['id']}")
        print(f"✅ Status: {integration['status']}")

        if integration["status"] == "active" and integration.get("container_id"):
            print(
                f"🔥 DREAM REALIZED: Integration is ACTIVE and deployed to container: {integration['container_id']}"
            )
            print(
                f"🌐 Service URL: {result.get('integration', {}).get('service_url', 'N/A')}"
            )
        else:
            print(
                f"⚠️  Integration created but status is {integration['status']}. Check logs."
            )
            if integration.get("error_log"):
                print(f"Error Log: {integration['error_log']}")
    else:
        print(f"❌ Pipeline failed: {result.get('error')}")


if __name__ == "__main__":
    asyncio.run(test_autonomous_loop())
