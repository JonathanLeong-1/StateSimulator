import type { StateData, SimState, SimStats } from '../types/simulation';
import { mulberry32 } from './rng';

const SYLLABLES = [
  'Aur', 'Vel', 'Nor', 'Cal', 'Ser', 'Vey', 'Mor', 'Tal', 'Eld', 'Kor',
  'Fen', 'Dun', 'Sol', 'Mar', 'Bel', 'Ryn', 'Eth', 'Vor', 'Ast', 'Lyn',
  'Har', 'Zen', 'Ora', 'Pax', 'Qui', 'Rex', 'Syn', 'Thu', 'Uma', 'Var',
  'Wex', 'Xan', 'Yol', 'Zar', 'Aba', 'Bor', 'Cru', 'Del', 'Eru', 'Fal',
  'Gar', 'Hel', 'Ivy', 'Jar', 'Kel', 'Lum', 'Myn', 'Nex', 'Oph', 'Per',
  'Qui', 'Rot', 'Syl', 'Tor', 'Ulm', 'Vir', 'Wyn', 'Xer', 'Yal', 'Zon',
];

const COLOR_COUNT = 40;

export class StateManager {
  private nextId: number = 0;
  private states: Map<number, StateData> = new Map();
  private colorPool: number[] = Array.from({ length: COLOR_COUNT }, (_, i) => i);
  private colorInUse: Map<number, number> = new Map(); // stateId → colorIndex
  private continentLandCounts: number[] = [];

  constructor(colorSeed?: number) {
    if (colorSeed !== undefined) {
      const rng = mulberry32(colorSeed);
      for (let i = this.colorPool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [this.colorPool[i], this.colorPool[j]] = [this.colorPool[j], this.colorPool[i]];
      }
    }
  }

  /**
   * Converts a numeric color slot index (0–39) to an HSL CSS color string.
   * Distributes hues evenly across the full 360° spectrum at fixed saturation
   * and lightness so that every active state has a visually distinct color.
   *
   * @param colorIndex - A slot index in `[0, COLOR_COUNT)`.
   * @returns An HSL color string, e.g. `"hsl(180, 70%, 60%)"`.
   */
  private indexToColor(colorIndex: number): string {
    // Golden angle (137.508°) ensures any N sequentially allocated states have
    // maximally distinct hues — adjacent indices are never perceptually similar.
    const hue = Math.round((colorIndex * 137.508) % 360);
    return `hsl(${hue}, 45%, 55%)`;
  }

  /**
   * Creates a new `StateData` entry and registers it in the internal map.
   *
   * Picks the next available color from the pool (or cycles deterministically when
   * the pool is exhausted), generates a name via {@link generateName}, and assigns
   * a unique auto-incremented ID.
   *
   * @param capital   - Tile index of the state's initial capital.
   * @param continent - Continent ID the capital sits on, or `null` if undetermined.
   * @param rng       - Seeded random function forwarded to `generateName`.
   * @returns The newly allocated `StateData` object (also stored internally).
   */
  allocateState(capital: number, continent: number | null, rng: () => number): StateData {
    let colorIndex: number;
    if (this.colorPool.length > 0) {
      colorIndex = this.colorPool.shift()!;
    } else {
      // Cycle through colors when pool is exhausted
      colorIndex = this.nextId % COLOR_COUNT;
    }
    const color = this.indexToColor(colorIndex);
    const name = this.generateName(1, rng);
    const id = this.nextId++;
    this.colorInUse.set(id, colorIndex);
    const state: StateData = {
      id,
      name,
      color,
      capital,
      continent,
      tileIndices: new Set(),
      size: 0,
      power: 0,
    };
    this.states.set(id, state);
    return state;
  }

  /**
   * Removes a state from the registry and returns its color slot to the pool.
   *
   * The freed color is inserted at the front of `colorPool` (LRU strategy) so
   * the most recently released color is the first to be reused, reducing
   * long-lived color gaps on the map.
   *
   * @param id - The ID of the state to release.
   */
  releaseState(id: number): void {
    const colorIndex = this.colorInUse.get(id);
    if (colorIndex !== undefined) {
      this.colorPool.unshift(colorIndex); // LRU: most recently freed is next to reuse
      this.colorInUse.delete(id);
    }
    this.states.delete(id);
  }

  /**
   * Generates a fantasy-style state name that scales with territorial size.
   *
   * Two syllables are drawn at random from `SYLLABLES` and concatenated to form
   * a base name.  A size-appropriate title template (e.g. "Kingdom of X" for
   * medium states, "X Empire" for large ones) is then chosen at random and the
   * placeholder `X` is replaced with the base name.
   *
   * Consumes exactly **3 RNG calls**: two for syllable selection, one for the
   * template selection.
   *
   * @param size - Approximate number of tiles the state currently controls,
   *               used to select a matching tier of name templates.
   * @param rng  - Seeded random function; must produce values in `[0, 1)`.
   * @returns A generated state name string (e.g. `"Kingdom of AurVel"`).
   */
  generateName(size: number, rng: () => number): string {
    const syl1 = SYLLABLES[Math.floor(rng() * SYLLABLES.length)];
    const syl2 = SYLLABLES[Math.floor(rng() * SYLLABLES.length)];
    const baseName = syl1 + syl2;

    let templates: string[];
    if (size >= 20) {
      templates = ['X Empire', 'X Confederation', 'Great X', 'X Federation', 'X Dominion'];
    } else if (size >= 5) {
      templates = ['Kingdom of X', 'X League', 'X Republic', 'X Principality', 'X Realm'];
    } else {
      templates = ['Tribe of X', 'City of X', 'X Settlement', 'X Clan'];
    }

    const template = templates[Math.floor(rng() * templates.length)];
    return template.replace('X', baseName);
  }

  /**
   * Overrides the display name of an existing state.
   *
   * No-ops silently if the ID does not exist (e.g. the state was already
   * released between the caller reading the ID and invoking this method).
   *
   * @param id   - ID of the state to rename.
   * @param name - New display name to assign.
   */
  renameState(id: number, name: string): void {
    const state = this.states.get(id);
    if (state) state.name = name;
  }

  /**
   * Stores the per-continent land-tile counts so that `computeStats` can
   * calculate continent unification scores.
   *
   * Must be called once after world generation before the first `step()`.
   *
   * @param counts - Array where `counts[ci]` is the total number of land tiles
   *                 on continent `ci` (index matches the continent ID assigned
   *                 by `WorldGenerator`).
   */
  setContinentLandCounts(counts: number[]): void {
    this.continentLandCounts = counts;
  }

  /**
   * Derives a `SimStats` snapshot from the current simulation state.
   *
   * Computed metrics:
   * - `stateCount` — number of extant states.
   * - `largestStateSize` / `largestStateShare` — tiles held by the dominant power
   *   and its share of all land.
   * - `avgStateSize` — mean tiles per state.
   * - `hhi` — Herfindahl-Hirschman Index measuring land concentration
   *   (0 = perfectly fragmented, 1 = fully unified).
   * - `continentUnificationScores` — per-continent ratio of the largest state's
   *   holdings to total continent land tiles (requires prior
   *   {@link setContinentLandCounts} call).
   *
   * `conflictsThisTurn`, `conquestsThisTurn`, and `secessionsThisTurn` are
   * initialised to `0`; the caller (`SimulationEngine.step`) patches them in
   * after resolving the turn.
   *
   * @param simState       - Current simulation state (ownership + state map + turn).
   * @param totalLandTiles - Total number of land tiles in the world (from `WorldData`).
   * @returns A fully-populated `SimStats` object for the current turn.
   */
  computeStats(simState: SimState, totalLandTiles: number): SimStats {
    const stateSizes = [...simState.states.values()].map(s => s.size);
    const stateCount = stateSizes.length;
    const largestStateSize = stateCount > 0 ? Math.max(...stateSizes) : 0;
    const largestStateShare = totalLandTiles > 0 ? largestStateSize / totalLandTiles : 0;
    const avgStateSize = stateCount > 0 ? totalLandTiles / stateCount : 0;
    const hhi = totalLandTiles > 0
      ? stateSizes.reduce((sum, sz) => sum + (sz / totalLandTiles) ** 2, 0)
      : 0;

    // Per-continent maximum state size
    const continentMaxSizes = new Map<number, number>();
    for (const state of simState.states.values()) {
      if (state.continent !== null) {
        const current = continentMaxSizes.get(state.continent) ?? 0;
        continentMaxSizes.set(state.continent, Math.max(current, state.size));
      }
    }

    const continentUnificationScores = this.continentLandCounts.map((count, ci) => {
      if (count === 0) return 0;
      return (continentMaxSizes.get(ci) ?? 0) / count;
    });

    return {
      turn: simState.turn,
      year: simState.turn * 10,
      stateCount,
      largestStateSize,
      largestStateShare,
      avgStateSize,
      hhi,
      conflictsThisTurn: 0,
      conquestsThisTurn: 0,
      secessionsThisTurn: 0,
      totalLandTiles,
      continentUnificationScores,
    };
  }
}
