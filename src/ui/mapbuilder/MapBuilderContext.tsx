import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { MapBuilderState, MapBuilderTile, SavedCustomMap } from '../../types/mapbuilder';
import type { TerrainType } from '../../types/world';
import type { WorldData } from '../../types/world';
import { WorldGenerator } from '../../simulation/WorldGenerator';
import { mulberry32 } from '../../simulation/rng';
import { DEFAULT_GRID, MAX_HEX_BUDGET, MIN_DIM } from '../../geo/dimensionSolver';

const LAND_BIOMES: TerrainType[] = ['plains', 'hills', 'forest', 'desert', 'tundra', 'river_valley', 'mountains'];

function makeInitialTiles(width: number, height: number): MapBuilderTile[] {
  const tiles: MapBuilderTile[] = [];
  for (let i = 0; i < width * height; i++) {
    tiles.push({ index: i, q: i % width, r: Math.floor(i / width), terrain: 'ocean', productivityOverride: null });
  }
  return tiles;
}

interface MapBuilderContextValue {
  state: MapBuilderState;
  applyBrush: (centerIdx: number) => void;
  beginStroke: () => void;
  setTool: (tool: MapBuilderState['tool']) => void;
  setBrushSize: (size: number) => void;
  setSelectedBiome: (biome: TerrainType) => void;
  setProductivityValue: (val: number) => void;
  setRandomEnabled: (enabled: boolean) => void;
  setName: (name: string) => void;
  setDimensions: (width: number, height: number) => void;
  generateRandomContinents: () => void;
  clearMap: () => void;
  saveMap: () => void;
  loadMap: (json: string) => void;
  loadEurasia: () => void;
  undo: () => void;
  redo: () => void;
  trimEdges: (top: number, bottom: number, left: number, right: number) => void;
  convertToWorldData: () => WorldData;
}

const MapBuilderContext = createContext<MapBuilderContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useMapBuilder(): MapBuilderContextValue {
  const ctx = useContext(MapBuilderContext);
  if (!ctx) throw new Error('useMapBuilder must be used inside MapBuilderProvider');
  return ctx;
}

export function MapBuilderProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MapBuilderState>({
    tiles: makeInitialTiles(DEFAULT_GRID.width, DEFAULT_GRID.height),
    width: DEFAULT_GRID.width,
    height: DEFAULT_GRID.height,
    tool: 'paint-land',
    brushSize: 2,
    selectedBiome: 'plains',
    productivityValue: 0.5,
    randomEnabled: false,
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
      const DIRS_EVEN = [[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]] as const;
      const DIRS_ODD  = [[1,1],[1,0],[0,-1],[-1,0],[-1,1],[0,1]] as const;

      const brushSet = new Set<number>([centerIdx]);
      const queue = [centerIdx];
      const visited = new Set<number>([centerIdx]);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const ct = prev.tiles[curr];
        const dirs = ct.q % 2 === 0 ? DIRS_EVEN : DIRS_ODD;
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

      const newTiles = prev.tiles.map(t => {
        if (!brushSet.has(t.index)) return t;
        let terrain = t.terrain;
        let productivityOverride = t.productivityOverride;

        if (prev.tool === 'paint-ocean') {
          terrain = 'ocean';
          productivityOverride = null;
        } else if (prev.tool === 'paint-land' || prev.tool === 'paint-biome') {
          if (prev.tool === 'paint-biome' && t.terrain === 'ocean') return t;
          if (prev.randomEnabled) {
            terrain = rng() < 0.7 ? prev.selectedBiome : LAND_BIOMES[Math.floor(rng() * LAND_BIOMES.length)];
          } else {
            terrain = prev.selectedBiome;
          }
        } else if (prev.tool === 'paint-productivity') {
          const val = prev.randomEnabled
            ? Math.max(0, Math.min(1, prev.productivityValue + (rng() - 0.5) * 0.5))
            : prev.productivityValue;
          productivityOverride = val;
        }
        return { ...t, terrain, productivityOverride };
      });

      return { ...prev, tiles: newTiles, isDirty: true };
    });
  }, [pushHistory]);

  const setTool = useCallback((tool: MapBuilderState['tool']) => setState(p => ({ ...p, tool })), []);
  const setBrushSize = useCallback((brushSize: number) => setState(p => ({ ...p, brushSize: Math.max(0, Math.min(8, brushSize)) })), []);
  const setSelectedBiome = useCallback((selectedBiome: TerrainType) => setState(p => ({ ...p, selectedBiome })), []);
  const setProductivityValue = useCallback((productivityValue: number) => setState(p => ({ ...p, productivityValue })), []);
  const setRandomEnabled = useCallback((randomEnabled: boolean) => setState(p => ({ ...p, randomEnabled })), []);
  const setName = useCallback((name: string) => setState(p => ({ ...p, name })), []);

  const setDimensions = useCallback((width: number, height: number) => {
    // Clamp each axis to at least MIN_DIM, then shrink proportionally so the
    // total never exceeds the validated hex budget cap.
    let w = Math.max(MIN_DIM, Math.round(width) || MIN_DIM);
    let h = Math.max(MIN_DIM, Math.round(height) || MIN_DIM);
    if (w * h > MAX_HEX_BUDGET) {
      const scale = Math.sqrt(MAX_HEX_BUDGET / (w * h));
      w = Math.max(MIN_DIM, Math.floor(w * scale));
      h = Math.max(MIN_DIM, Math.floor(h * scale));
    }
    setState(prev => {
      if (w === prev.width && h === prev.height) return prev;
      // New size discards content: reset history and start from a blank map.
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

        if (!inBlob) return { ...t, terrain: 'ocean' as TerrainType };

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
        tiles: prev.tiles.map(t => ({ index: t.index, terrain: t.terrain, productivityOverride: t.productivityOverride })),
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

  const loadEurasia = useCallback(() => {
    fetch(`${import.meta.env.BASE_URL}eurasia.worldmap.json`)
      .then(r => r.text())
      .then(loadMap)
      .catch(err => console.error('Failed to load Eurasia map:', err));
  }, [loadMap]);

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

  const trimEdges = useCallback((top: number, bottom: number, left: number, right: number) => {
    setState(prev => {
      const t = Math.max(0, Math.floor(top));
      const b = Math.max(0, Math.floor(bottom));
      const l = Math.max(0, Math.floor(left));
      const r = Math.max(0, Math.floor(right));
      const newW = prev.width - l - r;
      const newH = prev.height - t - b;
      if (newW < MIN_DIM || newH < MIN_DIM) return prev; // guard: don't shrink below minimum
      const newTiles: MapBuilderTile[] = [];
      for (let row = t; row < prev.height - b; row++) {
        for (let col = l; col < prev.width - r; col++) {
          const oldIdx = row * prev.width + col;
          const newIdx = (row - t) * newW + (col - l);
          const old = prev.tiles[oldIdx];
          newTiles.push({
            index: newIdx,
            q: col - l,
            r: row - t,
            terrain: old?.terrain ?? 'ocean',
            productivityOverride: old?.productivityOverride ?? null,
          });
        }
      }
      pushHistory(prev.tiles);
      // Reset history index since dimensions changed
      historyRef.current = [];
      historyIndexRef.current = -1;
      return { ...prev, width: newW, height: newH, tiles: newTiles, isDirty: true };
    });
  }, [pushHistory]);

  const convertToWorldData = useCallback((): WorldData => {
    return WorldGenerator.fromCustomMap(state.tiles, state.width, state.height);
  }, [state.tiles, state.width, state.height]);

  const value: MapBuilderContextValue = {
    state, applyBrush, beginStroke, setTool, setBrushSize, setSelectedBiome,
    setProductivityValue, setRandomEnabled, setName, setDimensions,
    generateRandomContinents, clearMap, saveMap, loadMap, loadEurasia,
    undo, redo, trimEdges, convertToWorldData,
  };

  return <MapBuilderContext.Provider value={value}>{children}</MapBuilderContext.Provider>;
}
