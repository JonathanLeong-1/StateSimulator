import { mulberry32 } from './rng';
import { bfsConnectedComponents, hexDistance } from './hexUtils';
import { StateManager } from './StateManager';
import type { WorldData } from '../types/world';
import type { SimState, ConflictResult, SecessionEvent } from '../types/simulation';
import type { SimSettings } from '../types/ui';

export class SimulationEngine {
  private world: WorldData;
  private settings: SimSettings;
  private stateManager: StateManager;
  private simState!: SimState;
  private rng: () => number;
  private lastSeaCrossings: Array<{ from: number; to: number; succeeded: boolean; attackerStateId: number }> = [];

  /**
   * Constructs the engine, binding it to a generated world and user-facing settings.
   *
   * The engine maintains its own RNG stream seeded from the world's total tile
   * count, keeping the simulation deterministic and independent of the world
   * generation seed.
   *
   * @param world    - The fully-generated `WorldData` produced by `WorldGenerator`.
   * @param settings - Runtime simulation parameters (conflict rates, secession, etc.).
   */
  constructor(world: WorldData, settings: SimSettings, simSeed?: number) {
    this.world = world;
    this.settings = settings;
    const seed = simSeed !== undefined
      ? simSeed
      : (Date.now() ^ (Math.random() * 0xffffffff | 0)) >>> 0;
    this.stateManager = new StateManager(seed);
    this.rng = mulberry32(seed);
  }

  /**
   * Bootstraps the simulation by seeding one independent micro-state (city-state)
   * on every non-ocean tile.
   *
   * Each land tile becomes the capital of its own freshly-allocated state, giving
   * turn 0 a maximally fragmented starting condition.  The `StateManager` is
   * informed of the world's per-continent land-tile counts so that subsequent
   * `computeStats` calls can report continent unification scores correctly.
   *
   * Must be called exactly once before any calls to `step()`.
   */
  initialize(): void {
    const { world, stateManager, rng } = this;
    const ownership = new Int32Array(world.tiles.length).fill(-1);
    const states = new Map<number, import('../types/simulation').StateData>();

    this.simState = {
      ownership,
      states,
      stats: {
        turn: 0, year: 0, stateCount: 0, largestStateSize: 0,
        largestStateShare: 0, avgStateSize: 0, hhi: 0,
        conflictsThisTurn: 0, conquestsThisTurn: 0, secessionsThisTurn: 0,
        totalLandTiles: world.totalLandTiles,
        continentUnificationScores: [],
      },
      turn: 0,
    };

    for (let i = 0; i < world.tiles.length; i++) {
      const tile = world.tiles[i];
      if (tile.terrain === 'ocean') continue;
      const state = stateManager.allocateState(i, tile.continent, rng);
      ownership[i] = state.id;
      state.tileIndices.add(i);
      state.size = 1;
      state.power = tile.productivity;
      states.set(state.id, state);
    }

    stateManager.setContinentLandCounts(world.continentLandCounts);
    const stats = stateManager.computeStats(this.simState, world.totalLandTiles);
    stats.conflictsThisTurn = 0;
    stats.conquestsThisTurn = 0;
    stats.secessionsThisTurn = 0;
    this.simState.stats = stats;
  }

  /**
   * Advances the simulation by one turn, executing all eight ordered sub-steps.
   *
   * **Turn order (Steps 1–8)**:
   *  1. **Snapshot powers** — capture each state's `power` before any tile changes
   *     so that all conflict resolutions use pre-turn power values.
   *  2. **Generate conflict proposals** — for every land tile, check border
   *     neighbors (and optional sea-crossing targets) and probabilistically queue
   *     an attack based on `baseConflictRate × productivity × productivityInfluence`.
   *  3. **Resolve conflicts** — adjudicate each queued attack:
   *     geography/stalemate check first, then a power-weighted coin-flip; winning
   *     attackers immediately take ownership of the defender's tile.
   *  4. **Apply secessions** — border tiles of large states can break away,
   *     weighted by obstacle, border-pressure ratio, and distance from capital.
   *  5. **Split disconnected states** — after conquest/secession, states that have
   *     become geographically fragmented are divided into independent successor
   *     states (largest fragment retains the original ID).
   *  6. **Rebuild tile-index sets and state metadata** — recompute `tileIndices`,
   *     `size`, `power`, and capital location from the authoritative `ownership`
   *     array; release states that have dropped to zero tiles.
   *  7. **Compute and store stats** — generate a new `SimStats` snapshot
   *     (HHI, state count, continent scores, etc.) and attach per-turn event
   *     counters for conflicts, conquests, and secessions.
   *  8. **Increment turn counter** — advance `simState.turn` by 1.
   */
  step(): void {
    const { simState, world, settings, stateManager, rng } = this;
    this.lastSeaCrossings = [];

    // Step 1: Snapshot powers before any changes
    const powerSnapshot = new Map<number, number>();
    for (const [id, state] of simState.states) {
      powerSnapshot.set(id, state.power);
    }

    // Step 2: Generate conflict proposals
    const conflicts: ConflictResult[] = [];
    for (let i = 0; i < world.tiles.length; i++) {
      const tile = world.tiles[i];
      if (tile.terrain === 'ocean') continue;
      const attackerStateId = simState.ownership[i];
      if (attackerStateId === -1) continue;

      const targets: { index: number; isSeaCrossing: boolean }[] = [];

      for (const ni of tile.landNeighborIndices) {
        const defId = simState.ownership[ni];
        if (defId !== -1 && defId !== attackerStateId) {
          targets.push({ index: ni, isSeaCrossing: false });
        }
      }

      if (settings.enableSeaConquest && tile.isCoastal) {
        for (const ni of tile.coastalReachIndices) {
          const defId = simState.ownership[ni];
          if (defId !== -1 && defId !== attackerStateId) {
            targets.push({ index: ni, isSeaCrossing: true });
          }
        }
      }

      if (targets.length === 0) continue;

      const conflictChance = settings.baseConflictRate * tile.productivity * settings.productivityInfluence;
      if (rng() >= conflictChance) continue;

      const target = targets[Math.floor(rng() * targets.length)];
      const defenderStateId = simState.ownership[target.index];

      if (target.isSeaCrossing && rng() >= settings.seaConquestChance) continue;

      conflicts.push({
        attackerStateId,
        defenderStateId,
        attackerTileIndex: i,
        targetTileIndex: target.index,
        isSeaCrossing: target.isSeaCrossing,
        outcome: 'stalemate',
      });
    }

    // Step 3: Resolve conflicts
    let conquests = 0;
    for (const conflict of conflicts) {
      const attackerTile = world.tiles[conflict.attackerTileIndex];
      const defenderTile = world.tiles[conflict.targetTileIndex];
      const attackerPower = powerSnapshot.get(conflict.attackerStateId) ?? 0;
      const defenderPower = powerSnapshot.get(conflict.defenderStateId) ?? 0;

      const obstacle = (attackerTile.obstacle + defenderTile.obstacle) / 2
        + (conflict.isSeaCrossing ? 0.3 : 0);

      const stalemateChance = Math.min(obstacle * settings.geographyDifficulty, 0.75);
      if (rng() < stalemateChance) {
        conflict.outcome = 'stalemate';
        continue;
      }

      const denom = attackerPower + defenderPower
        + obstacle * settings.geographyDifficulty * defenderPower * 0.5;
      const attackerWinChance = denom > 0 ? attackerPower / denom : 0.5;

      if (rng() < attackerWinChance) {
        conflict.outcome = 'attacker_wins';
        simState.ownership[conflict.targetTileIndex] = conflict.attackerStateId;
        conquests++;
      } else {
        conflict.outcome = 'defender_wins';
      }
    }

    // Track sea crossings for animation
    for (const conflict of conflicts) {
      if (conflict.isSeaCrossing) {
        this.lastSeaCrossings.push({
          from: conflict.attackerTileIndex,
          to: conflict.targetTileIndex,
          succeeded: conflict.outcome === 'attacker_wins',
          attackerStateId: conflict.attackerStateId,
        });
      }
    }

    // Step 4: Apply secessions
    const secessions: SecessionEvent[] = [];
    if (settings.enableSecession) {
      for (const [stateId, state] of simState.states) {
        if (state.size <= 1) continue;

        const borderTiles: number[] = [];
        for (const ti of state.tileIndices) {
          const tile = world.tiles[ti];
          const isBorder = tile.allNeighborIndices.some(ni => {
            const nid = simState.ownership[ni];
            return nid !== stateId;
          });
          if (isBorder) borderTiles.push(ti);
        }

        const borderPressure = borderTiles.length / Math.max(1, state.size);

        for (const ti of borderTiles) {
          const tile = world.tiles[ti];
          const capital = state.capital;
          const capTile = world.tiles[capital];

          let distanceFactor = 1.0;
          if (settings.enableCapitalDistanceUnrest) {
            distanceFactor = Math.min(
              Math.max(hexDistance(tile.q, tile.r, capTile.q, capTile.r) / 15, 1.0),
              2.0,
            );
          }

          const chance = Math.min(
            settings.secessionRate * tile.obstacle * borderPressure * distanceFactor,
            0.05,
          );
          if (rng() < chance) {
            const newState = stateManager.allocateState(ti, tile.continent, rng);
            simState.states.set(newState.id, newState);
            simState.ownership[ti] = newState.id;
            newState.tileIndices.add(ti);
            newState.size = 1;
            newState.power = tile.productivity;

            secessions.push({
              parentStateId: stateId,
              newStateId: newState.id,
              tileIndex: ti,
            });
          }
        }
      }
    }

    // Step 5: Split disconnected states
    if (settings.enableDisconnectedSplit) {
      const stateIds = [...simState.states.keys()];
      for (const stateId of stateIds) {
        const state = simState.states.get(stateId);
        if (!state || state.size <= 1) continue;

        const components = bfsConnectedComponents(
          [...state.tileIndices],
          (idx) => world.tiles[idx].landNeighborIndices.filter(
            ni => simState.ownership[ni] === stateId,
          ),
        );

        if (components.length <= 1) continue;

        // Sort descending by size; keep largest for original state
        components.sort((a, b) => b.length - a.length);

        for (let ci = 1; ci < components.length; ci++) {
          const comp = components[ci];
          const newState = stateManager.allocateState(
            comp[0],
            world.tiles[comp[0]].continent,
            rng,
          );
          simState.states.set(newState.id, newState);
          for (const ti of comp) {
            simState.ownership[ti] = newState.id;
            newState.tileIndices.add(ti);
          }
          newState.size = comp.length;
          newState.power = comp.reduce((s, ti) => s + world.tiles[ti].productivity, 0);
        }
      }
    }

    // Step 6: Rebuild tileIndices from ownership, then update state metadata
    for (const state of simState.states.values()) {
      state.tileIndices.clear();
    }
    for (let i = 0; i < world.tiles.length; i++) {
      const id = simState.ownership[i];
      if (id === -1) continue;
      const state = simState.states.get(id);
      if (state) state.tileIndices.add(i);
    }
    for (const [id, state] of simState.states) {
      state.size = state.tileIndices.size;
      if (state.size === 0) {
        stateManager.releaseState(id);
        simState.states.delete(id);
        continue;
      }
      state.power = [...state.tileIndices].reduce(
        (sum, ti) => sum + world.tiles[ti].productivity, 0,
      );
      // Update capital if the original was lost
      if (simState.ownership[state.capital] !== id) {
        let bestTile = -1;
        let bestProd = -1;
        for (const ti of state.tileIndices) {
          if (world.tiles[ti].productivity > bestProd) {
            bestProd = world.tiles[ti].productivity;
            bestTile = ti;
          }
        }
        if (bestTile !== -1) state.capital = bestTile;
      }
    }

    // Step 7: Compute stats and apply turn counters
    const stats = stateManager.computeStats(simState, world.totalLandTiles);
    stats.conflictsThisTurn = conflicts.length;
    stats.conquestsThisTurn = conquests;
    stats.secessionsThisTurn = secessions.length;
    simState.stats = stats;

    // Step 8: Increment turn
    simState.turn++;
  }

  /**
   * Returns the current `SimState` by reference.
   *
   * The returned object is the engine's live internal state — callers should
   * treat it as read-only and not mutate it directly.
   *
   * @returns The current `SimState` including ownership, state map, stats, and turn.
   */
  getState(): SimState {
    return this.simState;
  }

  getLastSeaCrossings(): ReadonlyArray<{ from: number; to: number; succeeded: boolean; attackerStateId: number }> {
    return this.lastSeaCrossings;
  }

  /**
   * Serializes the full simulation state to a JSON string.
   *
   * `Int32Array` and `Set<number>` are converted to plain arrays so that the
   * result is a valid JSON value.  The snapshot can be restored with
   * {@link deserialize}.
   *
   * @returns A JSON string representing `ownership`, `states`, `stats`, and `turn`.
   */
  serialize(): string {
    const obj = {
      ownership: Array.from(this.simState.ownership),
      states: [...this.simState.states.entries()].map(([id, s]) => [
        id,
        { ...s, tileIndices: [...s.tileIndices] },
      ]),
      stats: this.simState.stats,
      turn: this.simState.turn,
    };
    return JSON.stringify(obj);
  }

  /**
   * Restores the simulation state from a JSON string previously produced by
   * {@link serialize}.
   *
   * Plain arrays in the JSON payload are converted back to the typed structures
   * the engine operates on (`Int32Array` for `ownership`, `Set<number>` for each
   * state's `tileIndices`).
   *
   * @param json - A JSON string in the format produced by `serialize()`.
   */
  deserialize(json: string): void {
    const obj = JSON.parse(json) as {
      ownership: number[];
      states: [number, Record<string, unknown> & { tileIndices: number[] }][];
      stats: import('../types/simulation').SimStats;
      turn: number;
    };
    this.simState.ownership = new Int32Array(obj.ownership);
    this.simState.states = new Map(
      obj.states.map(([id, s]) => [
        id,
        { ...s, tileIndices: new Set<number>(s.tileIndices) },
      ]) as [number, import('../types/simulation').StateData][],
    );
    this.simState.stats = obj.stats;
    this.simState.turn = obj.turn;
  }
}
