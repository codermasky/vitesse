import structlog
from typing import List, Dict, Any

logger = structlog.get_logger(__name__)


class EmailService:
    def record_heartbeat(self):
        pass

    def fetch_unread_emails(self) -> List[Dict[str, Any]]:
        return []


email_service = EmailService()
