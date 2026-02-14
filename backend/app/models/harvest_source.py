"""
Harvest Source Model

Defines the database model for configurable harvest sources.
These sources determine where the knowledge harvester looks for APIs.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.db.base import Base


class HarvestSource(Base):
    """
    Configurable harvest source for API discovery.

    Stores information about where to harvest APIs from, including:
    - API directories (APIs.guru, etc.)
    - Marketplaces (RapidAPI, Postman, etc.)
    - GitHub repositories
    - Documentation sites
    """

    __tablename__ = "harvest_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)  # api_directory, marketplace, github, documentation
    url = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    priority = Column(Integer, default=0)  # Higher priority sources are harvested first

    # Authentication details (optional, for authenticated sources)
    auth_type = Column(String(50), nullable=True)  # none, api_key, oauth2, basic
    auth_config = Column(JSON, nullable=True)  # Store auth details as JSON

    # Metadata
    category = Column(String(100), nullable=True)  # payments, crm, communication, etc.
    tags = Column(JSON, nullable=True)  # List of tags for filtering
    last_harvested_at = Column(DateTime, nullable=True)
    harvest_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<HarvestSource(id={self.id}, name='{self.name}', type='{self.type}', enabled={self.enabled})>"