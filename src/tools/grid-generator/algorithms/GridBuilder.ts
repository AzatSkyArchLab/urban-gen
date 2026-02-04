/**
 * GridBuilder - builds grid and places blocks inside polygon
 */

import type {
  Point,
  BoundingBox,
  GridCell,
  PlacedBlock,
  PlacementStrategy,
  PlacementVariant
} from '../types';
import { GRID_CONFIG } from '../types';
import { getMinimumBoundingBox, isPointInPolygon, clipPolygonByPolygon } from './geometry';

/**
 * Generate grid cells inside polygon
 */
export function generateGrid(
  polygon: Point[],
  cellSizePixels: number
): { cells: GridCell[]; bbox: BoundingBox } | null {
  const bbox = getMinimumBoundingBox(polygon);
  if (!bbox) return null;

  const cells: GridCell[] = [];

  const numCellsU = Math.ceil(bbox.width / cellSizePixels);
  const numCellsV = Math.ceil(bbox.height / cellSizePixels);

  for (let i = 0; i < numCellsU; i++) {
    for (let j = 0; j < numCellsV; j++) {
      const localU = bbox.minU + i * cellSizePixels;
      const localV = bbox.minV + j * cellSizePixels;

      const cellWidth = Math.min(cellSizePixels, bbox.maxU - localU);
      const cellHeight = Math.min(cellSizePixels, bbox.maxV - localV);

      const corners = [
        { u: localU, v: localV },
        { u: localU + cellWidth, v: localV },
        { u: localU + cellWidth, v: localV + cellHeight },
        { u: localU, v: localV + cellHeight }
      ];

      const globalCorners = corners.map((c) => ({
        x: bbox.origin.x + c.u * bbox.ux + c.v * bbox.vx,
        y: bbox.origin.y + c.u * bbox.uy + c.v * bbox.vy
      }));

      // Check if cell is inside polygon
      const center = {
        x: globalCorners.reduce((sum, c) => sum + c.x, 0) / 4,
        y: globalCorners.reduce((sum, c) => sum + c.y, 0) / 4
      };

      // Cell is clean only if center and all corners are inside polygon
      const allInside =
        isPointInPolygon(center, polygon) &&
        globalCorners.every((c) => isPointInPolygon(c, polygon));

      cells.push({
        corners: globalCorners,
        gridPos: { x: i, y: j },
        category: allInside ? 'clean' : 'affected'
      });
    }
  }

  return { cells, bbox };
}

/**
 * Create grid occupancy map
 */
function createGridMap(
  cells: GridCell[],
  numCellsU: number,
  numCellsV: number
): { map: boolean[][]; cellsMap: (GridCell | null)[][] } {
  const map: boolean[][] = Array(numCellsV)
    .fill(null)
    .map(() => Array(numCellsU).fill(false));
  const cellsMap: (GridCell | null)[][] = Array(numCellsV)
    .fill(null)
    .map(() => Array(numCellsU).fill(null));

  for (const cell of cells) {
    const { x, y } = cell.gridPos;
    if (y < numCellsV && x < numCellsU) {
      map[y][x] = cell.category === 'clean';
      cellsMap[y][x] = cell;
    }
  }

  return { map, cellsMap };
}

/**
 * Place blocks with a specific strategy
 */
function placeBlocksWithStrategy(
  map: boolean[][],
  width: number,
  height: number,
  _cellsMap: (GridCell | null)[][],
  bbox: BoundingBox,
  cellSizePixels: number,
  strategy: PlacementStrategy,
  polygon: Point[]
): PlacedBlock[] {
  const placed: PlacedBlock[] = [];
  const occupied: boolean[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill(false));

  // Mark non-clean cells as occupied
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (!map[j][i]) occupied[j][i] = true;
    }
  }

  // Sort block types by size (largest first)
  let sortedBlocks = [...GRID_CONFIG.BLOCK_TYPES].sort(
    (a, b) => b.width * b.height - a.width * a.height
  );

  // Apply strategy modifications
  if (strategy.swap32and22) {
    const idx32 = sortedBlocks.findIndex((b) => b.width === 3 && b.height === 2);
    const idx22 = sortedBlocks.findIndex((b) => b.width === 2 && b.height === 2);
    if (idx32 >= 0 && idx22 >= 0) {
      [sortedBlocks[idx32], sortedBlocks[idx22]] = [
        sortedBlocks[idx22],
        sortedBlocks[idx32]
      ];
    }
  }

  // Generate positions based on direction
  const positions: { i: number; j: number }[] = [];
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      positions.push({ i, j });
    }
  }

  // Sort positions based on strategy direction
  switch (strategy.direction) {
    case 'left_down':
      positions.sort((a, b) => (a.j !== b.j ? a.j - b.j : b.i - a.i));
      break;
    case 'down_right':
      positions.sort((a, b) => (a.i !== b.i ? a.i - b.i : a.j - b.j));
      break;
    case 'down_left':
      positions.sort((a, b) => (a.i !== b.i ? b.i - a.i : a.j - b.j));
      break;
    // 'right_down' is default order
  }

  // Place blocks
  for (const pos of positions) {
    const { i, j } = pos;
    if (occupied[j][i]) continue;

    for (const blockType of sortedBlocks) {
      let orientations = [{ w: blockType.width, h: blockType.height }];

      if (blockType.width !== blockType.height) {
        orientations.push({ w: blockType.height, h: blockType.width });
      }

      // Sort orientations based on preference
      if (strategy.preferWide) {
        orientations.sort((a, b) => b.w - b.h - (a.w - a.h));
      } else if (strategy.preferTall) {
        orientations.sort((a, b) => b.h - b.w - (a.h - a.w));
      }

      let blockPlaced = false;

      for (const orient of orientations) {
        if (blockPlaced) break;

        if (i + orient.w > width || j + orient.h > height) continue;

        let canPlace = true;
        for (let dj = 0; dj < orient.h && canPlace; dj++) {
          for (let di = 0; di < orient.w && canPlace; di++) {
            if (occupied[j + dj][i + di]) {
              canPlace = false;
            }
          }
        }

        if (canPlace) {
          // Mark cells as occupied
          for (let dj = 0; dj < orient.h; dj++) {
            for (let di = 0; di < orient.w; di++) {
              occupied[j + dj][i + di] = true;
            }
          }

          // Calculate block corners in world coordinates
          const gridX = i;
          const gridY = j;
          const gridW = orient.w;
          const gridH = orient.h;

          const localU1 = bbox.minU + gridX * cellSizePixels;
          const localV1 = bbox.minV + gridY * cellSizePixels;
          const localU2 = localU1 + gridW * cellSizePixels;
          const localV2 = localV1 + gridH * cellSizePixels;

          const corners = [
            {
              x: bbox.origin.x + localU1 * bbox.ux + localV1 * bbox.vx,
              y: bbox.origin.y + localU1 * bbox.uy + localV1 * bbox.vy
            },
            {
              x: bbox.origin.x + localU2 * bbox.ux + localV1 * bbox.vx,
              y: bbox.origin.y + localU2 * bbox.uy + localV1 * bbox.vy
            },
            {
              x: bbox.origin.x + localU2 * bbox.ux + localV2 * bbox.vx,
              y: bbox.origin.y + localU2 * bbox.uy + localV2 * bbox.vy
            },
            {
              x: bbox.origin.x + localU1 * bbox.ux + localV2 * bbox.vx,
              y: bbox.origin.y + localU1 * bbox.uy + localV2 * bbox.vy
            }
          ];

          // Clip block by polygon boundary
          const clippedCorners = clipPolygonByPolygon(corners, polygon);

          placed.push({
            type: blockType,
            gridPos: { x: i, y: j },
            size: { w: orient.w, h: orient.h },
            corners,
            clippedCorners: clippedCorners.length >= 3 ? clippedCorners : corners,
            category: 'clean'
          });

          blockPlaced = true;
        }
      }

      if (blockPlaced) break;
    }
  }

  return placed;
}

/**
 * Generate all placement variants for a polygon
 */
export function generateVariants(
  polygon: Point[],
  cellSizePixels: number,
  maxVariants: number = GRID_CONFIG.STRATEGIES_COUNT
): PlacementVariant[] {
  const gridResult = generateGrid(polygon, cellSizePixels);
  if (!gridResult) return [];

  const { cells, bbox } = gridResult;

  const numCellsU = Math.ceil(bbox.width / cellSizePixels);
  const numCellsV = Math.ceil(bbox.height / cellSizePixels);

  const { map, cellsMap } = createGridMap(cells, numCellsU, numCellsV);

  // All possible strategies
  const strategies: PlacementStrategy[] = [];
  const directions: PlacementStrategy['direction'][] = [
    'right_down',
    'left_down',
    'down_right',
    'down_left'
  ];

  for (const direction of directions) {
    for (const preferWide of [true, false]) {
      for (const preferTall of [!preferWide, false]) {
        for (const swap32and22 of [false, true]) {
          strategies.push({ direction, preferWide, preferTall, swap32and22 });
        }
      }
    }
  }

  // Generate variants
  const allVariants: PlacementVariant[] = strategies.map((strategy, idx) => {
    const blocks = placeBlocksWithStrategy(
      map,
      numCellsU,
      numCellsV,
      cellsMap,
      bbox,
      cellSizePixels,
      strategy,
      polygon
    );

    const count32 = blocks.filter((b) => b.type.name === '3x2').length;
    const count22 = blocks.filter((b) => b.type.name === '2x2').length;
    const largeBlocks = count32 + count22;
    const largeBlocksCells = count32 * 6 + count22 * 4;

    const totalCells = blocks.reduce(
      (sum, b) => sum + b.size.w * b.size.h,
      0
    );

    return {
      id: idx,
      blocks,
      strategy,
      stats: {
        totalBlocks: blocks.length,
        totalCells,
        largeBlocks,
        largeBlocksCells,
        coverage: totalCells
      }
    };
  });

  // Remove duplicates based on block positions
  const uniqueVariants: PlacementVariant[] = [];
  const seenHashes = new Set<string>();

  for (const variant of allVariants) {
    const hash = variant.blocks
      .map(
        (b) =>
          `${b.gridPos.x},${b.gridPos.y},${b.size.w},${b.size.h},${b.type.name}`
      )
      .sort()
      .join('|');

    if (!seenHashes.has(hash)) {
      seenHashes.add(hash);
      uniqueVariants.push(variant);
    }
  }

  // Sort by quality (more large blocks = better)
  uniqueVariants.sort((a, b) => {
    if (b.stats.largeBlocks !== a.stats.largeBlocks) {
      return b.stats.largeBlocks - a.stats.largeBlocks;
    }
    if (b.stats.largeBlocksCells !== a.stats.largeBlocksCells) {
      return b.stats.largeBlocksCells - a.stats.largeBlocksCells;
    }
    return b.stats.coverage - a.stats.coverage;
  });

  // Return up to maxVariants
  return uniqueVariants.slice(0, maxVariants);
}

/**
 * Get bounding box corners for visualization
 */
export function getBoundingBoxCorners(bbox: BoundingBox): Point[] {
  const halfW = bbox.width / 2;
  const halfH = bbox.height / 2;

  return [
    {
      x: bbox.center.x - halfW * bbox.ux - halfH * bbox.vx,
      y: bbox.center.y - halfW * bbox.uy - halfH * bbox.vy
    },
    {
      x: bbox.center.x + halfW * bbox.ux - halfH * bbox.vx,
      y: bbox.center.y + halfW * bbox.uy - halfH * bbox.vy
    },
    {
      x: bbox.center.x + halfW * bbox.ux + halfH * bbox.vx,
      y: bbox.center.y + halfW * bbox.uy + halfH * bbox.vy
    },
    {
      x: bbox.center.x - halfW * bbox.ux + halfH * bbox.vx,
      y: bbox.center.y - halfW * bbox.uy + halfH * bbox.vy
    }
  ];
}
