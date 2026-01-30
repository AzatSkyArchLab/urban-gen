"""
Database/file system operations for layers
"""

import json
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from .config import LAYERS_DIR


def generate_layer_id() -> str:
    """Generate unique layer ID"""
    return str(uuid.uuid4())[:8]


def get_layer_path(layer_id: str) -> Path:
    """Get path to layer GeoJSON file"""
    return LAYERS_DIR / f"{layer_id}.geojson"


def get_metadata_path(layer_id: str) -> Path:
    """Get path to layer metadata file"""
    return LAYERS_DIR / f"{layer_id}.meta.json"


def save_layer(layer_id: str, name: str, geojson: Dict[str, Any], description: str = None) -> Dict[str, Any]:
    """Save layer GeoJSON and metadata"""

    # Save GeoJSON
    geojson_path = get_layer_path(layer_id)
    with open(geojson_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False)

    # Calculate metadata
    features = geojson.get('features', [])
    feature_count = len(features)

    # Get geometry type
    geometry_type = None
    if features:
        first_geom = features[0].get('geometry', {})
        geometry_type = first_geom.get('type')

    # Calculate bounds
    bounds = calculate_bounds(features)

    # Save metadata
    metadata = {
        'id': layer_id,
        'name': name,
        'description': description,
        'feature_count': feature_count,
        'geometry_type': geometry_type,
        'bounds': bounds,
        'created_at': datetime.now().isoformat(),
        'file_size': os.path.getsize(geojson_path)
    }

    meta_path = get_metadata_path(layer_id)
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    return metadata


def calculate_bounds(features: List[Dict]) -> Optional[List[float]]:
    """Calculate bounding box [minLng, minLat, maxLng, maxLat]"""
    if not features:
        return None

    min_lng = float('inf')
    min_lat = float('inf')
    max_lng = float('-inf')
    max_lat = float('-inf')

    def process_coords(coords):
        nonlocal min_lng, min_lat, max_lng, max_lat
        if isinstance(coords[0], (int, float)):
            lng, lat = coords[0], coords[1]
            min_lng = min(min_lng, lng)
            min_lat = min(min_lat, lat)
            max_lng = max(max_lng, lng)
            max_lat = max(max_lat, lat)
        else:
            for coord in coords:
                process_coords(coord)

    for feature in features:
        geom = feature.get('geometry', {})
        coords = geom.get('coordinates')
        if coords:
            process_coords(coords)

    if min_lng == float('inf'):
        return None

    return [min_lng, min_lat, max_lng, max_lat]


def get_layer(layer_id: str) -> Optional[Dict[str, Any]]:
    """Get layer metadata"""
    meta_path = get_metadata_path(layer_id)
    if not meta_path.exists():
        return None

    with open(meta_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_layer_geojson(layer_id: str) -> Optional[Dict[str, Any]]:
    """Get layer GeoJSON data"""
    geojson_path = get_layer_path(layer_id)
    if not geojson_path.exists():
        return None

    with open(geojson_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def list_layers() -> List[Dict[str, Any]]:
    """List all layers"""
    layers = []

    for meta_file in LAYERS_DIR.glob('*.meta.json'):
        with open(meta_file, 'r', encoding='utf-8') as f:
            layers.append(json.load(f))

    # Sort by created_at descending
    layers.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    return layers


def delete_layer(layer_id: str) -> bool:
    """Delete layer files"""
    geojson_path = get_layer_path(layer_id)
    meta_path = get_metadata_path(layer_id)

    deleted = False
    if geojson_path.exists():
        geojson_path.unlink()
        deleted = True
    if meta_path.exists():
        meta_path.unlink()
        deleted = True

    return deleted
