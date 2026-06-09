export type MapMode = 'political' | 'terrain' | 'productivity' | 'obstacle';

export interface SimSettings {
  baseConflictRate: number;
  seaConquestChance: number;
  secessionRate: number;
  geographyDifficulty: number;
  productivityInfluence: number;
  enableSeaConquest: boolean;
  enableSecession: boolean;
  enableCapitalDistanceUnrest: boolean;
  enableDisconnectedSplit: boolean;
}

export interface ChartDataPoint {
  turn: number;
  stateCount: number;
  largestStateShare: number;
  hhi: number;
}

export interface UIState {
  mapMode: MapMode;
  hoveredTileIndex: number | null;
  selectedStateId: number | null;
  isPlaying: boolean;
  speed: number;
  settings: SimSettings;
  chartHistory: ChartDataPoint[];
  seed: string;
}
