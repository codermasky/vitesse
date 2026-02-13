from app.services.base import CRUDBase
from app.models.queue_request import QueueRequest
from app.schemas.queue_request import QueueRequestCreate, QueueRequestUpdate


class QueueService(CRUDBase[QueueRequest, QueueRequestCreate, QueueRequestUpdate]):
    pass


queue_service = QueueService(QueueRequest)
