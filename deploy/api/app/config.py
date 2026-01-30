"""
Application configuration
"""

from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LAYERS_DIR = DATA_DIR / "layers"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
LAYERS_DIR.mkdir(exist_ok=True)

# API settings
API_HOST = "127.0.0.1"
API_PORT = 8080

# Martin tile server
MARTIN_URL = "http://127.0.0.1:3000"
