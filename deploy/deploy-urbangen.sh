#!/bin/bash
# ===========================================
# Urban Gen - Deploy Script
# ===========================================
# Деплой на: mdlaba.ru/urbangen
#
# Использование:
# 1. scp deploy/deploy-urbangen.sh root@155.212.144.26:/root/
# 2. ssh root@155.212.144.26
# 3. chmod +x /root/deploy-urbangen.sh && /root/deploy-urbangen.sh
# ===========================================

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "Urban Gen - Deployment"
echo "========================================"

# ===========================================
# Конфигурация
# ===========================================
APP_DIR="/var/www/urbangen"
DATA_DIR="/var/data/geojson"
REPO_URL="https://github.com/AzatSkyArchLab/urban-gen.git"

# ===========================================
# 1. Создание директорий
# ===========================================
echo -e "${YELLOW}[1/4] Creating directories...${NC}"
mkdir -p ${APP_DIR}
mkdir -p ${DATA_DIR}

# Права на директорию данных
chown -R www-data:www-data ${DATA_DIR}
chmod 755 ${DATA_DIR}

# ===========================================
# 2. Клонирование/обновление репозитория
# ===========================================
echo -e "${YELLOW}[2/4] Cloning/updating repository...${NC}"
if [ -d "${APP_DIR}/.git" ]; then
    cd ${APP_DIR}
    git fetch origin
    git reset --hard origin/main
    echo "Repository updated"
else
    rm -rf ${APP_DIR}/*
    git clone ${REPO_URL} ${APP_DIR}
    echo "Repository cloned"
fi

# ===========================================
# 3. Сборка проекта
# ===========================================
echo -e "${YELLOW}[3/4] Building project...${NC}"
cd ${APP_DIR}

# Установка Node.js если нет
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

npm install
npm run build

# Права
chown -R www-data:www-data ${APP_DIR}

# ===========================================
# 4. Вывод конфигурации Nginx
# ===========================================
echo -e "${YELLOW}[4/4] Nginx configuration...${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Add this to /etc/nginx/sites-available/mdlaba.ru:${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
cat << 'NGINX'
    # ==========================================
    # Urban Gen
    # ==========================================

    # Frontend
    location /urbangen {
        alias /var/www/urbangen/dist;
        try_files $uri $uri/ /urbangen/index.html;
    }

    # Vector Tiles (proxy to existing Martin on port 3001)
    location /urbangen/tiles/ {
        auth_basic "Urban Gen";
        auth_basic_user_file /etc/nginx/.htpasswd_urban;

        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # CORS
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;

        if ($request_method = OPTIONS) {
            return 204;
        }
    }
NGINX

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Add Nginx config above"
echo "2. nginx -t && systemctl reload nginx"
echo ""
echo "URLs:"
echo "  Frontend: https://mdlaba.ru/urbangen"
echo "  Tiles:    https://mdlaba.ru/urbangen/tiles/{layer}/{z}/{x}/{y}.pbf"
echo ""
echo "Data directory: ${DATA_DIR}"
echo "Upload GeoJSON: scp file.geojson root@155.212.144.26:${DATA_DIR}/"
echo ""
