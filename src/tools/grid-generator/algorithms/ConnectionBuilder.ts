/**
 * ConnectionBuilder - finds intersection points and builds connections to roads
 */

import type {
  Point,
  PlacedBlock,
  IntersectionPoint,
  ConnectionPoint
} from '../types';
import {
  segmentIntersection,
  isPointInPolygon,
  pointToSegmentDistance,
  closestPointOnSegment
} from './geometry';

/**
 * Find intersection points between blocks and polygon boundary
 */
export function findBlockPolygonIntersections(
  blocks: PlacedBlock[],
  polygon: Point[]
): IntersectionPoint[] {
  const allIntersections: IntersectionPoint[] = [];

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];
    const corners = block.corners;

    // Check which corners are inside polygon
    const insideFlags = corners.map((c) => isPointInPolygon(c, polygon));

    // 4 edges of the block
    const blockEdges = [
      { start: corners[0], end: corners[1], startIdx: 0, endIdx: 1 },
      { start: corners[1], end: corners[2], startIdx: 1, endIdx: 2 },
      { start: corners[2], end: corners[3], startIdx: 2, endIdx: 3 },
      { start: corners[3], end: corners[0], startIdx: 3, endIdx: 0 }
    ];

    // Find intersections only for edges crossing the boundary
    for (let i = 0; i < blockEdges.length; i++) {
      const blockEdge = blockEdges[i];
      const startInside = insideFlags[blockEdge.startIdx];
      const endInside = insideFlags[blockEdge.endIdx];

      // Edge crosses boundary only if one end is inside, other is outside
      if (startInside === endInside) continue;

      // Find intersection with polygon edges
      for (let j = 0; j < polygon.length; j++) {
        const polyEdge = {
          start: polygon[j],
          end: polygon[(j + 1) % polygon.length]
        };

        const intersection = segmentIntersection(
          blockEdge.start,
          blockEdge.end,
          polyEdge.start,
          polyEdge.end
        );

        if (intersection) {
          // Find closest segment of polygon to this point
          let minDist = Infinity;
          let closestSegment = { start: polyEdge.start, end: polyEdge.end, index: j };

          for (let k = 0; k < polygon.length; k++) {
            const p1 = polygon[k];
            const p2 = polygon[(k + 1) % polygon.length];
            const dist = pointToSegmentDistance(intersection, p1, p2);

            if (dist < minDist) {
              minDist = dist;
              closestSegment = { start: p1, end: p2, index: k };
            }
          }

          allIntersections.push({
            point: intersection,
            blockIndex: blockIdx,
            blockEdgeIndex: i,
            polyEdgeIndex: j,
            closestSegment
          });
        }
      }
    }
  }

  // Remove duplicates (points very close to each other)
  const DUPLICATE_THRESHOLD = 2; // pixels
  const uniquePoints: IntersectionPoint[] = [];

  for (const point of allIntersections) {
    const isDuplicate = uniquePoints.some((existing) => {
      const dist = Math.sqrt(
        (point.point.x - existing.point.x) ** 2 +
          (point.point.y - existing.point.y) ** 2
      );
      return dist < DUPLICATE_THRESHOLD;
    });

    if (!isDuplicate) {
      uniquePoints.push(point);
    }
  }

  return uniquePoints;
}

/**
 * Build connections from intersection points to nearest road segments
 */
export function buildConnections(
  vertices: IntersectionPoint[],
  roads: Point[][],
  polygon: Point[]
): ConnectionPoint[] {
  const allConnections: ConnectionPoint[] = [];

  for (let vertexIdx = 0; vertexIdx < vertices.length; vertexIdx++) {
    const vertex = vertices[vertexIdx];

    // Find closest point on all roads
    let closestRoadPoint: ConnectionPoint | null = null;
    let minDistToRoad = Infinity;

    for (let roadIdx = 0; roadIdx < roads.length; roadIdx++) {
      const road = roads[roadIdx];

      for (let i = 0; i < road.length - 1; i++) {
        const r1 = road[i];
        const r2 = road[i + 1];

        const projection = closestPointOnSegment(vertex.point, r1, r2);
        const dist = Math.sqrt(
          (vertex.point.x - projection.point.x) ** 2 +
            (vertex.point.y - projection.point.y) ** 2
        );

        if (dist < minDistToRoad) {
          minDistToRoad = dist;
          closestRoadPoint = {
            point: projection.point,
            roadIdx,
            distance: dist,
            vertexIndex: vertexIdx,
            vertex,
            angleDeg: 0,
            angleToEdge: 0,
            polyEdgeIndex: vertex.closestSegment.index
          };
        }
      }
    }

    if (closestRoadPoint) {
      // Calculate angle between connection line and polygon edge
      const connectionVector = {
        x: closestRoadPoint.point.x - vertex.point.x,
        y: closestRoadPoint.point.y - vertex.point.y
      };

      const polyEdge = vertex.closestSegment;
      const edgeVector = {
        x: polyEdge.end.x - polyEdge.start.x,
        y: polyEdge.end.y - polyEdge.start.y
      };

      // Calculate angle between vectors
      const dotProduct =
        connectionVector.x * edgeVector.x + connectionVector.y * edgeVector.y;
      const magConnection = Math.sqrt(
        connectionVector.x ** 2 + connectionVector.y ** 2
      );
      const magEdge = Math.sqrt(edgeVector.x ** 2 + edgeVector.y ** 2);

      if (magConnection > 0 && magEdge > 0) {
        const cosAngle = Math.max(
          -1,
          Math.min(1, dotProduct / (magConnection * magEdge))
        );
        const angleRad = Math.acos(cosAngle);
        const angleDeg = angleRad * (180 / Math.PI);

        // Angle deviation from perpendicular (0 = perpendicular, 90 = parallel)
        const angleToEdge = Math.abs(angleDeg - 90);

        closestRoadPoint.angleDeg = angleDeg;
        closestRoadPoint.angleToEdge = angleToEdge;
      }

      allConnections.push(closestRoadPoint);
    }
  }

  // Filter out connections that intersect the polygon boundary
  const validConnections: ConnectionPoint[] = [];

  for (const conn of allConnections) {
    const lineStart = conn.vertex.point;
    const lineEnd = conn.point;

    let intersectsPolygon = false;

    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];

      const intersection = segmentIntersection(lineStart, lineEnd, p1, p2);

      if (intersection) {
        // Check that intersection is not at vertex point itself
        const distToStart = Math.sqrt(
          (intersection.x - lineStart.x) ** 2 +
            (intersection.y - lineStart.y) ** 2
        );

        if (distToStart > 2) {
          intersectsPolygon = true;
          break;
        }
      }
    }

    if (!intersectsPolygon) {
      validConnections.push(conn);
    }
  }

  return validConnections;
}

/**
 * Get valid vertices (those that have valid connections)
 */
export function getValidVertices(
  vertices: IntersectionPoint[],
  connections: ConnectionPoint[]
): IntersectionPoint[] {
  const validIndices = new Set(connections.map((c) => c.vertexIndex));
  return vertices.filter((_, idx) => validIndices.has(idx));
}
