import type { HexTile } from '../types/world';

/**
 * Convert (q, r) axial coordinates to a flat tile index.
 * Flat-top hexagon layout.
 */
export function tileIndex(q: number, r: number, width: number): number {
  return r * width + q;
}

/**
 * Return the even-q offset coordinates of all 6 neighbors of (q, r).
 * Even-q offset hexagon layout (flat-top, even columns not shifted).
 */
export function getOffsetNeighbors(q: number, r: number): [number, number][] {
  if (q % 2 === 0) {
    return [
      [q + 1, r],
      [q + 1, r - 1],
      [q,     r - 1],
      [q - 1, r - 1],
      [q - 1, r],
      [q,     r + 1],
    ];
  } else {
    return [
      [q + 1, r + 1],
      [q + 1, r],
      [q,     r - 1],
      [q - 1, r],
      [q - 1, r + 1],
      [q,     r + 1],
    ];
  }
}

/**
 * Cube-coordinate distance between two even-q offset hex tiles.
 */
export function hexDistance(
  q1: number,
  r1: number,
  q2: number,
  r2: number,
): number {
  function toCube(q: number, r: number): [number, number, number] {
    const x = q;
    const z = r - (q - (q & 1)) / 2;
    return [x, -x - z, z];
  }
  const [x1, y1, z1] = toCube(q1, r1);
  const [x2, y2, z2] = toCube(q2, r2);
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

/**
 * BFS flood-fill to find connected components.
 * @param indices - set of tile indices in this state
 * @param getNeighbors - function that returns neighbor indices for a given tile index
 * @returns array of connected components (each is an array of tile indices)
 */
export function bfsConnectedComponents(
  indices: number[],
  getNeighbors: (idx: number) => number[],
): number[][] {
  const indexSet = new Set(indices);
  const visited = new Set<number>();
  const components: number[][] = [];

  for (const start of indices) {
    if (visited.has(start)) continue;
    const component: number[] = [];
    const queue: number[] = [start];
    visited.add(start);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of getNeighbors(current)) {
        if (indexSet.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  return components;
}

/**
 * BFS from a coastal land tile through ocean to find other coastal LAND tiles within maxRadius hops.
 * @param startIndex - index of a coastal land tile
 * @param tiles - all world tiles
 * @param maxRadius - maximum BFS hops (through ocean)
 * @returns array of land tile indices reachable via ocean within maxRadius hops (excluding startIndex)
 */
export function bfsReachableCoastal(
  startIndex: number,
  tiles: HexTile[],
  width: number,
  maxRadius: number,
): number[] {
  const result: number[] = [];
  const visited = new Set<number>([startIndex]);
  // Queue entries: [tileIndex, hopsFromStart]
  const queue: [number, number][] = [[startIndex, 0]];

  while (queue.length > 0) {
    const [current, hops] = queue.shift()!;
    if (hops >= maxRadius) continue;

    const currentTile = tiles[current];
    const neighbors = getOffsetNeighbors(currentTile.q, currentTile.r);

    for (const [nq, nr] of neighbors) {
      if (nq < 0 || nr < 0 || nq >= width || nr >= Math.ceil(tiles.length / width)) continue;
      const ni = tileIndex(nq, nr, width);
      if (ni < 0 || ni >= tiles.length) continue;
      if (visited.has(ni)) continue;
      visited.add(ni);
      const neighborTile = tiles[ni];
      if (neighborTile.terrain === 'ocean') {
        queue.push([ni, hops + 1]);
      } else if (neighborTile.isCoastal) {
        result.push(ni);
      }
    }
  }

  return result;
}
