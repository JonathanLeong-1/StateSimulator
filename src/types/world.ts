export type TerrainType =
  | 'ocean'
  | 'plains'
  | 'river_valley'
  | 'forest'
  | 'hills'
  | 'mountains'
  | 'desert'
  | 'tundra';

export interface HexTile {
  index: number;
  q: number;
  r: number;
  terrain: TerrainType;
  productivity: number;
  obstacle: number;
  isCoastal: boolean;
  continent: number | null;
  allNeighborIndices: number[];
  landNeighborIndices: number[];
  coastalReachIndices: number[];
}

export interface WorldConfig {
  width: number;
  height: number;
  seed: number;
  seaConquestRadius: number;
}

export interface WorldData {
  tiles: HexTile[];
  width: number;
  height: number;
  totalLandTiles: number;
  continentLandCounts: number[];
}
