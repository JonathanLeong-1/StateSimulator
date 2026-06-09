import type { HexTile, TerrainType } from '../types/world';
import type { MapMode } from '../types/ui';

export const TERRAIN_COLORS: Record<TerrainType, string> = {
  ocean: '#1a3a5c',
  plains: '#8fa85a',
  river_valley: '#6db56d',
  forest: '#4a7c45',
  hills: '#9a8c6e',
  mountains: '#888888',
  desert: '#d4b483',
  tundra: '#c8d4e0',
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

function heatmapColor(value: number, low: string, high: string): string {
  return lerpColor(low, high, Math.max(0, Math.min(1, value)));
}

export function getTileColor(
  tile: HexTile,
  mode: MapMode,
  _stateColor: string | null,
): string {
  let color: string;

  if (tile.terrain === 'ocean') {
    color = '#1a3a5c';
  } else {
    const terrainColor = TERRAIN_COLORS[tile.terrain];
    switch (mode) {
      case 'political':
        color = terrainColor;
        break;
      case 'terrain':
        color = terrainColor;
        break;
      case 'productivity':
        color = heatmapColor(tile.productivity, '#1a2a1a', '#00ff88');
        break;
      case 'obstacle':
        color = heatmapColor(tile.obstacle, '#1a1a2a', '#ff4444');
        break;
      default:
        color = terrainColor;
    }
  }

  return color;
}
