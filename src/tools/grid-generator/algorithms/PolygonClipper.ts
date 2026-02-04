/**
 * PolygonClipper - splits polygon by lines using planar graph face detection
 *
 * Algorithm:
 * 1. Take polygon boundary edges
 * 2. Clip red lines to polygon interior
 * 3. Find all intersections between edges
 * 4. Build planar graph from edges
 * 5. Find all closed faces (minimal cycles) in the graph
 * 6. Each face = one sub-polygon
 */

import type { Point, Coordinate, SubPolygon } from '../types';
import {
  segmentIntersection,
  isPointInPolygon,
  polygonArea
} from './geometry';

const EPSILON = 0.0001;
const POINT_TOLERANCE = 2; // pixels - tolerance for merging nearby points

interface GraphNode {
  point: Point;
  edges: number[]; // indices of edges connected to this node
}

interface GraphEdge {
  nodeA: number;
  nodeB: number;
  visited: boolean;
  visitedReverse: boolean;
}

/**
 * Check if two points are close enough to be considered the same
 */
function pointsEqual(p1: Point, p2: Point): boolean {
  return Math.abs(p1.x - p2.x) < POINT_TOLERANCE && Math.abs(p1.y - p2.y) < POINT_TOLERANCE;
}

/**
 * Find or create a node for a point
 */
function findOrCreateNode(nodes: GraphNode[], point: Point): number {
  for (let i = 0; i < nodes.length; i++) {
    if (pointsEqual(nodes[i].point, point)) {
      return i;
    }
  }
  nodes.push({ point: { x: point.x, y: point.y }, edges: [] });
  return nodes.length - 1;
}

/**
 * Clip a line segment to polygon interior
 * Returns the part of the segment that is inside the polygon
 */
function clipSegmentToPolygon(p1: Point, p2: Point, polygon: Point[]): [Point, Point] | null {
  // Find intersections with polygon edges
  const intersections: { point: Point; t: number }[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const inter = segmentIntersection(p1, p2, a, b);
    if (inter) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const t = Math.abs(dx) > Math.abs(dy)
        ? (inter.x - p1.x) / dx
        : (inter.y - p1.y) / dy;
      intersections.push({ point: inter, t });
    }
  }

  // Sort by t parameter
  intersections.sort((a, b) => a.t - b.t);

  // Check endpoints
  const p1Inside = isPointInPolygon(p1, polygon);
  const p2Inside = isPointInPolygon(p2, polygon);

  if (intersections.length === 0) {
    // No intersections - either fully inside or fully outside
    if (p1Inside && p2Inside) {
      return [p1, p2];
    }
    return null;
  }

  if (intersections.length === 1) {
    // One intersection - one endpoint inside
    if (p1Inside) {
      return [p1, intersections[0].point];
    } else if (p2Inside) {
      return [intersections[0].point, p2];
    }
    return null;
  }

  // Multiple intersections - take the segment between first entry and last exit
  // For simplicity, return segment between first two intersections if both endpoints outside
  if (!p1Inside && !p2Inside && intersections.length >= 2) {
    return [intersections[0].point, intersections[1].point];
  }

  // p1 inside, p2 outside
  if (p1Inside) {
    return [p1, intersections[0].point];
  }
  // p1 outside, p2 inside
  if (p2Inside) {
    return [intersections[intersections.length - 1].point, p2];
  }

  return null;
}

/**
 * Find all intersections between segments and split them
 */
function findAllIntersections(segments: [Point, Point][]): [Point, Point][] {
  const result: [Point, Point][] = [];

  for (let i = 0; i < segments.length; i++) {
    const [a1, a2] = segments[i];
    const splitPoints: { point: Point; t: number }[] = [
      { point: a1, t: 0 },
      { point: a2, t: 1 }
    ];

    // Find intersections with all other segments
    for (let j = 0; j < segments.length; j++) {
      if (i === j) continue;
      const [b1, b2] = segments[j];
      const inter = segmentIntersection(a1, a2, b1, b2);
      if (inter) {
        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const t = Math.abs(dx) > Math.abs(dy)
          ? (inter.x - a1.x) / dx
          : (inter.y - a1.y) / dy;
        if (t > EPSILON && t < 1 - EPSILON) {
          splitPoints.push({ point: inter, t });
        }
      }
    }

    // Sort by t and create sub-segments
    splitPoints.sort((a, b) => a.t - b.t);
    for (let k = 0; k < splitPoints.length - 1; k++) {
      const p1 = splitPoints[k].point;
      const p2 = splitPoints[k + 1].point;
      // Skip degenerate segments
      const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      if (len > POINT_TOLERANCE) {
        result.push([p1, p2]);
      }
    }
  }

  return result;
}

/**
 * Build a planar graph from segments
 */
function buildGraph(segments: [Point, Point][]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const [p1, p2] of segments) {
    const nodeA = findOrCreateNode(nodes, p1);
    const nodeB = findOrCreateNode(nodes, p2);

    if (nodeA === nodeB) continue; // Skip zero-length edges

    const edgeIdx = edges.length;
    edges.push({ nodeA, nodeB, visited: false, visitedReverse: false });
    nodes[nodeA].edges.push(edgeIdx);
    nodes[nodeB].edges.push(edgeIdx);
  }

  return { nodes, edges };
}

/**
 * Calculate angle from node to another node via edge
 */
function getEdgeAngle(nodes: GraphNode[], fromNode: number, toNode: number): number {
  const from = nodes[fromNode].point;
  const to = nodes[toNode].point;
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Find the next edge in a clockwise traversal (rightmost turn)
 */
function findNextEdge(
  nodes: GraphNode[],
  edges: GraphEdge[],
  currentNode: number,
  prevNode: number
): { edgeIdx: number; nextNode: number } | null {
  const node = nodes[currentNode];
  const incomingAngle = getEdgeAngle(nodes, currentNode, prevNode);

  let bestEdge = -1;
  let bestNode = -1;
  let bestAngle = -Infinity;

  for (const edgeIdx of node.edges) {
    const edge = edges[edgeIdx];
    const otherNode = edge.nodeA === currentNode ? edge.nodeB : edge.nodeA;

    if (otherNode === prevNode) continue; // Don't go back

    // Check if this direction is already visited
    const isForward = edge.nodeA === currentNode;
    if (isForward && edge.visited) continue;
    if (!isForward && edge.visitedReverse) continue;

    const outgoingAngle = getEdgeAngle(nodes, currentNode, otherNode);
    // Calculate the signed angle difference (we want rightmost turn = smallest positive angle)
    let angleDiff = outgoingAngle - incomingAngle;
    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    if (angleDiff > bestAngle) {
      bestAngle = angleDiff;
      bestEdge = edgeIdx;
      bestNode = otherNode;
    }
  }

  if (bestEdge === -1) return null;
  return { edgeIdx: bestEdge, nextNode: bestNode };
}

/**
 * Extract all faces from the planar graph
 */
function extractFaces(nodes: GraphNode[], edges: GraphEdge[]): Point[][] {
  const faces: Point[][] = [];

  // Try to find faces starting from each unvisited edge direction
  for (let startEdgeIdx = 0; startEdgeIdx < edges.length; startEdgeIdx++) {
    const startEdge = edges[startEdgeIdx];

    // Try forward direction
    if (!startEdge.visited) {
      const face = traceFace(nodes, edges, startEdgeIdx, true);
      if (face && face.length >= 3) {
        faces.push(face);
      }
    }

    // Try reverse direction
    if (!startEdge.visitedReverse) {
      const face = traceFace(nodes, edges, startEdgeIdx, false);
      if (face && face.length >= 3) {
        faces.push(face);
      }
    }
  }

  return faces;
}

/**
 * Trace a single face starting from an edge
 */
function traceFace(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startEdgeIdx: number,
  forward: boolean
): Point[] | null {
  const edge = edges[startEdgeIdx];
  const startNode = forward ? edge.nodeA : edge.nodeB;
  const secondNode = forward ? edge.nodeB : edge.nodeA;

  // Mark starting edge as visited
  if (forward) {
    edge.visited = true;
  } else {
    edge.visitedReverse = true;
  }

  const facePoints: Point[] = [nodes[startNode].point];
  let currentNode = secondNode;
  let prevNode = startNode;

  const maxIterations = edges.length * 2;
  let iterations = 0;

  while (currentNode !== startNode && iterations < maxIterations) {
    facePoints.push(nodes[currentNode].point);

    const next = findNextEdge(nodes, edges, currentNode, prevNode);
    if (!next) break;

    // Mark edge as visited
    const nextEdge = edges[next.edgeIdx];
    if (nextEdge.nodeA === currentNode) {
      nextEdge.visited = true;
    } else {
      nextEdge.visitedReverse = true;
    }

    prevNode = currentNode;
    currentNode = next.nextNode;
    iterations++;
  }

  if (currentNode !== startNode) {
    return null; // Didn't close the loop
  }

  return facePoints;
}

/**
 * Main function: Split polygon by lines
 */
export function splitPolygonByLines(polygon: Point[], lines: Point[][]): Point[][] {
  console.log(`[PolygonClipper] Input: polygon with ${polygon.length} points, ${lines.length} lines`);

  if (polygon.length < 3) return [polygon];

  // Step 1: Collect all segments (polygon edges + clipped red lines)
  const allSegments: [Point, Point][] = [];

  // Add polygon boundary edges
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    allSegments.push([p1, p2]);
  }
  console.log(`[PolygonClipper] Added ${polygon.length} polygon edges`);

  // Add red lines clipped to polygon
  let clippedCount = 0;
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const clipped = clipSegmentToPolygon(line[i], line[i + 1], polygon);
      if (clipped) {
        allSegments.push(clipped);
        clippedCount++;
      }
    }
  }
  console.log(`[PolygonClipper] Added ${clippedCount} clipped red line segments`);

  if (clippedCount === 0) {
    console.log('[PolygonClipper] No red lines inside polygon, returning original');
    return [polygon];
  }

  // Step 2: Find all intersections and split segments
  const splitSegments = findAllIntersections(allSegments);
  console.log(`[PolygonClipper] After splitting: ${splitSegments.length} segments`);

  // Step 3: Build planar graph
  const { nodes, edges } = buildGraph(splitSegments);
  console.log(`[PolygonClipper] Graph: ${nodes.length} nodes, ${edges.length} edges`);

  // Step 4: Extract faces
  const faces = extractFaces(nodes, edges);
  console.log(`[PolygonClipper] Found ${faces.length} faces`);

  // Step 5: Filter valid faces (inside the original polygon, positive area)
  const validFaces = faces.filter(face => {
    const area = polygonArea(face);
    if (area < 100) return false; // Too small

    // Check if centroid is inside original polygon
    let cx = 0, cy = 0;
    for (const p of face) {
      cx += p.x;
      cy += p.y;
    }
    cx /= face.length;
    cy /= face.length;

    return isPointInPolygon({ x: cx, y: cy }, polygon);
  });

  console.log(`[PolygonClipper] Result: ${validFaces.length} valid sub-polygons`);

  return validFaces.length > 0 ? validFaces : [polygon];
}

/**
 * Check if polygon collides with any road line
 */
export function polygonCollidesWithRoads(polygon: Point[], roads: Point[][]): boolean {
  for (const road of roads) {
    for (let i = 0; i < road.length - 1; i++) {
      const r1 = road[i];
      const r2 = road[i + 1];

      // Check if road segment intersects polygon boundary
      for (let j = 0; j < polygon.length; j++) {
        const p1 = polygon[j];
        const p2 = polygon[(j + 1) % polygon.length];
        if (segmentIntersection(r1, r2, p1, p2)) {
          return true;
        }
      }

      // Check if road segment midpoint is inside polygon
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
