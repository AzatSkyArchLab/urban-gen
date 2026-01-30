"""
Layers API router
"""

import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional

from ..models import LayerInfo, LayerListResponse, UploadResponse, ErrorResponse
from .. import database as db

router = APIRouter(prefix="/layers", tags=["layers"])


@router.get("", response_model=LayerListResponse)
async def list_layers():
    """List all available layers"""
    layers = db.list_layers()
    return LayerListResponse(
        layers=[LayerInfo(**layer) for layer in layers],
        total=len(layers)
    )


@router.get("/{layer_id}", response_model=LayerInfo)
async def get_layer(layer_id: str):
    """Get layer metadata"""
    layer = db.get_layer(layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail=f"Layer {layer_id} not found")
    return LayerInfo(**layer)


@router.get("/{layer_id}/geojson")
async def get_layer_geojson(layer_id: str):
    """Get layer GeoJSON data"""
    geojson = db.get_layer_geojson(layer_id)
    if not geojson:
        raise HTTPException(status_code=404, detail=f"Layer {layer_id} not found")
    return JSONResponse(content=geojson)


@router.post("/upload", response_model=UploadResponse)
async def upload_layer(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None)
):
    """Upload GeoJSON file as new layer"""

    # Validate file type
    if not file.filename.endswith(('.geojson', '.json')):
        raise HTTPException(
            status_code=400,
            detail="File must be .geojson or .json"
        )

    try:
        # Read and parse GeoJSON
        content = await file.read()
        geojson = json.loads(content.decode('utf-8'))

        # Validate GeoJSON structure
        if geojson.get('type') != 'FeatureCollection':
            # Wrap single feature or geometry
            if geojson.get('type') == 'Feature':
                geojson = {'type': 'FeatureCollection', 'features': [geojson]}
            elif 'coordinates' in geojson:
                geojson = {
                    'type': 'FeatureCollection',
                    'features': [{
                        'type': 'Feature',
                        'geometry': geojson,
                        'properties': {}
                    }]
                }
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid GeoJSON: must be FeatureCollection, Feature, or Geometry"
                )

        # Generate layer ID and name
        layer_id = db.generate_layer_id()
        layer_name = name or file.filename.rsplit('.', 1)[0]

        # Save layer
        metadata = db.save_layer(layer_id, layer_name, geojson, description)

        return UploadResponse(
            success=True,
            layer_id=layer_id,
            name=layer_name,
            feature_count=metadata['feature_count'],
            message=f"Layer '{layer_name}' uploaded successfully"
        )

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid JSON: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}"
        )


@router.delete("/{layer_id}")
async def delete_layer(layer_id: str):
    """Delete a layer"""
    if not db.get_layer(layer_id):
        raise HTTPException(status_code=404, detail=f"Layer {layer_id} not found")

    db.delete_layer(layer_id)
    return {"success": True, "message": f"Layer {layer_id} deleted"}
