import React, { useRef, useState, useEffect } from 'react';
import { useMapBuilder } from './MapBuilderContext';
import { TERRAIN_COLORS } from '../../renderer/MapModes';
import { gridForBudget, MIN_DIM, MAX_HEX_BUDGET } from '../../geo/dimensionSolver';
import { RealWorldPanel } from './RealWorldPanel';
import { DefaultMapGenerator } from './DefaultMapGenerator';
import type { WorldData } from '../../types/world';
import styles from './MapBuilderPanel.module.css';

interface DefaultMapMeta {
  id: string;
  name: string;
  file: string;
  bbox: { lonMin: number; latMin: number; lonMax: number; latMax: number };
  hexBudget: number;
}

interface DefaultMapsManifest {
  version: number;
  maps: DefaultMapMeta[];
}

const BIOME_LEGEND = [
  { terrain: 'river_valley', label: 'River Valley', productivity: '~0.93' },
  { terrain: 'plains',       label: 'Plains',       productivity: '~0.70' },
  { terrain: 'forest',       label: 'Forest',       productivity: '~0.53' },
  { terrain: 'hills',        label: 'Hills',        productivity: '~0.40' },
  { terrain: 'desert',       label: 'Desert',       productivity: '~0.15' },
  { terrain: 'tundra',       label: 'Tundra',       productivity: '~0.18' },
  { terrain: 'mountains',    label: 'Mountains',    productivity: '~0.15' },
  { terrain: 'ocean',        label: 'Ocean',        productivity: 'impassable' },
] as const;

const SIZE_PRESETS = [
  { label: 'Small', budget: 16_000 },
  { label: 'Medium', budget: 40_000 },
  { label: 'Large', budget: MAX_HEX_BUDGET },
] as const;

interface Props {
  onRunSimulation: (worldData: WorldData) => void;
}

export function MapBuilderPanel({ onRunSimulation }: Props) {
  const ctx = useMapBuilder();
  const { state } = ctx;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const widthInputRef = useRef<HTMLInputElement>(null);
  const heightInputRef = useRef<HTMLInputElement>(null);

  const [defaultMaps, setDefaultMaps] = useState<DefaultMapMeta[]>([]);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'builder' | 'realworld' | 'devgen'>('builder');
  const [showDevGen, setShowDevGen] = useState(false);

  // Fetch the default maps manifest on mount
  useEffect(() => {
    const loadManifest = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}defaultMaps.json`);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        const manifest: DefaultMapsManifest = await response.json();
        setDefaultMaps(manifest.maps || []);
      } catch (err) {
        console.error('Failed to load default maps manifest:', err);
      }
    };

    // Check for dev mode (URL param ?dev=1 or env var)
    const params = new URLSearchParams(window.location.search);
    const devMode = params.get('dev') === '1' || import.meta.env.VITE_DEV_MAPS === 'true';
    setShowDevGen(devMode);

    loadManifest();
  }, []);

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => ctx.loadMap(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleSelectDefaultMap = async (mapId: string) => {
    if (!mapId) {
      setSelectedMapId('');
      return;
    }

    setSelectedMapId(mapId);
    setIsLoadingMap(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}maps/${mapId}.worldmap.json`);
      if (!response.ok) throw new Error(`Failed to fetch map: ${response.status}`);
      const json = await response.text();
      ctx.loadMap(json);
    } catch (err) {
      console.error(`Failed to load map ${mapId}:`, err);
      setSelectedMapId('');
    } finally {
      setIsLoadingMap(false);
    }
  };

  const applyCustomSize = () => {
    const w = Number(widthInputRef.current?.value);
    const h = Number(heightInputRef.current?.value);
    if (w > 0 && h > 0) ctx.setDimensions(w, h);
  };

  return (
    <div className={styles.panel}>
      {/* Tab Navigation */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'builder' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('builder')}
        >
          🛠 Builder
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'realworld' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('realworld')}
        >
          🌍 Real-World
        </button>
        {showDevGen && (
          <button
            className={`${styles.tabBtn} ${activeTab === 'devgen' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('devgen')}
          >
            🔧 Dev Gen
          </button>
        )}
      </div>

      {/* Builder Tab */}
      {activeTab === 'builder' && (
        <>
          {/* Header */}
          <div className={styles.section}>
            <div className={styles.title}>🗺 Map Builder</div>
            <input
              className={styles.nameInput}
              value={state.name}
              onChange={e => ctx.setName(e.target.value)}
              placeholder="Map name"
            />
          </div>

          {/* Generate */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>GENERATE</div>
            <button className={styles.btn} onClick={ctx.generateRandomContinents}>🎲 Random Continents</button>
            <button className={styles.btn} onClick={ctx.clearMap}>🗑 Clear Map</button>
          </div>

          {/* Default Maps Picker */}
          {defaultMaps.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>DEFAULT MAPS</div>
              <select
                className={styles.mapSelect}
                value={selectedMapId}
                onChange={e => handleSelectDefaultMap(e.target.value)}
                disabled={isLoadingMap}
              >
                <option value="">-- Select a map --</option>
                {defaultMaps.map(map => (
                  <option key={map.id} value={map.id}>
                    {map.name}
                  </option>
                ))}
              </select>
              {isLoadingMap && <div className={styles.loadingText}>Loading map...</div>}
            </div>
          )}

          {/* Map Size */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>
              MAP SIZE · {state.width}×{state.height} (~{Math.round((state.width * state.height) / 1000)}k hexes)
            </div>
            <div className={styles.toolGrid}>
              {SIZE_PRESETS.map(preset => {
                const dims = gridForBudget(preset.budget);
                const active = state.width === dims.width && state.height === dims.height;
                return (
                  <button
                    key={preset.label}
                    className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
                    title={`${dims.width}×${dims.height} (~${Math.round(preset.budget / 1000)}k hexes)`}
                    onClick={() => ctx.setDimensions(dims.width, dims.height)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className={styles.sizeRow}>
              <input
                ref={widthInputRef}
                key={`w-${state.width}`}
                className={styles.sizeInput}
                type="number"
                min={MIN_DIM}
                defaultValue={state.width}
                aria-label="Map width"
              />
              <span className={styles.sizeTimes}>×</span>
              <input
                ref={heightInputRef}
                key={`h-${state.height}`}
                className={styles.sizeInput}
                type="number"
                min={MIN_DIM}
                defaultValue={state.height}
                aria-label="Map height"
              />
              <button className={styles.btn} onClick={applyCustomSize}>Apply</button>
            </div>
            <div className={styles.sizeHint}>Changing size starts a new blank map (max {Math.round(MAX_HEX_BUDGET / 1000)}k hexes).</div>
          </div>

          {/* Tools */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>TOOL</div>
            <div className={styles.toolGrid}>
              {(['paint-ocean', 'paint-land', 'paint-biome', 'paint-productivity'] as const).map(tool => (
                <button
                  key={tool}
                  className={`${styles.toolBtn} ${state.tool === tool ? styles.toolBtnActive : ''}`}
                  onClick={() => ctx.setTool(tool)}
                >
                  {tool === 'paint-ocean' ? '🌊 Ocean'
                   : tool === 'paint-land' ? '🌿 Land'
                   : tool === 'paint-biome' ? '🎨 Biome'
                   : '⛰ Prod.'}
                </button>
              ))}
            </div>
          </div>

          {/* Biome Selector — unified card grid with swatch, name, productivity */}
          {(state.tool === 'paint-land' || state.tool === 'paint-biome') && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>BIOME</div>
              <div className={styles.biomeGrid}>
                {BIOME_LEGEND.filter(b => b.terrain !== 'ocean').map(({ terrain, label, productivity }) => (
                  <button
                    key={terrain}
                    className={`${styles.biomeCard} ${state.selectedBiome === terrain ? styles.biomeCardActive : ''}`}
                    onClick={() => ctx.setSelectedBiome(terrain as Parameters<typeof ctx.setSelectedBiome>[0])}
                  >
                    <span
                      className={styles.biomeSwatch}
                      style={{ background: (TERRAIN_COLORS as Record<string, string>)[terrain] ?? '#888' }}
                    />
                    <span>{label}</span>
                    <span className={styles.biomeProductivity}>{productivity}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Brush Size */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>{state.brushSize === 0 ? 'BRUSH: SINGLE HEX' : state.brushSize === 1 ? 'BRUSH: 1 (RING)' : `BRUSH SIZE: ${state.brushSize}`}</div>
            <input
              type="range" min={0} max={8} step={1}
              value={state.brushSize}
              onChange={e => ctx.setBrushSize(Number(e.target.value))}
              className={styles.slider}
            />
          </div>

          {/* Random intersperse */}
          <div className={styles.section}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={state.randomEnabled}
                onChange={e => ctx.setRandomEnabled(e.target.checked)}
              />
              Randomize within brush
            </label>
          </div>

          {/* Productivity */}
          {state.tool === 'paint-productivity' && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>PRODUCTIVITY: {state.productivityValue.toFixed(2)}</div>
              <input
                type="range" min={0} max={1} step={0.01}
                value={state.productivityValue}
                onChange={e => ctx.setProductivityValue(Number(e.target.value))}
                className={styles.slider}
              />
            </div>
          )}

          {/* File */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>FILE</div>
            <div className={styles.row}>
              <button className={styles.btn} onClick={ctx.saveMap}>💾 Save</button>
              <button className={styles.btn} onClick={() => fileInputRef.current?.click()}>📂 Load</button>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileLoad} />
            </div>
          </div>

          {/* Undo/Redo */}
          <div className={styles.section}>
            <div className={styles.row}>
              <button className={styles.btn} onClick={ctx.undo}>↩ Undo Stroke</button>
              <button className={styles.btn} onClick={ctx.redo}>↪ Redo</button>
            </div>
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button className={styles.runBtn} onClick={() => onRunSimulation(ctx.convertToWorldData())}>▶ Run Simulation on This Map</button>
          </div>
        </>
      )}

      {/* Real-World Tab */}
      {activeTab === 'realworld' && (
        <div className={styles.tabContent}>
          <RealWorldPanel />
        </div>
      )}

      {/* Dev Gen Tab */}
      {activeTab === 'devgen' && showDevGen && (
        <div className={styles.tabContent}>
          <DefaultMapGenerator />
        </div>
      )}
    </div>
  );
}
