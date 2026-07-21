import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { MapBuilderState, MapBuilderTile, SavedCustomMap } from '../../types/mapbuilder';
import type { TerrainType, WorldData } from '../../types/world';
import { WorldGenerator } from '../../simulation/WorldGenerator';
import { mulberry32 } from '../../simulation/rng';
import { DEFAULT_GRID, MAX_HEX_BUDGET, MIN_DIM } from '../../geo/dimensionSolver';

function makeInitialTiles(width: number, height: number): MapBuilderTile[] {
  const tiles: MapBuilderTile[] = [];
  for (let i = 0; i < width * height; i++) {
    tiles.push({
      index: i,
      q: i % width,
      r: Math.floor(i / width),
      terrain: 'ocean',
      productivityOverride: null,
    });
  }
  return tiles;
}

interface MapBuilderContextValue {
  state: MapBuilderState;
  applyBrush: (centerIdx: number) => void;
  beginStroke: () => void;
  setBrushSize: (size: number) => void;
  setSelectedBiome: (biome: TerrainType) => void;
  setRandomEnabled: (enabled: boolean) => void;
  setRandomIntensity: (intensity: number) => void;
  toggleRandomBiome: (biome: TerrainType) => void;
  setName: (name: string) => void;
  setDimensions: (width: number, height: number) => void;
  generateRandomContinents: () => void;
  clearMap: () => void;
  saveMap: () => void;
  loadMap: (json: string) => void;
  undo: () => void;
  redo: () => void;
  convertToWorldData: () => WorldData;
}

const MapBuilderContext = createContext<MapBuilderContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useMapBuilder(): MapBuilderContextValue {
  const ctx = useContext(MapBuilderContext);
  if (!ctx) throw new Error('useMapBuilder must be used inside MapBuilderProvider');
  return ctx;
}

function normalizeRandomPool(pool: TerrainType[], fallback: TerrainType): TerrainType[] {
  const unique = [...new Set(pool)];
  return unique.length > 0 ? unique : [fallback];
}

export function MapBuilderProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MapBuilderState>({
    tiles: makeInitialTiles(DEFAULT_GRID.width, DEFAULT_GRID.height),
    width: DEFAULT_GRID.width,
    height: DEFAULT_GRID.height,
    brushSize: 2,
    selectedBiome: 'plains',
    randomEnabled: false,
    randomIntensity: 0.35,
    randomBiomePool: ['forest', 'hills', 'river_valley'],
    name: 'My Map',
    isDirty: false,
  });

  const historyRef = useRef<MapBuilderTile[][]>([]);
  const historyIndexRef = useRef<number>(-1);
  const strokePendingRef = useRef(false);

  const pushHistory = useCallback((tiles: MapBuilderTile[]) => {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(tiles.map(t => ({ ...t })));
    if (historyRef.current.length > 50) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const beginStroke = useCallback(() => {
    strokePendingRef.current = true;
  }, []);

  const hexDist = (q1: number, r1: number, q2: number, r2: number): number => {
    const toCube = (q: number, r: number): [number, number, number] => {
      const x = q;
      const z = r - (q - (q & 1)) / 2;
      return [x, -x - z, z];
    };
    const [x1, y1, z1] = toCube(q1, r1);
    const [x2, y2, z2] = toCube(q2, r2);
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
  };

  const applyBrush = useCallback((centerIdx: number) => {
    setState(prev => {
      const center = prev.tiles[centerIdx];
      if (!center) return prev;

      const indexMap = new Map<string, number>();
      for (const t of prev.tiles) indexMap.set(`${t.q},${t.r}`, t.index);
      const dirsEven = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1]] as const;
      const dirsOdd = [[1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1], [0, 1]] as const;

      const brushSet = new Set<number>([centerIdx]);
      const queue = [centerIdx];
      const visited = new Set<number>([centerIdx]);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const ct = prev.tiles[curr];
        const dirs = ct.q % 2 === 0 ? dirsEven : dirsOdd;
        for (const [dq, dr] of dirs) {
          const ni = indexMap.get(`${ct.q + dq},${ct.r + dr}`);
          if (ni === undefined || visited.has(ni)) continue;
          visited.add(ni);
          const nt = prev.tiles[ni];
          if (hexDist(nt.q, nt.r, center.q, center.r) <= prev.brushSize) {
            brushSet.add(ni);
            queue.push(ni);
          }
        }
      }

      if (strokePendingRef.current) {
        pushHistory(prev.tiles);
        strokePendingRef.current = false;
      }

      const rng = mulberry32(Math.floor(Math.random() * 999999));
      const randomPool = normalizeRandomPool(prev.randomBiomePool, prev.selectedBiome);

      const newTiles = prev.tiles.map(t => {
        if (!brushSet.has(t.index)) return t;

        const useRandomBiome = prev.randomEnabled && rng() < prev.randomIntensity;
        const terrain = useRandomBiome
          ? randomPool[Math.floor(rng() * randomPool.length)]
          : prev.selectedBiome;

        return {
          ...t,
          terrain,
          productivityOverride: terrain === 'ocean' ? null : t.productivityOverride,
        };
      });

      return { ...prev, tiles: newTiles, isDirty: true };
    });
  }, [pushHistory]);

  const setBrushSize = useCallback((brushSize: number) => {
    setState(prev => ({ ...prev, brushSize: Math.max(0, Math.min(8, brushSize)) }));
  }, []);

  const setSelectedBiome = useCallback((selectedBiome: TerrainType) => {
    setState(prev => ({ ...prev, selectedBiome }));
  }, []);

  const setRandomEnabled = useCallback((randomEnabled: boolean) => {
    setState(prev => ({ ...prev, randomEnabled }));
  }, []);

  const setRandomIntensity = useCallback((randomIntensity: number) => {
    setState(prev => ({ ...prev, randomIntensity: Math.max(0, Math.min(1, randomIntensity)) }));
  }, []);

  const toggleRandomBiome = useCallback((biome: TerrainType) => {
    setState(prev => {
      const exists = prev.randomBiomePool.includes(biome);
      const nextPool = exists
        ? prev.randomBiomePool.filter(item => item !== biome)
        : [...prev.randomBiomePool, biome];
      return {
        ...prev,
        randomBiomePool: normalizeRandomPool(nextPool, prev.selectedBiome),
      };
    });
  }, []);

  const setName = useCallback((name: string) => setState(p => ({ ...p, name })), []);

  const setDimensions = useCallback((width: number, height: number) => {
    let w = Math.max(MIN_DIM, Math.round(width) || MIN_DIM);
    let h = Math.max(MIN_DIM, Math.round(height) || MIN_DIM);
    if (w * h > MAX_HEX_BUDGET) {
      const scale = Math.sqrt(MAX_HEX_BUDGET / (w * h));
      w = Math.max(MIN_DIM, Math.floor(w * scale));
      h = Math.max(MIN_DIM, Math.floor(h * scale));
    }
    setState(prev => {
      if (w === prev.width && h === prev.height) return prev;
      historyRef.current = [];
      historyIndexRef.current = -1;
      return { ...prev, width: w, height: h, tiles: makeInitialTiles(w, h), isDirty: true };
    });
  }, []);

  const generateRandomContinents = useCallback(() => {
    setState(prev => {
      const rng = mulberry32(Math.floor(Math.random() * 999999));
      const numBlobs = 2 + Math.floor(rng() * 3);
      const w = prev.width;
      const h = prev.height;

      const blobCenters: { q: number; r: number; radius: number }[] = [];
      for (let b = 0; b < numBlobs; b++) {
        blobCenters.push({
          q: Math.floor(rng() * w),
          r: Math.floor(rng() * h),
          radius: 8 + Math.floor(rng() * 12),
        });
      }

      const newTiles = prev.tiles.map(t => {
        const inBlob = blobCenters.some(blob => {
          const dq = t.q - blob.q;
          const dr = t.r - blob.r;
          const dist = Math.sqrt(dq * dq + dr * dr) + (rng() - 0.5) * 3;
          return dist <= blob.radius;
        });

        if (!inBlob) return { ...t, terrain: 'ocean' as TerrainType, productivityOverride: null };

        const rRatio = t.r / h;
        let terrain: TerrainType;
        if (rRatio < 0.12 || rRatio > 0.88) {
          terrain = 'tundra';
        } else if (rRatio >= 0.35 && rRatio <= 0.65) {
          const roll = rng();
          terrain = roll < 0.6 ? 'plains' : roll < 0.8 ? 'river_valley' : 'forest';
        } else {
          terrain = rng() < 0.5 ? 'desert' : 'hills';
        }
        if (rng() < 0.15) terrain = 'mountains';

        return { ...t, terrain, productivityOverride: null };
      });

      pushHistory(prev.tiles);
      return { ...prev, tiles: newTiles, isDirty: true };
    });
  }, [pushHistory]);

  const clearMap = useCallback(() => {
    setState(prev => {
      pushHistory(prev.tiles);
      return { ...prev, tiles: makeInitialTiles(prev.width, prev.height), isDirty: true };
    });
  }, [pushHistory]);

  const saveMap = useCallback(() => {
    setState(prev => {
      const saved: SavedCustomMap = {
        version: 1,
        name: prev.name,
        savedAt: new Date().toISOString(),
        width: prev.width,
        height: prev.height,
        tiles: prev.tiles.map(t => ({
          index: t.index,
          terrain: t.terrain,
          productivityOverride: t.productivityOverride,
        })),
      };
      const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prev.name.replace(/\s+/g, '-')}.worldmap.json`;
      a.click();
      URL.revokeObjectURL(url);
      return { ...prev, isDirty: false };
    });
  }, []);

  const loadMap = useCallback((json: string) => {
    try {
      const data = JSON.parse(json) as SavedCustomMap;
      if (data.version !== 1) throw new Error('Invalid map version');
      const tiles: MapBuilderTile[] = data.tiles.map((t, i) => ({
        index: t.index ?? i,
        q: t.index % data.width,
        r: Math.floor(t.index / data.width),
        terrain: t.terrain,
        productivityOverride: t.productivityOverride,
      }));
      setState(prev => ({
        ...prev,
        tiles,
        width: data.width,
        height: data.height,
        name: data.name,
        isDirty: false,
      }));
    } catch {
      console.error('Failed to load map');
    }
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current < 0) return;
    const tiles = historyRef.current[historyIndexRef.current];
    historyIndexRef.current--;
    setState(prev => ({ ...prev, tiles: tiles.map(t => ({ ...t })) }));
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const tiles = historyRef.current[historyIndexRef.current];
    setState(prev => ({ ...prev, tiles: tiles.map(t => ({ ...t })) }));
  }, []);

  const convertToWorldData = useCallback((): WorldData => {
    return WorldGenerator.fromCustomMap(state.tiles, state.width, state.height);
  }, [state.tiles, state.width, state.height]);

  const value: MapBuilderContextValue = {
    state,
    applyBrush,
    beginStroke,
    setBrushSize,
    setSelectedBiome,
    setRandomEnabled,
    setRandomIntensity,
    toggleRandomBiome,
    setName,
    setDimensions,
    generateRandomContinents,
    clearMap,
    saveMap,
    loadMap,
    undo,
    redo,
    convertToWorldData,
  };

  return <MapBuilderContext.Provider value={value}>{children}</MapBuilderContext.Provider>;
}
