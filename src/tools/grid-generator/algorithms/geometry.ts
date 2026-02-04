/**
 * Geometry utilities for grid generation
 */

import type { Point, BoundingBox, Coordinate } from '../types';

/**
 * Distance from point to line segment
 */
export function pointToSegmentDistance(point: Point, segStart: Point, segEnd: Point): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    const pdx = point.x - segStart.x;
    const pdy = point.y - segStart.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }

  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projX = segStart.x + t * dx;
  const projY = segStart.y + t * dy;

  const pdx = point.x - projX;
  const pdy = point.y - projY;

  return Math.sqrt(pdx * pdx + pdy * pdy);
}

/**
 * Closest point on segment to a given point
 */
export function closestPointOnSegment(
  point: Point,
  segStart: Point,
  segEnd: Point
): { point: Point; t: number } {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return { point: segStart, t: 0 };
  }

  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  return {
    point: {
      x: segStart.x + t * dx,
      y: segStart.y + t * dy
    },
    t
  };
}

/**
 * Minimum distance from point to polygon boundary
 */
export function minDistanceToPolygon(point: Point, polygon: Point[]): number {
  let minDist = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    const dist = pointToSegmentDistance(point, p1, p2);
    minDist = Math.min(minDist, dist);
  }

  return minDist;
}

/**
 * Check if point is inside polygon (ray casting)
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Segment intersection
 */
export function segmentIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const x1 = p1.x,
    y1 = p1.y;
  const x2 = p2.x,
    y2 = p2.y;
  const x3 = p3.x,
    y3 = p3.y;
  const x4 = p4.x,
    y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (Math.abs(denom) < 0.0001) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -(((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom);

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  return null;
}

/**
 * Check if line intersects polygon
 */
export function lineIntersectsPolygon(
  lineStart: Point,
  lineEnd: Point,
  polygon: Point[]
): boolean {
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    if (segmentIntersection(lineStart, lineEnd, p1, p2)) {
      return true;
    }
  }
  return false;
}

/**
 * Convex hull (Graham scan)
 */
export function getConvexHull(pts: Point[]): Point[] {
  if (pts.length < 3) return pts;

  const sorted = [...pts].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  const pivot = sorted[0];

  const angle = (p: Point) => Math.atan2(p.y - pivot.y, p.x - pivot.x);
  const rest = sorted.slice(1).sort((a, b) => angle(a) - angle(b));

  const hull = [pivot, rest[0]];

  for (let i = 1; i < rest.length; i++) {
    while (hull.length >= 2) {
      const [b, a] = hull.slice(-2);
      const cross =
        (a.x - b.x) * (rest[i].y - b.y) - (a.y - b.y) * (rest[i].x - b.x);
      if (cross > 0) break;
      hull.pop();
    }
    hull.push(rest[i]);
  }

  return hull;
}

/**
 * Minimum oriented bounding box
 */
export function getMinimumBoundingBox(points: Point[]): BoundingBox | null {
  if (points.length < 3) return null;

  const hull = getConvexHull(points);
  let minArea = Infinity;
  let bestBox: BoundingBox | null = null;

  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len === 0) continue;

    const ux = dx / len;
    const uy = dy / len;

    const vx = -uy;
    const vy = ux;

    let minU = Infinity,
      maxU = -Infinity;
    let minV = Infinity,
      maxV = -Infinity;

    for (const p of hull) {
      const u = (p.x - p1.x) * ux + (p.y - p1.y) * uy;
      const v = (p.x - p1.x) * vx + (p.y - p1.y) * vy;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }

    const width = maxU - minU;
    const height = maxV - minV;
    const area = width * height;

    if (area < minArea) {
      minArea = area;

      const angle = Math.atan2(uy, ux);

      const centerU = (minU + maxU) / 2;
      const centerV = (minV + maxV) / 2;

      const centerX = p1.x + centerU * ux + centerV * vx;
      const centerY = p1.y + centerU * uy + centerV * vy;

      bestBox = {
        center: { x: centerX, y: centerY },
        width,
        height,
        angle,
        ux,
        uy,
        vx,
        vy,
        minU,
        maxU,
        minV,
        maxV,
        origin: p1
      };
    }
  }

  return bestBox;
}

/**
 * Convert GeoJSON coordinates to pixel points using map projection
 */
export function coordinatesToPixels(
  coords: Coordinate[],
  project: (lngLat: [number, number]) => { x: number; y: number }
): Point[] {
  return coords.map((c) => project(c));
}

/**
 * Convert pixel points to GeoJSON coordinates using map unprojection
 */
export function pixelsToCoordinates(
  points: Point[],
  unproject: (point: { x: number; y: number }) => { lng: number; lat: number }
): Coordinate[] {
  return points.map((p) => {
    const lngLat = unproject(p);
    return [lngLat.lng, lngLat.lat];
  });
}

/**
 * Calculate meters per pixel at a given latitude and zoom
 */
export function metersPerPixel(latitude: number, zoom: number): number {
  return (
    (40075016.686 * Math.cos((latitude * Math.PI) / 180)) /
    Math.pow(2, zoom + 8)
  );
}

/**
 * Polygon area (shoelace formula)
 */
export function polygonArea(points: Point[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Polygon centroid
 */
export function polygonCentroid(points: Point[]): Point {
  let cx = 0;
  let cy = 0;
  const n = points.length;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / n, y: cy / n };
}

/**
 * Compute intersection point of line (p1->p2) with edge (e1->e2)
 */
function lineEdgeIntersection(p1: Point, p2: Point, e1: Point, e2: Point): Point | null {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = e2.x - e1.x;
  const dy2 = e2.y - e1.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((e1.x - p1.x) * dy2 - (e1.y - p1.y) * dx2) / denom;

  return {
    x: p1.x + t * dx1,
    y: p1.y + t * dy1
  };
}

/**
 * Check which side of edge a point is on
 * Returns > 0 if left (inside for CCW polygon), < 0 if right, 0 if on edge
 */
function sideOfEdge(point: Point, edgeStart: Point, edgeEnd: Point): number {
  return (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
         (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x);
}

/**
 * Clip subject polygon by one edge of the clip polygon (Sutherland-Hodgman step)
 */
function clipByEdge(subject: Point[], edgeStart: Point, edgeEnd: Point): Point[] {
  if (subject.length === 0) return [];

  const output: Point[] = [];

  for (let i = 0; i < subject.length; i++) {
    const current = subject[i];
    const next = subject[(i + 1) % subject.length];

    const currentInside = sideOfEdge(current, edgeStart, edgeEnd) >= 0;
    const nextInside = sideOfEdge(next, edgeStart, edgeEnd) >= 0;

    if (currentInside) {
      output.push(current);
      if (!nextInside) {
        // Exiting - add intersection
        const intersection = lineEdgeIntersection(current, next, edgeStart, edgeEnd);
        if (intersection) output.push(intersection);
      }
    } else if (nextInside) {
      // Entering - add intersection
      const intersection = lineEdgeIntersection(current, next, edgeStart, edgeEnd);
      if (intersection) output.push(intersection);
    }
  }

  return output;
}

/**
 * Clip a polygon by another polygon using Sutherland-Hodgman algorithm
 * Works best when clip polygon is convex, but handles simple concave cases
 */
export function clipPolygonByPolygon(subject: Point[], clip: Point[]): Point[] {
  if (subject.length < 3 || clip.length < 3) return [];

  let result = [...subject];

  // Clip by each edge of the clip polygon
  for (let i = 0; i < clip.length; i++) {
    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % clip.length];

    result = clipByEdge(result, edgeStart, edgeEnd);

    if (result.length < 3) return [];
  }

  return result;
}
