import asyncio
import os
import sys

# Add app to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.settings_service import settings_service
from app.models.queue_request import QueueRequest  # Register models for SQLAlchemy


def update_color():
    config = settings_service.get_whitelabel_config()
    config["primary_color"] = "#EF4444"
    settings_service.update_whitelabel_config(config)
    print("Updated primary color to Red (#EF4444)")


if __name__ == "__main__":
    update_color()
