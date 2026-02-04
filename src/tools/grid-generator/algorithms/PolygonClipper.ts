/**
 * PolygonClipper - splits polygon by lines (red lines)
 *
 * Algorithm:
 * 1. Merge connected line segments into continuous polylines
 * 2. Extend polylines to ensure they cross polygon boundaries
 * 3. Split polygon iteratively by each line
 * 4. Merge touching polygons back together
 */

import type { Point, Coordinate, SubPolygon } from '../types';
import {
  segmentIntersection,
  isPointInPolygon,
  polygonArea
} from './geometry';
import union from '@turf/union';
import { polygon as turfPolygon, featureCollection } from '@turf/helpers';

// Increased tolerance to handle tile boundary gaps from Martin
const MERGE_TOLERANCE = 30; // pixels (increased for better tile gap handling)

interface SplitPoint {
  point: Point;
  edgeIdx: number;
  t: number;
}

/**
 * Check if two points are close enough to merge
 */
function pointsClose(p1: Point, p2: Point, tolerance = MERGE_TOLERANCE): boolean {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy) < tolerance;
}

/**
 * Merge connected line segments into continuous polylines
 */
function mergeLineSegments(lines: Point[][]): Point[][] {
  if (lines.length === 0) return [];

  const remaining = lines.map(line => [...line]);
  const merged: Point[][] = [];

  while (remaining.length > 0) {
    let current = remaining.shift()!;
    let changed = true;

    while (changed) {
      changed = false;

      for (let i = remaining.length - 1; i >= 0; i--) {
        const segment = remaining[i];
        const segStart = segment[0];
        const segEnd = segment[segment.length - 1];
        const curStart = current[0];
        const curEnd = current[current.length - 1];

        if (pointsClose(segEnd, curStart)) {
          current = [...segment.slice(0, -1), ...current];
          remaining.splice(i, 1);
          changed = true;
        } else if (pointsClose(curEnd, segStart)) {
          current = [...current.slice(0, -1), ...segment];
          remaining.splice(i, 1);
          changed = true;
        } else if (pointsClose(segStart, curStart)) {
          current = [...segment.reverse().slice(0, -1), ...current];
          remaining.splice(i, 1);
          changed = true;
        } else if (pointsClose(curEnd, segEnd)) {
          current = [...current.slice(0, -1), ...segment.reverse()];
          remaining.splice(i, 1);
          changed = true;
        }
      }
    }

    merged.push(current);
  }

  return merged;
}

/**
 * Extend a polyline to cross polygon bounds
 */
function extendLine(line: Point[], extendDist: number): Point[] {
  if (line.length < 2) return line;

  const p1 = line[0];
  const p2 = line[line.length - 1];

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 0.001) return line;

  const ux = dx / len;
  const uy = dy / len;

  return [
    { x: p1.x - ux * extendDist, y: p1.y - uy * extendDist },
    ...line,
    { x: p2.x + ux * extendDist, y: p2.y + uy * extendDist }
  ];
}

/**
 * Check if line has any point inside or near polygon bounds
 */
function lineNearPolygon(line: Point[], polyBounds: { minX: number; maxX: number; minY: number; maxY: number }): boolean {
  const margin = 50;
  for (const pt of line) {
    if (pt.x >= polyBounds.minX - margin && pt.x <= polyBounds.maxX + margin &&
        pt.y >= polyBounds.minY - margin && pt.y <= polyBounds.maxY + margin) {
      return true;
    }
  }
  return false;
}

/**
 * Find intersection points between polygon edges and a line
 */
function findIntersections(polygon: Point[], line: Point[]): SplitPoint[] {
  const intersections: SplitPoint[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    for (let j = 0; j < line.length - 1; j++) {
      const l1 = line[j];
      const l2 = line[j + 1];

      const inter = segmentIntersection(p1, p2, l1, l2);
      if (inter) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const t = len > 0
          ? Math.sqrt((inter.x - p1.x) ** 2 + (inter.y - p1.y) ** 2) / len
          : 0;

        intersections.push({ point: inter, edgeIdx: i, t });
      }
    }
  }

  // Sort by edge index, then by t
  intersections.sort((a, b) => {
    if (a.edgeIdx !== b.edgeIdx) return a.edgeIdx - b.edgeIdx;
    return a.t - b.t;
  });

  return intersections;
}

/**
 * Split polygon by a single line (needs exactly 2 intersection points)
 */
function splitPolygonBySingleLine(polygon: Point[], line: Point[]): Point[][] {
  const intersections = findIntersections(polygon, line);

  if (intersections.length < 2) {
    return [polygon];
  }

  // Take first two intersections
  let int1 = intersections[0];
  let int2 = intersections[1];

  // Ensure int1 comes before int2
  if (int1.edgeIdx > int2.edgeIdx || (int1.edgeIdx === int2.edgeIdx && int1.t > int2.t)) {
    [int1, int2] = [int2, int1];
  }

  const poly1: Point[] = [];
  const poly2: Point[] = [];

  // Build first polygon: from int1 to int2
  poly1.push(int1.point);
  for (let i = int1.edgeIdx + 1; i <= int2.edgeIdx; i++) {
    poly1.push(polygon[i]);
  }
  poly1.push(int2.point);

  // Build second polygon: from int2 back to int1
  poly2.push(int2.point);
  for (let i = int2.edgeIdx + 1; i < polygon.length; i++) {
    poly2.push(polygon[i]);
  }
  for (let i = 0; i <= int1.edgeIdx; i++) {
    poly2.push(polygon[i]);
  }
  poly2.push(int1.point);

  const result: Point[][] = [];
  if (poly1.length >= 3 && polygonArea(poly1) > 100) {
    result.push(poly1);
  }
  if (poly2.length >= 3 && polygonArea(poly2) > 100) {
    result.push(poly2);
  }

  return result.length > 0 ? result : [polygon];
}

/**
 * Main function: Split polygon by lines
 */
export function splitPolygonByLines(polygon: Point[], lines: Point[][]): Point[][] {
  console.log(`[PolygonClipper] Input: polygon with ${polygon.length} points, ${lines.length} lines`);

  if (polygon.length < 3 || lines.length === 0) {
    return [polygon];
  }

  // Calculate polygon bounds
  const polyMinX = Math.min(...polygon.map(p => p.x));
  const polyMaxX = Math.max(...polygon.map(p => p.x));
  const polyMinY = Math.min(...polygon.map(p => p.y));
  const polyMaxY = Math.max(...polygon.map(p => p.y));
  const polyBounds = { minX: polyMinX, maxX: polyMaxX, minY: polyMinY, maxY: polyMaxY };

  const polyWidth = polyMaxX - polyMinX;
  const polyHeight = polyMaxY - polyMinY;
  const extendDist = Math.max(polyWidth, polyHeight) * 2;

  // Filter lines near polygon
  const nearbyLines = lines.filter(line => lineNearPolygon(line, polyBounds));
  console.log(`[PolygonClipper] Nearby lines: ${nearbyLines.length}`);

  if (nearbyLines.length === 0) {
    return [polygon];
  }

  // Merge connected segments
  const mergedLines = mergeLineSegments(nearbyLines);
  console.log(`[PolygonClipper] Merged into ${mergedLines.length} polylines`);

  // Extend lines
  const extendedLines = mergedLines.map(line => extendLine(line, extendDist));

  // Split polygon iteratively
  let currentPolygons = [polygon];

  for (const line of extendedLines) {
    const newPolygons: Point[][] = [];
    for (const poly of currentPolygons) {
      const split = splitPolygonBySingleLine(poly, line);
      newPolygons.push(...split);
    }
    currentPolygons = newPolygons;
  }

  // Filter valid polygons
  const result = currentPolygons.filter(p => p.length >= 3 && polygonArea(p) > 100);

  console.log(`[PolygonClipper] Result: ${result.length} sub-polygons`);

  // Merge touching polygons
  const mergedPolygons = mergeTouchingPolygons(result.length > 0 ? result : [polygon]);
  console.log(`[PolygonClipper] After merge: ${mergedPolygons.length} sub-polygons`);

  return mergedPolygons;
}

/**
 * Check if two edges share a segment (not just a point)
 */
function edgesShareSegment(
  a1: Point, a2: Point,
  b1: Point, b2: Point,
  tolerance = 5
): boolean {
  // Check if the edges are collinear and overlapping
  const dx1 = a2.x - a1.x;
  const dy1 = a2.y - a1.y;
  const dx2 = b2.x - b1.x;
  const dy2 = b2.y - b1.y;

  // Check parallelism
  const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

  if (len1 < 0.001 || len2 < 0.001) return false;

  // Normalize cross product
  const normalizedCross = cross / (len1 * len2);
  if (normalizedCross > 0.1) return false; // Not parallel

  // Check if b1 is on line a1-a2
  const dist1 = pointToLineDistance(b1, a1, a2);
  const dist2 = pointToLineDistance(b2, a1, a2);

  if (dist1 > tolerance || dist2 > tolerance) return false;

  // Check overlap - project points onto line
  const t1 = projectPointOnLine(b1, a1, a2);
  const t2 = projectPointOnLine(b2, a1, a2);
  const tMin = Math.min(t1, t2);
  const tMax = Math.max(t1, t2);

  // Check if there's overlap with [0, 1]
  return tMax > 0.01 && tMin < 0.99;
}

function pointToLineDistance(p: Point, l1: Point, l2: Point): number {
  const dx = l2.x - l1.x;
  const dy = l2.y - l1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return Math.sqrt((p.x - l1.x) ** 2 + (p.y - l1.y) ** 2);

  const t = Math.max(0, Math.min(1, ((p.x - l1.x) * dx + (p.y - l1.y) * dy) / (len * len)));
  const projX = l1.x + t * dx;
  const projY = l1.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

function projectPointOnLine(p: Point, l1: Point, l2: Point): number {
  const dx = l2.x - l1.x;
  const dy = l2.y - l1.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 0.001) return 0;
  return ((p.x - l1.x) * dx + (p.y - l1.y) * dy) / len2;
}

/**
 * Check if two polygons share an edge (are touching)
 */
function polygonsShareEdge(poly1: Point[], poly2: Point[]): boolean {
  for (let i = 0; i < poly1.length; i++) {
    const a1 = poly1[i];
    const a2 = poly1[(i + 1) % poly1.length];

    for (let j = 0; j < poly2.length; j++) {
      const b1 = poly2[j];
      const b2 = poly2[(j + 1) % poly2.length];

      if (edgesShareSegment(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Convert pixel polygon to Turf polygon
 */
function toTurfPolygon(poly: Point[]): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords = poly.map(p => [p.x, p.y] as [number, number]);
  // Close the polygon
  if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1])) {
    coords.push(coords[0]);
  }
  return turfPolygon([coords]);
}

/**
 * Convert Turf polygon back to Point[]
 */
function fromTurfPolygon(feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>): Point[][] {
  const result: Point[][] = [];

  if (feature.geometry.type === 'Polygon') {
    const ring = feature.geometry.coordinates[0];
    // Remove closing point
    const pts = ring.slice(0, -1).map(c => ({ x: c[0], y: c[1] }));
    if (pts.length >= 3) result.push(pts);
  } else if (feature.geometry.type === 'MultiPolygon') {
    for (const polygon of feature.geometry.coordinates) {
      const ring = polygon[0];
      const pts = ring.slice(0, -1).map(c => ({ x: c[0], y: c[1] }));
      if (pts.length >= 3) result.push(pts);
    }
  }

  return result;
}

/**
 * Merge all touching polygons into larger polygons
 */
function mergeTouchingPolygons(polygons: Point[][]): Point[][] {
  if (polygons.length <= 1) return polygons;

  console.log(`[PolygonClipper] Merging ${polygons.length} polygons...`);

  // Build adjacency - which polygons touch
  const n = polygons.length;
  const adjacency: Set<number>[] = Array.from({ length: n }, () => new Set());

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (polygonsShareEdge(polygons[i], polygons[j])) {
        adjacency[i].add(j);
        adjacency[j].add(i);
      }
    }
  }

  // Find connected components using DFS
  const visited = new Set<number>();
  const components: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;

    const component: number[] = [];
    const stack = [i];

    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      component.push(node);

      for (const neighbor of adjacency[node]) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  console.log(`[PolygonClipper] Found ${components.length} groups of touching polygons`);

  // Merge each component
  const result: Point[][] = [];

  for (const component of components) {
    if (component.length === 1) {
      result.push(polygons[component[0]]);
      continue;
    }

    // Use Turf.js to merge polygons in this component
    try {
      let merged: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> = toTurfPolygon(polygons[component[0]]);

      for (let i = 1; i < component.length; i++) {
        const poly = toTurfPolygon(polygons[component[i]]);
        const unionResult = union(featureCollection([merged, poly]));
        if (unionResult) {
          merged = unionResult;
        }
      }

      const mergedPolygons = fromTurfPolygon(merged);
      result.push(...mergedPolygons);
    } catch (e) {
      console.warn('[PolygonClipper] Merge failed, keeping original polygons:', e);
      for (const idx of component) {
        result.push(polygons[idx]);
      }
    }
  }

  return result;
}

/**
 * Check if polygon collides with any road line
 */
export function polygonCollidesWithRoads(polygon: Point[], roads: Point[][]): boolean {
  for (const road of roads) {
    for (let i = 0; i < road.length - 1; i++) {
      const r1 = road[i];
      const r2 = road[i + 1];

      // Check intersection with polygon boundary
      for (let j = 0; j < polygon.length; j++) {
        const p1 = polygon[j];
        const p2 = polygon[(j + 1) % polygon.length];
        if (segmentIntersection(r1, r2, p1, p2)) {
          return true;
        }
      }

      // Check if road midpoint is inside polygon
      const midpoint = { x: (r1.x + r2.x) / 2, y: (r1.y + r2.y) / 2 };
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
  const splitPolygons = splitPolygonByLines(sourcePolygon, redLines);

  return splitPolygons.map((poly, idx) => {
    const isValid = !polygonCollidesWithRoads(poly, roads);
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
