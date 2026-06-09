import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MapBuilderRenderer } from './MapBuilderRenderer';
import type { MapBuilderTile } from '../../types/mapbuilder';

function makeMockCanvas(w = 800, h = 600): HTMLCanvasElement {
  const ctx = {
    clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    setLineDash: vi.fn(), save: vi.fn(), restore: vi.fn(),
    fillStyle: '', strokeStyle: '', lineWidth: 0,
  };
  return {
    width: w, height: h,
    offsetWidth: w, offsetHeight: h,
    getContext: vi.fn(() => ctx),
  } as unknown as HTMLCanvasElement;
}

function makeGrid(w: number, h: number): MapBuilderTile[] {
  const tiles: MapBuilderTile[] = [];
  for (let i = 0; i < w * h; i++) {
    tiles.push({ index: i, q: i % w, r: Math.floor(i / w), terrain: 'ocean', productivityOverride: null });
  }
  return tiles;
}

describe('MapBuilderRenderer', () => {
  let renderer: MapBuilderRenderer;
  let tiles: MapBuilderTile[];

  beforeEach(() => {
    const canvas = makeMockCanvas();
    tiles = makeGrid(10, 10);
    renderer = new MapBuilderRenderer(canvas, 10, 10);
    renderer.setTiles(tiles);
  });

  describe('getBrushTileIndices', () => {
    it('brushSize=0 returns only center tile', () => {
      const result = renderer.getBrushTileIndices(0, 0);
      expect(result.size).toBe(1);
      expect(result.has(0)).toBe(true);
    });

    it('brushSize=1 returns center + up to 6 neighbors', () => {
      const centerIdx = 55; // interior tile
      const result = renderer.getBrushTileIndices(centerIdx, 1);
      expect(result.size).toBeGreaterThan(1);
      expect(result.size).toBeLessThanOrEqual(7);
      expect(result.has(centerIdx)).toBe(true);
    });
  });

  describe('getTileAtPixel', () => {
    it('returns null for far out-of-bounds coordinates', () => {
      const result = renderer.getTileAtPixel(-9999, -9999);
      expect(result).toBeNull();
    });
  });
});
