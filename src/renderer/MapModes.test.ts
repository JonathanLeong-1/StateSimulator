import { describe, it, expect } from 'vitest';
import { getTileColor } from './MapModes';
import type { HexTile } from '../types/world';

function makeTile(overrides: Partial<HexTile> = {}): HexTile {
  return {
    index: 0,
    q: 0,
    r: 0,
    terrain: 'plains',
    productivity: 0.5,
    obstacle: 0.5,
    isCoastal: false,
    continent: 0,
    allNeighborIndices: [],
    landNeighborIndices: [],
    coastalReachIndices: [],
    ...overrides,
  };
}

describe('getTileColor', () => {
  describe('ocean tiles', () => {
    it('should return ocean color regardless of map mode', () => {
      const ocean = makeTile({ terrain: 'ocean' });
      expect(getTileColor(ocean, 'political', '#ff0000')).toBe('#1a3a5c');
      expect(getTileColor(ocean, 'terrain', null)).toBe('#1a3a5c');
      expect(getTileColor(ocean, 'productivity', null)).toBe('#1a3a5c');
      expect(getTileColor(ocean, 'obstacle', null)).toBe('#1a3a5c');
    });
  });

  describe('terrain mode', () => {
    it('should return plains color for plains terrain', () => {
      const tile = makeTile({ terrain: 'plains' });
      expect(getTileColor(tile, 'terrain', null)).toBe('#8fa85a');
    });

    it('should return correct color for each terrain type', () => {
      const cases: [HexTile['terrain'], string][] = [
        ['plains', '#8fa85a'],
        ['river_valley', '#6db56d'],
        ['forest', '#4a7c45'],
        ['hills', '#9a8c6e'],
        ['mountains', '#888888'],
        ['desert', '#d4b483'],
        ['tundra', '#c8d4e0'],
      ];
      for (const [terrain, expected] of cases) {
        const tile = makeTile({ terrain });
        expect(getTileColor(tile, 'terrain', null)).toBe(expected);
      }
    });
  });

  describe('political mode', () => {
    it('should return terrain color when stateColor is null', () => {
      const tile = makeTile({ terrain: 'plains' });
      expect(getTileColor(tile, 'political', null)).toBe('#8fa85a');
    });

    it('should return terrain color even with a stateColor (overlay is drawn separately)', () => {
      const tile = makeTile({ terrain: 'plains' });
      const stateColor = '#ff0000';
      const result = getTileColor(tile, 'political', stateColor);
      expect(result).toBe('#8fa85a');   // terrain color; political overlay is a separate pass
    });
  });

  describe('productivity mode', () => {
    it('should return near dark color for productivity=0', () => {
      const tile = makeTile({ terrain: 'plains', productivity: 0 });
      expect(getTileColor(tile, 'productivity', null)).toBe('#1a2a1a');
    });

    it('should return near bright green for productivity=1', () => {
      const tile = makeTile({ terrain: 'plains', productivity: 1 });
      expect(getTileColor(tile, 'productivity', null)).toBe('#00ff88');
    });

    it('should return an intermediate color for productivity=0.5', () => {
      const tile = makeTile({ terrain: 'plains', productivity: 0.5 });
      const result = getTileColor(tile, 'productivity', null);
      expect(result).not.toBe('#1a2a1a');
      expect(result).not.toBe('#00ff88');
    });
  });

  describe('obstacle mode', () => {
    it('should return near dark color for obstacle=0', () => {
      const tile = makeTile({ terrain: 'plains', obstacle: 0 });
      expect(getTileColor(tile, 'obstacle', null)).toBe('#1a1a2a');
    });

    it('should return near bright red for obstacle=1', () => {
      const tile = makeTile({ terrain: 'plains', obstacle: 1 });
      expect(getTileColor(tile, 'obstacle', null)).toBe('#ff4444');
    });

    it('should return an intermediate color for obstacle=0.5', () => {
      const tile = makeTile({ terrain: 'plains', obstacle: 0.5 });
      const result = getTileColor(tile, 'obstacle', null);
      expect(result).not.toBe('#1a1a2a');
      expect(result).not.toBe('#ff4444');
    });
  });
});
