from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.models.queue_request import QueueStatus


class QueueRequestBase(BaseModel):
    type: str  # ddq, rfp, rfi
    priority: int = 0
    product_id: Optional[str] = None
    deployment_type: Optional[str] = None


class QueueRequestCreate(QueueRequestBase):
    document_id: Optional[str] = None
    deal_id: Optional[str] = None


class QueueRequestUpdate(BaseModel):
    status: Optional[QueueStatus] = None
    priority: Optional[int] = None
    deal_id: Optional[str] = None
    progress_stage: Optional[str] = None
    progress_percentage: Optional[int] = None
    active_node_id: Optional[str] = None


class QueueRequest(QueueRequestBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    requestor_id: int
    document_id: Optional[str]
    deal_id: Optional[str]
    status: QueueStatus
    progress_stage: Optional[str] = ""
    progress_percentage: Optional[int] = 0
    active_node_id: Optional[str] = None
    product_id: Optional[str] = None
    deployment_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ReviewDecision(BaseModel):
    line_item_id: str
    action: str  # approve, refine
    feedback: Optional[str] = None


class QueueResume(BaseModel):
    review_decisions: Optional[List[ReviewDecision]] = None
