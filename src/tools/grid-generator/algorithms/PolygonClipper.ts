/**
 * PolygonClipper - splits polygon by lines (red lines)
 *
 * Algorithm:
 * 1. Find all intersection points between polygon and lines
 * 2. Split polygon edges at intersection points
 * 3. Build sub-polygons from split edges
 */

import type { Point, Coordinate, SubPolygon } from '../types';
import {
  segmentIntersection,
  isPointInPolygon,
  polygonArea
} from './geometry';

interface SplitPoint {
  point: Point;
  lineIdx: number;
  edgeIdx: number;
  t: number; // parameter along edge (0-1)
}

/**
 * Split polygon by multiple lines
 */
export function splitPolygonByLines(
  polygon: Point[],
  lines: Point[][]
): Point[][] {
  console.log(`[PolygonClipper] Input: polygon with ${polygon.length} points, ${lines.length} lines`);

  // Debug: log actual polygon coordinates
  const polyMinX = Math.min(...polygon.map(p => p.x));
  const polyMaxX = Math.max(...polygon.map(p => p.x));
  const polyMinY = Math.min(...polygon.map(p => p.y));
  const polyMaxY = Math.max(...polygon.map(p => p.y));
  console.log('[PolygonClipper] Polygon bounds:', {
    minX: polyMinX.toFixed(1),
    maxX: polyMaxX.toFixed(1),
    minY: polyMinY.toFixed(1),
    maxY: polyMaxY.toFixed(1)
  });

  if (lines.length === 0) {
    console.log('[PolygonClipper] No lines to split by, returning original polygon');
    return [polygon];
  }

  // Debug: log line bounds and count overlapping lines
  let lineMinX = Infinity, lineMaxX = -Infinity;
  let lineMinY = Infinity, lineMaxY = -Infinity;
  let linesInBounds = 0;

  for (const line of lines) {
    let lMinX = Infinity, lMaxX = -Infinity;
    let lMinY = Infinity, lMaxY = -Infinity;
    for (const pt of line) {
      lMinX = Math.min(lMinX, pt.x);
      lMaxX = Math.max(lMaxX, pt.x);
      lMinY = Math.min(lMinY, pt.y);
      lMaxY = Math.max(lMaxY, pt.y);
      lineMinX = Math.min(lineMinX, pt.x);
      lineMaxX = Math.max(lineMaxX, pt.x);
      lineMinY = Math.min(lineMinY, pt.y);
      lineMaxY = Math.max(lineMaxY, pt.y);
    }

    // Check if this line's bounds overlap with polygon bounds
    const overlapsX = lMinX <= polyMaxX && lMaxX >= polyMinX;
    const overlapsY = lMinY <= polyMaxY && lMaxY >= polyMinY;
    if (overlapsX && overlapsY) {
      linesInBounds++;
    }
  }
  console.log('[PolygonClipper] Lines bounds:', {
    minX: lineMinX.toFixed(1),
    maxX: lineMaxX.toFixed(1),
    minY: lineMinY.toFixed(1),
    maxY: lineMaxY.toFixed(1)
  });
  console.log(`[PolygonClipper] Lines with overlapping bounds: ${linesInBounds} of ${lines.length}`);

  // Debug: log first polygon vertex and first line segment
  if (lines.length > 0 && lines[0].length > 1) {
    console.log('[PolygonClipper] First polygon vertex:', { x: polygon[0].x.toFixed(1), y: polygon[0].y.toFixed(1) });
    console.log('[PolygonClipper] First line segment:',
      { x: lines[0][0].x.toFixed(1), y: lines[0][0].y.toFixed(1) },
      '->',
      { x: lines[0][1].x.toFixed(1), y: lines[0][1].y.toFixed(1) }
    );
  }

  let currentPolygons = [polygon];
  let totalIntersections = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const newPolygons: Point[][] = [];

    for (const poly of currentPolygons) {
      const split = splitPolygonBySingleLine(poly, line, i < 3); // Debug first 3 lines
      if (split.length > 1) {
        totalIntersections++;
      }
      newPolygons.push(...split);
    }

    currentPolygons = newPolygons;
  }

  // Filter out degenerate polygons (less than 3 points or very small area)
  const result = currentPolygons.filter(
    (p) => p.length >= 3 && polygonArea(p) > 1
  );

  console.log(`[PolygonClipper] Result: ${result.length} sub-polygons, ${totalIntersections} lines caused splits`);

  return result;
}

/**
 * Split a single polygon by a single line
 */
function splitPolygonBySingleLine(polygon: Point[], line: Point[], debug = false): Point[][] {
  // Find all intersection points
  const intersections: SplitPoint[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    for (let j = 0; j < line.length - 1; j++) {
      const l1 = line[j];
      const l2 = line[j + 1];

      const intersection = segmentIntersection(p1, p2, l1, l2);
      if (intersection) {
        // Calculate t parameter along polygon edge
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const t =
          len > 0
            ? Math.sqrt(
                (intersection.x - p1.x) ** 2 + (intersection.y - p1.y) ** 2
              ) / len
            : 0;

        intersections.push({
          point: intersection,
          lineIdx: j,
          edgeIdx: i,
          t
        });
      }
    }
  }

  if (debug) {
    console.log(`[PolygonClipper] Line with ${line.length} points found ${intersections.length} intersections`);
  }

  // Need at least 2 intersections to split
  if (intersections.length < 2) {
    return [polygon];
  }

  // Sort intersections by edge index, then by t parameter
  intersections.sort((a, b) => {
    if (a.edgeIdx !== b.edgeIdx) return a.edgeIdx - b.edgeIdx;
    return a.t - b.t;
  });

  // If we have exactly 2 intersections, split into 2 polygons
  if (intersections.length === 2) {
    return splitPolygonAt2Points(polygon, intersections[0], intersections[1]);
  }

  // For more intersections, pair them up and split iteratively
  // This is a simplified approach - for complex cases might need more sophisticated algorithm
  const pairs: [SplitPoint, SplitPoint][] = [];
  for (let i = 0; i < intersections.length - 1; i += 2) {
    pairs.push([intersections[i], intersections[i + 1]]);
  }

  let result = [polygon];
  for (const [p1, p2] of pairs) {
    const newResult: Point[][] = [];
    for (const poly of result) {
      const split = splitPolygonAt2Points(poly, p1, p2);
      newResult.push(...split);
    }
    result = newResult;
  }

  return result;
}

/**
 * Split polygon at exactly 2 intersection points
 */
function splitPolygonAt2Points(
  polygon: Point[],
  int1: SplitPoint,
  int2: SplitPoint
): Point[][] {
  // Ensure int1 comes before int2 in polygon order
  if (
    int1.edgeIdx > int2.edgeIdx ||
    (int1.edgeIdx === int2.edgeIdx && int1.t > int2.t)
  ) {
    [int1, int2] = [int2, int1];
  }

  const poly1: Point[] = [];
  const poly2: Point[] = [];

  // Build first polygon: from int1 to int2 along polygon
  poly1.push(int1.point);
  for (let i = int1.edgeIdx + 1; i <= int2.edgeIdx; i++) {
    poly1.push(polygon[i]);
  }
  if (int2.t > 0) {
    poly1.push(int2.point);
  }

  // Build second polygon: from int2 back to int1
  poly2.push(int2.point);
  for (let i = int2.edgeIdx + 1; i < polygon.length; i++) {
    poly2.push(polygon[i]);
  }
  for (let i = 0; i <= int1.edgeIdx; i++) {
    poly2.push(polygon[i]);
  }
  if (int1.t > 0) {
    poly2.push(int1.point);
  }

  // Filter out degenerate polygons
  const result: Point[][] = [];
  if (poly1.length >= 3 && polygonArea(poly1) > 1) {
    result.push(poly1);
  }
  if (poly2.length >= 3 && polygonArea(poly2) > 1) {
    result.push(poly2);
  }

  return result.length > 0 ? result : [polygon];
}

/**
 * Check if polygon collides with any road line
 */
export function polygonCollidesWithRoads(
  polygon: Point[],
  roads: Point[][]
): boolean {
  for (const road of roads) {
    // Check if any road segment intersects polygon
    for (let i = 0; i < road.length - 1; i++) {
      const r1 = road[i];
      const r2 = road[i + 1];

      for (let j = 0; j < polygon.length; j++) {
        const p1 = polygon[j];
        const p2 = polygon[(j + 1) % polygon.length];

        if (segmentIntersection(r1, r2, p1, p2)) {
          return true;
        }
      }

      // Check if road segment is inside polygon
      const midpoint = {
        x: (r1.x + r2.x) / 2,
        y: (r1.y + r2.y) / 2
      };
      if (isPointInPolygon(midpoint, polygon)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Convert line features to pixel coordinates
 */
export function lineFeaturesToPixels(
  features: GeoJSON.Feature<GeoJSON.LineString>[],
  project: (lngLat: [number, number]) => { x: number; y: number }
): Point[][] {
  return features.map((feature) => {
    const coords = feature.geometry.coordinates as [number, number][];
    return coords.map((c) => project(c));
  });
}

/**
 * Create sub-polygons from source polygon, red lines, and roads
 */
export function createSubPolygons(
  sourcePolygon: Point[],
  redLines: Point[][],
  roads: Point[][],
  unproject: (point: { x: number; y: number }) => { lng: number; lat: number }
): SubPolygon[] {
  // Split by red lines
  const splitPolygons = splitPolygonByLines(sourcePolygon, redLines);

  // Create sub-polygons with validity check
  return splitPolygons.map((poly, idx) => {
    const isValid = !polygonCollidesWithRoads(poly, roads);

    // Convert back to coordinates
    const coordinates: Coordinate[] = poly.map((p) => {
      const lngLat = unproject(p);
      return [lngLat.lng, lngLat.lat];
    });

    return {
      id: `sub-${idx}`,
      coordinates,
      pixelCoords: poly,
      isValid,
      currentVariant: 0
    };
  });
}
