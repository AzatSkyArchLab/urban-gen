# Server Infrastructure Documentation

## Tile Server (Martin)

**URL:** `https://mdlaba.ru/tiles`
**Port:** 3002 (internal)
**Technology:** [Martin](https://github.com/maplibre/martin) - PostgreSQL → MVT tiles

### Tile URL Format
```
https://mdlaba.ru/tiles/{source_layer}/{z}/{x}/{y}
```

**Note:** No `.pbf` extension needed (Martin serves without it)

### Available Layers

| Source Layer | Description | Category Field |
|-------------|-------------|----------------|
| `osi_sush` | Road network axes | `class_active_2016` |
| `red_lines` | Red lines (boundaries) | - |

### Check Available Layers
```bash
curl https://mdlaba.ru/tiles/catalog
```

### Check Layer Data
```bash
curl "https://mdlaba.ru/tiles/osi_sush/12/2485/1356"
```

## Nginx Configuration

Location: `/etc/nginx/sites-available/mdlaba`

```nginx
# Tile server proxy
location /tiles/ {
    proxy_pass http://127.0.0.1:3002/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Frontend
location /urbangen/ {
    alias /var/www/urbangen/;
    try_files $uri $uri/ /urbangen/index.html;
}
```

## Database (PostgreSQL + PostGIS)

**Tables with geometry:**
- `osi_sush` - Road network (LineString)
- `red_lines` - Red lines (LineString)

### Key Fields in `osi_sush`
- `class_active_2016` - Road category (used for styling)
- `na_obj` - Object name (used as popup title)
- `geom` - Geometry (excluded from popup)

### Road Categories (`class_active_2016` values)
```
- Магистральные городские дороги 1-го класса - скоростного движения
- Магистральные улицы общегородского значения 1-го класса - непрерывного движения
- Магистральные городские дороги 2-го класса - регулируемого движения
- Магистральные улицы общегородского значения 2-го класса - регулируемого движения
- Магистральные улицы общегородского значения 3-го класса - регулируемого движения
- Магистральные улицы районного значения
- Улицы и дороги местного значения
- Проезды
- -  (uncategorized)
```

## Deploy Commands

### Full Deploy
```bash
cd /var/www/urbangen && \
git fetch origin claude/review-project-continue-MysSc && \
git reset --hard origin/claude/review-project-continue-MysSc && \
rm -rf assets/* && \
npm run build && \
cp -r dist/* .
```

### Restart Services
```bash
sudo systemctl restart nginx
sudo systemctl restart martin  # if exists
```

## Frontend Config

**File:** `src/core/Config.ts`
```typescript
api: {
  martinBaseUrl: 'https://mdlaba.ru/tiles',
}
```

**File:** `vite.config.ts`
```typescript
base: '/urbangen/'
```

## Layer Configuration

**File:** `src/layers/LayerConfig.ts`

Tile URL function:
```typescript
export function getTileUrl(sourceLayer: string): string {
  return `${Config.api.martinBaseUrl}/${sourceLayer}/{z}/{x}/{y}`;
}
```

## Milestone Tag

Return to stable point:
```bash
git checkout v0.1.0-milestone
```
