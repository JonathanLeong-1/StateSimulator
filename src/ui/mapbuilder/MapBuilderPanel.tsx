import React, { useRef } from 'react';
import { useMapBuilder } from './MapBuilderContext';
import { TERRAIN_COLORS } from '../../renderer/MapModes';
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

interface Props {
  onRunSimulation: (worldData: WorldData) => void;
}

export function MapBuilderPanel({ onRunSimulation }: Props) {
  const ctx = useMapBuilder();
  const { state } = ctx;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => ctx.loadMap(ev.target?.result as string);
    reader.readAsText(file);
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
