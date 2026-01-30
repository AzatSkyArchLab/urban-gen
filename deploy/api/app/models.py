"""
Pydantic models for API
"""

from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class LayerCreate(BaseModel):
    """Request model for creating a layer"""
    name: str
    description: Optional[str] = None


class LayerInfo(BaseModel):
    """Response model for layer information"""
    id: str
    name: str
    description: Optional[str] = None
    feature_count: int
    geometry_type: Optional[str] = None
    bounds: Optional[List[float]] = None
    created_at: str
    file_size: int


class LayerListResponse(BaseModel):
    """Response model for layer list"""
    layers: List[LayerInfo]
    total: int


class UploadResponse(BaseModel):
    """Response model for file upload"""
    success: bool
    layer_id: str
    name: str
    feature_count: int
    message: str


class ErrorResponse(BaseModel):
    """Response model for errors"""
    error: str
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    version: str
    timestamp: str
