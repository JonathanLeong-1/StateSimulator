import type { TerrainType } from './world';

export type MapBuilderTool =
  | 'paint-land'
  | 'paint-ocean'
  | 'paint-biome'
  | 'paint-productivity';

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
  tool: MapBuilderTool;
  brushSize: number;            // 0–8; 0 = single hex, 1–8 = radius in hex-hops
  selectedBiome: TerrainType;   // excludes 'ocean'
  productivityValue: number;    // 0.0–1.0
  randomEnabled: boolean;
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
