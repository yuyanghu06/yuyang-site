import * as THREE from "three";

type Point = [number, number, number];
interface End {
  center: Point;
  corners: [Point, Point];
  inward: [number, number];
  width: number;
  colorVertex: number;
  quad: number;
}

const TOLERANCE = 0.002;
const CELL_SIZE = 0.01;
const ROAD_COLORS = new Set(["#e3d8ba", "#797d73", "#747c77"].map((hex) => {
  const color = new THREE.Color(hex);
  return [color.r, color.g, color.b].map((value) => Math.round(value * 255)).join(",");
}));

/** Repair the original exporter’s disconnected ribbon bends without changing its GLB.
 * Only pairs of equal-width, equal-color butt ends at the same elevation join.
 * Bevels stay inside the endpoints' convex hull, including at acute bends.
 */
export function repairRoadJoins(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = source.getAttribute("position");
  const color = source.getAttribute("color");
  const normal = source.getAttribute("normal");
  if (!position || !color || !normal || Object.keys(source.attributes).length !== 3
    || [position, color, normal].some((attribute) => attribute.itemSize !== 3)) return source;

  const vertex = (index: number): Point => [position.getX(index), position.getY(index), position.getZ(index)];
  const colorKey = (index: number) => [color.getX(index), color.getY(index), color.getZ(index)]
    .map((value) => Math.round(value * 255)).join(",");
  const triangles = new Map<string, { corners: number[]; color: string }[]>();
  const indexCount = source.index?.count ?? position.count;
  for (let offset = 0; offset < indexCount; offset += 3) {
    const ids = [0, 1, 2].map((step) => source.index?.getX(offset + step) ?? offset + step);
    const shade = colorKey(ids[0]);
    if (!ROAD_COLORS.has(shade) || ids.some((id) => colorKey(id) !== shade)) continue;
    const points = ids.map(vertex);
    // Every exported ribbon triangle is right-angled in XZ, even on a ramp.
    const lengths = points.map((point, i) => Math.hypot(point[0] - points[(i + 1) % 3][0], point[2] - points[(i + 1) % 3][2]));
    const diagonal = lengths.indexOf(Math.max(...lengths));
    const right = (diagonal + 2) % 3;
    const a = points[diagonal], b = points[(diagonal + 1) % 3], c = points[right];
    const dot = (a[0] - c[0]) * (b[0] - c[0]) + (a[2] - c[2]) * (b[2] - c[2]);
    if (Math.abs(dot) > TOLERANCE * (lengths[right] + lengths[(right + 2) % 3])) continue;
    // Coordinates, rather than indices, also match quads split by normal seams.
    const key = `${shade}:${[a.join(","), b.join(",")].sort().join(";")}`;
    const pair = triangles.get(key) ?? [];
    pair.push({ corners: [ids[diagonal], ids[(diagonal + 1) % 3], ids[right]], color: shade });
    triangles.set(key, pair);
  }

  const buckets = new Map<string, End[]>();
  const ends: End[] = [];
  let quad = 0;
  for (const pair of triangles.values()) {
    if (pair.length !== 2) continue;
    const first = pair[0].corners, second = pair[1].corners;
    const corners = [vertex(first[0]), vertex(first[1]), vertex(first[2]), vertex(second[2])];
    if (new Set(corners.map((point) => point.join(","))).size !== 4) continue;
    // The fourth point must complete this rectangle, not an overlapping triangle.
    if ([0, 1, 2].some((axis) => Math.abs(corners[0][axis] + corners[1][axis] - corners[2][axis] - corners[3][axis]) > TOLERANCE)) continue;
    const center = [0, 1, 2].map((axis) => (corners[0][axis] + corners[1][axis]) / 2);
    for (const [a, b] of [[corners[0], corners[2]], [corners[2], corners[1]], [corners[1], corners[3]], [corners[3], corners[0]]]) {
      if (Math.abs(a[1] - b[1]) > TOLERANCE) continue;
      const width = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (width < 1 || width > 32) continue;
      const midpoint: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      const inward: [number, number] = [-(b[2] - a[2]) / width, (b[0] - a[0]) / width];
      if (inward[0] * (center[0] - midpoint[0]) + inward[1] * (center[2] - midpoint[2]) < 0) {
        inward[0] *= -1;
        inward[1] *= -1;
      }
      const end: End = { center: midpoint, corners: [a, b], inward, width, colorVertex: first[0], quad };
      ends.push(end);
      const key = `${pair[0].color}:${midpoint.map((value) => Math.floor(value / CELL_SIZE)).join(",")}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(end);
      buckets.set(key, bucket);
    }
    quad++;
  }

  const additions: { points: [Point, Point, Point]; colorVertex: number }[] = [];
  for (const end of ends) {
    const matches: End[] = [];
    const cell = end.center.map((value) => Math.floor(value / CELL_SIZE));
    const shade = colorKey(end.colorVertex);
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      for (const candidate of buckets.get(`${shade}:${cell[0] + x},${cell[1] + y},${cell[2] + z}`) ?? []) {
        if (candidate.quad === end.quad || Math.abs(candidate.width - end.width) > TOLERANCE
          || candidate.center.some((value, axis) => Math.abs(value - end.center[axis]) > TOLERANCE)) continue;
        matches.push(candidate);
      }
    }
    // Leave multiway junctions, unmatched road terminals, and stacked levels intact.
    if (matches.length !== 1 || matches[0].quad < end.quad) continue;
    const other = matches[0];
    const cross = end.inward[0] * other.inward[1] - end.inward[1] * other.inward[0];
    if (Math.abs(cross) < 0.0001) continue;
    const outerCorner = (edge: End, neighbor: End) => edge.corners.reduce((a, b) => {
      const side = (point: Point) => (point[0] - edge.center[0]) * neighbor.inward[0]
        + (point[2] - edge.center[2]) * neighbor.inward[1];
      return side(a) < side(b) ? a : b;
    });
    const center: Point = [0, 1, 2].map((axis) => (end.center[axis] + other.center[axis]) / 2) as Point;
    let a = outerCorner(end, other), b = outerCorner(other, end);
    // Upward winding. The cap adds only the missing exterior wedge, never a
    // full disc over the road or an unbounded miter beyond the cream shoulder.
    if ((a[2] - center[2]) * (b[0] - center[0]) - (a[0] - center[0]) * (b[2] - center[2]) < 0) [a, b] = [b, a];
    additions.push({ points: [center, a, b], colorVertex: end.colorVertex });
  }
  if (!additions.length) return source;

  const result = new THREE.BufferGeometry();
  const addedVertices = additions.length * 3;
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const original = attribute;
    const ArrayType = original.array.constructor as new (length: number) => typeof original.array;
    const array = new ArrayType((original.count + addedVertices) * original.itemSize);
    if ("isInterleavedBufferAttribute" in original) {
      for (let i = 0; i < original.count; i++) for (let component = 0; component < original.itemSize; component++) {
        array[i * original.itemSize + component] = original.array[i * original.data.stride + original.offset + component];
      }
    } else array.set(original.array);
    const merged = new THREE.BufferAttribute(array, original.itemSize, original.normalized);
    additions.forEach((addition, i) => addition.points.forEach((point, j) => {
      const id = position.count + i * 3 + j;
      if (name === "position") merged.setXYZ(id, ...point);
      if (name === "normal") merged.setXYZ(id, 0, 1, 0);
      if (name === "color") merged.setXYZ(id, color.getX(addition.colorVertex), color.getY(addition.colorVertex), color.getZ(addition.colorVertex));
    }));
    result.setAttribute(name, merged);
  }
  const indices = new Uint32Array(indexCount + addedVertices);
  for (let i = 0; i < indexCount; i++) indices[i] = source.index?.getX(i) ?? i;
  for (let i = 0; i < addedVertices; i++) indices[indexCount + i] = position.count + i;
  result.setIndex(new THREE.BufferAttribute(indices, 1));
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}
