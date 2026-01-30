#!/bin/bash
# ===========================================
# Urban Planning API + Martin Deploy Script
# ===========================================
# Запуск: scp этот файл на сервер и выполнить:
# chmod +x deploy.sh && sudo ./deploy.sh
# ===========================================

set -e  # Остановка при ошибке

echo "========================================"
echo "Urban Planning API + Martin Deployment"
echo "========================================"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Директории
API_DIR="/var/www/urban-api"
DATA_DIR="${API_DIR}/data/layers"
MARTIN_CONFIG="/etc/martin"

# ===========================================
# 1. Создание директорий
# ===========================================
echo -e "${YELLOW}[1/6] Creating directories...${NC}"
mkdir -p ${API_DIR}/app/routers
mkdir -p ${DATA_DIR}
mkdir -p ${MARTIN_CONFIG}

# ===========================================
# 2. Создание файлов API
# ===========================================
echo -e "${YELLOW}[2/6] Creating API files...${NC}"

# requirements.txt
cat > ${API_DIR}/requirements.txt << 'REQUIREMENTS'
fastapi==0.109.0
uvicorn==0.27.0
python-multipart==0.0.6
aiofiles==23.2.1
pydantic==2.5.3
REQUIREMENTS

# app/__init__.py
cat > ${API_DIR}/app/__init__.py << 'INIT'
# Urban Planning API
INIT

# app/config.py
cat > ${API_DIR}/app/config.py << 'CONFIG'
"""Application configuration"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LAYERS_DIR = DATA_DIR / "layers"

DATA_DIR.mkdir(exist_ok=True)
LAYERS_DIR.mkdir(exist_ok=True)

API_HOST = "127.0.0.1"
API_PORT = 8080
CONFIG

# app/models.py
cat > ${API_DIR}/app/models.py << 'MODELS'
"""Pydantic models"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LayerInfo(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    feature_count: int
    geometry_type: Optional[str] = None
    bounds: Optional[List[float]] = None
    created_at: str
    file_size: int

class LayerListResponse(BaseModel):
    layers: List[LayerInfo]
    total: int

class UploadResponse(BaseModel):
    success: bool
    layer_id: str
    name: str
    feature_count: int
    message: str

class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
MODELS

# app/database.py
cat > ${API_DIR}/app/database.py << 'DATABASE'
"""Database/file operations for layers"""
import json
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
from .config import LAYERS_DIR

def generate_layer_id() -> str:
    return str(uuid.uuid4())[:8]

def get_layer_path(layer_id: str) -> Path:
    return LAYERS_DIR / f"{layer_id}.geojson"

def get_metadata_path(layer_id: str) -> Path:
    return LAYERS_DIR / f"{layer_id}.meta.json"

def calculate_bounds(features: List[Dict]) -> Optional[List[float]]:
    if not features:
        return None
    min_lng, min_lat = float('inf'), float('inf')
    max_lng, max_lat = float('-inf'), float('-inf')

    def process_coords(coords):
        nonlocal min_lng, min_lat, max_lng, max_lat
        if isinstance(coords[0], (int, float)):
            min_lng = min(min_lng, coords[0])
            min_lat = min(min_lat, coords[1])
            max_lng = max(max_lng, coords[0])
            max_lat = max(max_lat, coords[1])
        else:
            for coord in coords:
                process_coords(coord)

    for feature in features:
        coords = feature.get('geometry', {}).get('coordinates')
        if coords:
            process_coords(coords)

    return [min_lng, min_lat, max_lng, max_lat] if min_lng != float('inf') else None

def save_layer(layer_id: str, name: str, geojson: Dict[str, Any], description: str = None) -> Dict[str, Any]:
    geojson_path = get_layer_path(layer_id)
    with open(geojson_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False)

    features = geojson.get('features', [])
    geometry_type = features[0].get('geometry', {}).get('type') if features else None

    metadata = {
        'id': layer_id,
        'name': name,
        'description': description,
        'feature_count': len(features),
        'geometry_type': geometry_type,
        'bounds': calculate_bounds(features),
        'created_at': datetime.now().isoformat(),
        'file_size': os.path.getsize(geojson_path)
    }

    with open(get_metadata_path(layer_id), 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    return metadata

def get_layer(layer_id: str) -> Optional[Dict[str, Any]]:
    meta_path = get_metadata_path(layer_id)
    if not meta_path.exists():
        return None
    with open(meta_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_layer_geojson(layer_id: str) -> Optional[Dict[str, Any]]:
    geojson_path = get_layer_path(layer_id)
    if not geojson_path.exists():
        return None
    with open(geojson_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def list_layers() -> List[Dict[str, Any]]:
    layers = []
    for meta_file in LAYERS_DIR.glob('*.meta.json'):
        with open(meta_file, 'r', encoding='utf-8') as f:
            layers.append(json.load(f))
    layers.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    return layers

def delete_layer(layer_id: str) -> bool:
    deleted = False
    for path in [get_layer_path(layer_id), get_metadata_path(layer_id)]:
        if path.exists():
            path.unlink()
            deleted = True
    return deleted
DATABASE

# app/routers/__init__.py
cat > ${API_DIR}/app/routers/__init__.py << 'ROUTERS_INIT'
# Routers
ROUTERS_INIT

# app/routers/layers.py
cat > ${API_DIR}/app/routers/layers.py << 'LAYERS_ROUTER'
"""Layers API router"""
import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
from ..models import LayerInfo, LayerListResponse, UploadResponse
from .. import database as db

router = APIRouter(prefix="/layers", tags=["layers"])

@router.get("", response_model=LayerListResponse)
async def list_layers():
    layers = db.list_layers()
    return LayerListResponse(layers=[LayerInfo(**l) for l in layers], total=len(layers))

@router.get("/{layer_id}", response_model=LayerInfo)
async def get_layer(layer_id: str):
    layer = db.get_layer(layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail=f"Layer {layer_id} not found")
    return LayerInfo(**layer)

@router.get("/{layer_id}/geojson")
async def get_layer_geojson(layer_id: str):
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
    if not file.filename.endswith(('.geojson', '.json')):
        raise HTTPException(status_code=400, detail="File must be .geojson or .json")

    try:
        content = await file.read()
        geojson = json.loads(content.decode('utf-8'))

        if geojson.get('type') != 'FeatureCollection':
            if geojson.get('type') == 'Feature':
                geojson = {'type': 'FeatureCollection', 'features': [geojson]}
            elif 'coordinates' in geojson:
                geojson = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'geometry': geojson, 'properties': {}}]}
            else:
                raise HTTPException(status_code=400, detail="Invalid GeoJSON")

        layer_id = db.generate_layer_id()
        layer_name = name or file.filename.rsplit('.', 1)[0]
        metadata = db.save_layer(layer_id, layer_name, geojson, description)

        return UploadResponse(
            success=True,
            layer_id=layer_id,
            name=layer_name,
            feature_count=metadata['feature_count'],
            message=f"Layer '{layer_name}' uploaded successfully"
        )
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.delete("/{layer_id}")
async def delete_layer(layer_id: str):
    if not db.get_layer(layer_id):
        raise HTTPException(status_code=404, detail=f"Layer {layer_id} not found")
    db.delete_layer(layer_id)
    return {"success": True, "message": f"Layer {layer_id} deleted"}
LAYERS_ROUTER

# app/main.py
cat > ${API_DIR}/app/main.py << 'MAIN'
"""Urban Planning API"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from .config import API_HOST, API_PORT
from .models import HealthResponse
from .routers import layers

app = FastAPI(
    title="Urban Planning API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(layers.router, prefix="/api")

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", version="1.0.0", timestamp=datetime.now().isoformat())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=API_HOST, port=API_PORT, reload=True)
MAIN

# ===========================================
# 3. Python venv и зависимости
# ===========================================
echo -e "${YELLOW}[3/6] Setting up Python environment...${NC}"
cd ${API_DIR}
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# ===========================================
# 4. Systemd service
# ===========================================
echo -e "${YELLOW}[4/6] Setting up systemd service...${NC}"

cat > /etc/systemd/system/urban-api.service << 'SERVICE'
[Unit]
Description=Urban Planning API
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/urban-api
ExecStart=/var/www/urban-api/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8080
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

# Права доступа
chown -R www-data:www-data ${API_DIR}

systemctl daemon-reload
systemctl enable urban-api
systemctl start urban-api

# ===========================================
# 5. Martin configuration
# ===========================================
echo -e "${YELLOW}[5/6] Configuring Martin...${NC}"

cat > ${MARTIN_CONFIG}/config.yaml << 'MARTIN_CONFIG'
# Martin Tile Server Configuration
listen_addresses: '127.0.0.1:3000'

# Serve GeoJSON files from layers directory
auto_publish:
  directories:
    - path: /var/www/urban-api/data/layers
      source_id_format: '{file_stem}'
      recursive: false

# CORS settings
cors:
  allow_origins: ['*']
  allow_methods: ['GET']
  allow_headers: ['*']
MARTIN_CONFIG

# Martin systemd service
cat > /etc/systemd/system/martin-urban.service << 'MARTIN_SERVICE'
[Unit]
Description=Martin Tile Server for Urban Planning
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
ExecStart=/usr/local/bin/martin --config /etc/martin/config.yaml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
MARTIN_SERVICE

# Проверяем, установлен ли Martin
if command -v martin &> /dev/null; then
    echo -e "${GREEN}Martin found, starting service...${NC}"
    systemctl daemon-reload
    systemctl enable martin-urban
    systemctl start martin-urban
else
    echo -e "${YELLOW}Martin not installed. Install with:${NC}"
    echo "  cargo install martin"
    echo "  OR download from https://github.com/maplibre/martin/releases"
fi

# ===========================================
# 6. Nginx configuration
# ===========================================
echo -e "${YELLOW}[6/6] Nginx configuration...${NC}"

NGINX_CONFIG="
    # Urban Planning API
    location /urban_planning/api/ {
        auth_basic \"Urban Planning\";
        auth_basic_user_file /etc/nginx/.htpasswd_urban;

        proxy_pass http://127.0.0.1:8080/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 50M;
    }

    # Martin Tiles (no auth for tiles - performance)
    location /urban_planning/tiles/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;

        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
"

echo -e "${GREEN}========================================"
echo "Deployment complete!"
echo "========================================${NC}"
echo ""
echo "Add the following to your Nginx config (/etc/nginx/sites-available/mdlaba.ru):"
echo ""
echo "$NGINX_CONFIG"
echo ""
echo "Then run:"
echo "  nginx -t && systemctl reload nginx"
echo ""
echo -e "${GREEN}Test commands:${NC}"
echo "  curl -u urban:urban2026 https://mdlaba.ru/urban_planning/api/health"
echo "  curl -u urban:urban2026 https://mdlaba.ru/urban_planning/api/layers"
echo ""
echo -e "${GREEN}Service status:${NC}"
echo "  systemctl status urban-api"
echo "  systemctl status martin-urban"
echo ""
echo -e "${GREEN}Logs:${NC}"
echo "  journalctl -u urban-api -f"
echo "  journalctl -u martin-urban -f"
