import type { TerrainType } from './world';

export interface MapBuilderTile {
  index: number;
  q: number;
  r: number;
  terrain: TerrainType;
  productivityOverride: number | null;
}

export interface MapBuilderState {
  tiles: MapBuilderTile[];
  width: number;
  height: number;
  brushSize: number;            // 0–8; 0 = single hex, 1–8 = radius in hex-hops
  selectedBiome: TerrainType;
  randomEnabled: boolean;
  randomIntensity: number;      // 0.0–1.0 probability of using the random pool instead of the selected biome
  randomBiomePool: TerrainType[];
  name: string;
  isDirty: boolean;
}

export interface SavedCustomMap {
  version: 1;
  name: string;
  savedAt: string;
  width: number;
  height: number;
  tiles: Array<{
    index: number;
    terrain: TerrainType;
    productivityOverride: number | null;
  }>;
}
