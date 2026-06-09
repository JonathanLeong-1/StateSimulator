import { describe, it, expect } from 'vitest';
import {
  tileIndex,
  getOffsetNeighbors,
  hexDistance,
  bfsConnectedComponents,
  bfsReachableCoastal,
} from './hexUtils';
import type { HexTile } from '../types/world';

describe('tileIndex', () => {
  it('should return 0 when q=0 and r=0', () => {
    expect(tileIndex(0, 0, 10)).toBe(0);
  });

  it('should return 1 when q=1 and r=0', () => {
    expect(tileIndex(1, 0, 10)).toBe(1);
  });

  it('should return width when q=0 and r=1', () => {
    expect(tileIndex(0, 1, 10)).toBe(10);
  });

  it('should return correct index for arbitrary (q, r)', () => {
    expect(tileIndex(3, 2, 10)).toBe(23);
  });
});

describe('getOffsetNeighbors', () => {
  it('should return exactly 6 neighbors', () => {
    expect(getOffsetNeighbors(0, 0)).toHaveLength(6);
  });

  it('should return correct even-q offset neighbors for (0,0)', () => {
    const neighbors = getOffsetNeighbors(0, 0);
    expect(neighbors).toContainEqual([1, 0]);
    expect(neighbors).toContainEqual([1, -1]);
    expect(neighbors).toContainEqual([0, -1]);
    expect(neighbors).toContainEqual([-1, -1]);
    expect(neighbors).toContainEqual([-1, 0]);
    expect(neighbors).toContainEqual([0, 1]);
  });

  it('should return correct even-q offset neighbors for (1,0)', () => {
    const neighbors = getOffsetNeighbors(1, 0);
    expect(neighbors).toContainEqual([2, 1]);
    expect(neighbors).toContainEqual([2, 0]);
    expect(neighbors).toContainEqual([1, -1]);
    expect(neighbors).toContainEqual([0, 0]);
    expect(neighbors).toContainEqual([0, 1]);
    expect(neighbors).toContainEqual([1, 1]);
  });
});

describe('hexDistance', () => {
  it('should return 0 when both tiles are the same', () => {
    expect(hexDistance(0, 0, 0, 0)).toBe(0);
  });

  it('should return 1 for adjacent tile (1, 0)', () => {
    expect(hexDistance(0, 0, 1, 0)).toBe(1);
  });

  it('should return 1 for adjacent tile (0, 1)', () => {
    expect(hexDistance(0, 0, 0, 1)).toBe(1);
  });

  it('should be symmetric', () => {
    expect(hexDistance(2, 3, 5, 1)).toBe(hexDistance(5, 1, 2, 3));
  });

  it('should return 2 for tiles two hops away (2, -1)', () => {
    expect(hexDistance(0, 0, 2, -1)).toBe(2);
  });

  it('should return 3 for tiles three hops away (3, 0)', () => {
    expect(hexDistance(0, 0, 3, 0)).toBe(3);
  });

  it('hexDistance(0,0, 1,0) === 1', () => expect(hexDistance(0, 0, 1, 0)).toBe(1));
  it('hexDistance(0,0, 2,0) === 2', () => expect(hexDistance(0, 0, 2, 0)).toBe(2));
  it('hexDistance(0,0, 0,1) === 1', () => expect(hexDistance(0, 0, 0, 1)).toBe(1));
});

describe('bfsConnectedComponents', () => {
  // Simple linear graph: 0-1-2-3
  const linearNeighbors = (i: number): number[] => {
    const n: number[] = [];
    if (i > 0) n.push(i - 1);
    if (i < 3) n.push(i + 1);
    return n;
  };

  it('should return single component when all tiles are connected', () => {
    const comps = bfsConnectedComponents([0, 1, 2, 3], linearNeighbors);
    expect(comps).toHaveLength(1);
    expect(comps[0].sort()).toEqual([0, 1, 2, 3]);
  });

  it('should return two components when set is disconnected', () => {
    // Only indices 0, 1 and 3 — 2 is missing so 3 is isolated
    const comps = bfsConnectedComponents([0, 1, 3], linearNeighbors);
    expect(comps).toHaveLength(2);
    const sorted = comps.map(c => c.sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);
    expect(sorted[0]).toEqual([0, 1]);
    expect(sorted[1]).toEqual([3]);
  });

  it('should handle a single tile input', () => {
    const comps = bfsConnectedComponents([5], (_i) => []);
    expect(comps).toHaveLength(1);
    expect(comps[0]).toEqual([5]);
  });

  it('should return empty array when input is empty', () => {
    const comps = bfsConnectedComponents([], (_i) => []);
    expect(comps).toHaveLength(0);
  });
});

describe('bfsReachableCoastal', () => {
  // Small 4x1 world: index 0=coastal plains, 1=ocean, 2=ocean, 3=coastal plains
  const width = 4;

  const makeTile = (index: number, terrain: 'ocean' | 'plains', isCoastal: boolean): HexTile => ({
    index,
    q: index,
    r: 0,
    terrain,
    productivity: terrain === 'ocean' ? 0 : 0.7,
    obstacle: terrain === 'ocean' ? 1 : 0.1,
    isCoastal,
    continent: terrain === 'ocean' ? null : 0,
    allNeighborIndices: [],
    landNeighborIndices: [],
    coastalReachIndices: [],
  });

  const tiles: HexTile[] = [
    makeTile(0, 'plains', true),
    makeTile(1, 'ocean', false),
    makeTile(2, 'ocean', false),
    makeTile(3, 'plains', true),
  ];

  it('should find coastal land tiles reachable through ocean within radius', () => {
    const result = bfsReachableCoastal(0, tiles, width, 3);
    expect(result).toContain(3);
    expect(result).not.toContain(0); // startIndex excluded
  });

  it('should return empty array when radius is 0', () => {
    const result = bfsReachableCoastal(0, tiles, width, 0);
    expect(result).toHaveLength(0);
  });
});
