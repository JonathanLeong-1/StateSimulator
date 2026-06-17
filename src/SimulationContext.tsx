import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from 'react';
import { WorldGenerator } from './simulation/WorldGenerator';
import { SimulationEngine } from './simulation/SimulationEngine';
import { AnimationController } from './renderer/AnimationController';
import { buildWorld, buildCircleWorld, randomizeContinents as randomizeContinentsHelper } from './SimulationContext.helpers';
import type { WorldData } from './types/world';
import type { SimState } from './types/simulation';
import type { UIState, SimSettings } from './types/ui';
import type { MapBuilderTile, SavedCustomMap } from './types/mapbuilder';

const DEFAULT_SETTINGS: SimSettings = {
  baseConflictRate: 0.3,
  seaConquestChance: 0.1,
  secessionRate: 0.3,
  geographyDifficulty: 1.0,
  productivityInfluence: 1.0,
  enableSeaConquest: true,
  enableSecession: true,
  enableCapitalDistanceUnrest: true,
  enableDisconnectedSplit: true,
};

const DEFAULT_UI_STATE: UIState = {
  mapMode: 'political',
  hoveredTileIndex: null,
  selectedStateId: null,
  isPlaying: false,
  speed: 300,
  settings: DEFAULT_SETTINGS,
  chartHistory: [],
  seed: '42',
};

interface SimContextValue {
  world: WorldData | null;
  simState: SimState | null;
  uiState: UIState;
  setUIState: Dispatch<SetStateAction<UIState>>;
  animationController: AnimationController;
  playPause: () => void;
  stepOnce: () => void;
  stepN: (n: number) => void;
  resetSim: () => void;
  loadEurasia: () => void;
  changeSettings: (patch: Partial<SimSettings>) => void;
  changeSeed: (seed: string) => void;
  renameState: (id: number, name: string) => void;
  saveJSON: () => void;
  loadJSON: (json: string) => void;
  setCanvasElement: (el: HTMLCanvasElement | null) => void;
  exportScreenshot: () => void;
  loadCustomWorld: (worldData: WorldData) => void;
  randomizeContinents: () => void;
}

const SimContext = createContext<SimContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useSimulation(): SimContextValue {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error('useSimulation must be used within SimulationProvider');
  return ctx;
}



export function SimulationProvider({ children }: { children: ReactNode }) {
  const [world, setWorld] = useState<WorldData | null>(null);
  const [simState, setSimState] = useState<SimState | null>(null);
  const [uiState, setUIState] = useState<UIState>(DEFAULT_UI_STATE);

  const engineRef = useRef<SimulationEngine | null>(null);
  const animControllerRef = useRef(new AnimationController());
  // Mutable settings object shared with the engine so live changes take effect
  const settingsRef = useRef<SimSettings>({ ...DEFAULT_SETTINGS });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seedRef = useRef(DEFAULT_UI_STATE.seed);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);

  const setCanvasElement = useCallback((el: HTMLCanvasElement | null) => {
    canvasElementRef.current = el;
  }, []);

  const exportScreenshot = useCallback(() => {
    const canvas = canvasElementRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world-simulator-map.png';
    a.click();
  }, []);

  // Initialize on mount — load Eurasia by default, fall back to circle world
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}eurasia.worldmap.json`)
      .then(r => r.json())
      .then((data: SavedCustomMap) => {
        const tiles: MapBuilderTile[] = data.tiles.map(t => ({
          index: t.index,
          q: t.index % data.width,
          r: Math.floor(t.index / data.width),
          terrain: t.terrain,
          productivityOverride: t.productivityOverride,
        }));
        const worldData = WorldGenerator.fromCustomMap(tiles, data.width, data.height);
        const engine = new SimulationEngine(worldData, settingsRef.current);
        engine.initialize();
        engineRef.current = engine;
        setWorld(worldData);
        setSimState(engine.getState());
      })
      .catch(() => {
        // fallback if asset unavailable (e.g., unit tests)
        const { world: w, engine } = buildCircleWorld(settingsRef.current);
        engineRef.current = engine;
        setWorld(w);
        setSimState(engine.getState());
      });
  }, []);

  // Advance one step and record animations via ownership diff
  const doStep = useCallback(() => {
    if (!engineRef.current) return;
    const prevOwnership = new Int32Array(engineRef.current.getState().ownership);
    engineRef.current.step();
    const newState = engineRef.current.getState();

    // Track sea voyages for animation
    const currentState = engineRef.current.getState();
    for (const crossing of engineRef.current.getLastSeaCrossings()) {
      const stateColor = currentState.states.get(crossing.attackerStateId)?.color ?? '#ffffff';
      animControllerRef.current.markSeaVoyage(crossing.from, crossing.to, crossing.succeeded, stateColor);
    }

    // Detect conquered/seceded tiles for animation
    for (let i = 0; i < prevOwnership.length; i++) {
      const prev = prevOwnership[i];
      const next = newState.ownership[i];
      if (prev !== next && prev >= 0 && next >= 0) {
        const newOwnerState = newState.states.get(next);
        // A brand-new state (size === 1) owning a formerly-owned tile indicates secession
        if (newOwnerState && newOwnerState.size === 1) {
          animControllerRef.current.markSecession(i);
        } else {
          animControllerRef.current.markConquest(i);
        }
      }
    }

    setSimState({ ...newState });
    setUIState(prev => {
      const point = {
        turn: newState.stats.turn,
        stateCount: newState.stats.stateCount,
        largestStateShare: newState.stats.largestStateShare,
        hhi: newState.stats.hhi,
      };
      const history = [...prev.chartHistory, point].slice(-500);
      return { ...prev, chartHistory: history };
    });
  }, []);

  // Simulation loop
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!uiState.isPlaying) return;

    intervalRef.current = setInterval(() => {
      doStep();
    }, uiState.speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [uiState.isPlaying, uiState.speed, doStep]);

  const playPause = useCallback(() => {
    setUIState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const stepOnce = useCallback(() => {
    doStep();
  }, [doStep]);

  const stepN = useCallback((n: number) => {
    if (!engineRef.current) return;
    setUIState(prev => ({ ...prev, isPlaying: false }));
    for (let i = 0; i < n; i++) {
      engineRef.current.step();
    }
    setSimState(engineRef.current.getState());
  }, []);

  const resetSim = useCallback(() => {
    const { world: w, engine } = buildCircleWorld(settingsRef.current);
    engineRef.current = engine;
    animControllerRef.current = new AnimationController();
    setWorld(w);
    setSimState(engine.getState());
    setUIState(prev => ({
      ...prev,
      isPlaying: false,
      chartHistory: [],
      hoveredTileIndex: null,
      selectedStateId: null,
    }));
  }, []);

  const changeSettings = useCallback((patch: Partial<SimSettings>) => {
    // Mutate the shared settings object so the engine picks up changes immediately
    Object.assign(settingsRef.current, patch);
    setUIState(prev => ({ ...prev, settings: { ...settingsRef.current } }));
  }, []);

  const changeSeed = useCallback((seed: string) => {
    seedRef.current = seed;
    const numSeed = parseInt(seed, 10) || 42;
    const { world: w, engine } = buildWorld(numSeed, settingsRef.current);
    engineRef.current = engine;
    setWorld(w);
    setSimState(engine.getState());
    animControllerRef.current = new AnimationController();
    setUIState(prev => ({
      ...prev,
      seed,
      isPlaying: false,
      chartHistory: [],
      hoveredTileIndex: null,
      selectedStateId: null,
    }));
  }, []);

  const renameState = useCallback((id: number, name: string) => {
    // Directly mutate the StateData in the engine's live simState
    const state = engineRef.current?.getState().states.get(id);
    if (state) {
      state.name = name;
      setSimState(prev => prev ? { ...prev } : prev);
    }
  }, []);

  const saveJSON = useCallback(() => {
    if (!engineRef.current) return;
    const data = engineRef.current.serialize();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world-simulator-save.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const loadJSON = useCallback((json: string) => {
    if (!engineRef.current) return;
    try {
      engineRef.current.deserialize(json);
      setSimState({ ...engineRef.current.getState() });
      setUIState(prev => ({ ...prev, isPlaying: false, chartHistory: [] }));
    } catch (e) {
      console.error('Failed to load save:', e);
    }
  }, []);

  const loadCustomWorld = useCallback((worldData: WorldData) => {
    const engine = new SimulationEngine(worldData, settingsRef.current);
    engine.initialize();
    engineRef.current = engine;
    animControllerRef.current = new AnimationController();
    setWorld(worldData);
    setSimState(engine.getState());
    setUIState(prev => ({ ...prev, isPlaying: false, chartHistory: [], selectedStateId: null }));
  }, []);

  const loadEurasia = useCallback(() => {
    fetch(`${import.meta.env.BASE_URL}eurasia.worldmap.json`)
      .then(r => r.json())
      .then((data: SavedCustomMap) => {
        const tiles: MapBuilderTile[] = data.tiles.map(t => ({
          index: t.index,
          q: t.index % data.width,
          r: Math.floor(t.index / data.width),
          terrain: t.terrain,
          productivityOverride: t.productivityOverride,
        }));
        const worldData = WorldGenerator.fromCustomMap(tiles, data.width, data.height);
        loadCustomWorld(worldData);
      })
      .catch(err => console.error('Failed to load Eurasia map:', err));
  }, [loadCustomWorld]);

  const randomizeContinents = useCallback(() => {
    randomizeContinentsHelper(settingsRef.current, loadCustomWorld);
  }, [loadCustomWorld]);

  /* eslint-disable react-hooks/refs */
  const contextValue = useMemo(
    () => ({
      world,
      simState,
      uiState,
      setUIState,
      animationController: animControllerRef.current,
      playPause,
      stepOnce,
      stepN,
      resetSim,
      loadEurasia,
      changeSettings,
      changeSeed,
      renameState,
      saveJSON,
      loadJSON,
      setCanvasElement,
      exportScreenshot,
      loadCustomWorld,
      randomizeContinents,
    }),
    [
      world,
      simState,
      uiState,
      playPause,
      stepOnce,
      stepN,
      resetSim,
      loadEurasia,
      changeSettings,
      changeSeed,
      renameState,
      saveJSON,
      loadJSON,
      setCanvasElement,
      exportScreenshot,
      loadCustomWorld,
      randomizeContinents,
    ],
  );

  return (
    <SimContext.Provider value={contextValue}>
      {children}
    </SimContext.Provider>
  );
  /* eslint-enable react-hooks/refs */
}
