import React, { useRef } from 'react';
import { useMapBuilder } from './MapBuilderContext';
import { TERRAIN_COLORS } from '../../renderer/MapModes';
import { gridForBudget, MIN_DIM, MAX_HEX_BUDGET } from '../../geo/dimensionSolver';
import type { WorldData } from '../../types/world';
import styles from './MapBuilderPanel.module.css';

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

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => ctx.loadMap(ev.target?.result as string);
    reader.readAsText(file);
  };

  const applyCustomSize = () => {
    const w = Number(widthInputRef.current?.value);
    const h = Number(heightInputRef.current?.value);
    if (w > 0 && h > 0) ctx.setDimensions(w, h);
  };

  return (
    <div className={styles.panel}>
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
        <button className={styles.btn} onClick={ctx.loadEurasia}>🗺 Eurasia</button>
        <button className={styles.btn} onClick={ctx.clearMap}>🗑 Clear Map</button>
      </div>

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
    </div>
  );
}
