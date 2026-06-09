export interface StateData {
  id: number;
  name: string;
  color: string;
  capital: number;
  continent: number | null;
  tileIndices: Set<number>;
  size: number;
  power: number;
}

export interface ConflictResult {
  attackerStateId: number;
  defenderStateId: number;
  attackerTileIndex: number;
  targetTileIndex: number;
  isSeaCrossing: boolean;
  outcome: 'attacker_wins' | 'defender_wins' | 'stalemate';
}

export interface SecessionEvent {
  parentStateId: number;
  newStateId: number;
  tileIndex: number;
}

export interface SimStats {
  turn: number;
  year: number;
  stateCount: number;
  largestStateSize: number;
  largestStateShare: number;
  avgStateSize: number;
  hhi: number;
  conflictsThisTurn: number;
  conquestsThisTurn: number;
  secessionsThisTurn: number;
  totalLandTiles: number;
  continentUnificationScores: number[];
}

export interface SimState {
  ownership: Int32Array;
  states: Map<number, StateData>;
  stats: SimStats;
  turn: number;
}
