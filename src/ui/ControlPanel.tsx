import { useRef } from 'react';
import { useSimulation } from '../SimulationContext';
import styles from '../styles/ControlPanel.module.css';

export function ControlPanel() {
  const {
    uiState,
    setUIState,
    playPause,
    stepOnce,
    stepN,
    resetSim,
    loadEurasia,
    randomizeContinents,
    changeSettings,
    changeSeed,
    saveJSON,
    loadJSON,
    exportScreenshot,
  } = useSimulation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { settings, isPlaying, speed, seed, mapMode } = uiState;

  const handleSeedKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') changeSeed((e.target as HTMLInputElement).value);
  };

  const handleLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) loadJSON(ev.target.result as string);
    };
    reader.readAsText(file);
  };

  const logSpeed = (ms: number) => {
    return Math.round((Math.log(ms) - Math.log(50)) / (Math.log(2000) - Math.log(50)) * 100);
  };

  const sliderToSpeed = (v: number) => {
    return Math.round(Math.exp(Math.log(50) + (v / 100) * (Math.log(2000) - Math.log(50))));
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>World Simulator</h2>

      <section className={styles.section}>
        <div className={styles.buttonRow}>
          <button className={styles.primaryBtn} onClick={playPause}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className={styles.btn} onClick={stepOnce} disabled={isPlaying}>
            ⏭ Step
          </button>
          <button className={styles.btn} onClick={() => stepN(100)} disabled={isPlaying}>
            ⏭×100
          </button>
        </div>
        <div className={styles.buttonRow}>
          <button className={styles.btn} onClick={resetSim}>↺ Reset</button>
          <button className={styles.btn} onClick={loadEurasia}>🗺 Eurasia</button>
        </div>
        <div className={styles.buttonRow}>
          <button className={styles.btn} onClick={randomizeContinents}>🌍 Random Continents</button>
        </div>
      </section>

      <section className={styles.section}>
        <label className={styles.label}>Seed</label>
        <input
          className={styles.input}
          defaultValue={seed}
          onKeyDown={handleSeedKeyDown}
          placeholder="Press Enter to apply"
        />
      </section>

      <section className={styles.section}>
        <label className={styles.label}>Speed: {speed}ms/step</label>
        <input
          type="range" min={0} max={100} step={1}
          value={logSpeed(speed)}
          onChange={e => setUIState(prev => ({ ...prev, speed: sliderToSpeed(Number(e.target.value)) }))}
          className={styles.slider}
        />
      </section>

      <section className={styles.section}>
        <label className={styles.label}>Conflict Frequency: {settings.baseConflictRate.toFixed(2)}</label>
        <input type="range" min={0.1} max={1.0} step={0.05} value={settings.baseConflictRate}
          onChange={e => changeSettings({ baseConflictRate: Number(e.target.value) })}
          className={styles.slider} />

        <label className={styles.label}>Sea Conquest: {settings.seaConquestChance.toFixed(2)}</label>
        <input type="range" min={0.0} max={0.5} step={0.05} value={settings.seaConquestChance}
          onChange={e => changeSettings({ seaConquestChance: Number(e.target.value) })}
          className={styles.slider} />

        <label className={styles.label}>Secession Rate: {settings.secessionRate.toFixed(2)}</label>
        <input type="range" min={0.0} max={1.0} step={0.05} value={settings.secessionRate}
          onChange={e => changeSettings({ secessionRate: Number(e.target.value) })}
          className={styles.slider} />

        <label className={styles.label}>Geography Difficulty: {settings.geographyDifficulty.toFixed(1)}</label>
        <input type="range" min={0.2} max={2.0} step={0.1} value={settings.geographyDifficulty}
          onChange={e => changeSettings({ geographyDifficulty: Number(e.target.value) })}
          className={styles.slider} />

        <label className={styles.label}>Productivity Influence: {settings.productivityInfluence.toFixed(1)}</label>
        <input type="range" min={0.2} max={2.0} step={0.1} value={settings.productivityInfluence}
          onChange={e => changeSettings({ productivityInfluence: Number(e.target.value) })}
          className={styles.slider} />
      </section>

      <section className={styles.section}>
        <label className={styles.toggleLabel}>
          <input type="checkbox" checked={settings.enableSeaConquest}
            onChange={e => changeSettings({ enableSeaConquest: e.target.checked })} />
          Sea Conquest
        </label>
        <label className={styles.toggleLabel}>
          <input type="checkbox" checked={settings.enableSecession}
            onChange={e => changeSettings({ enableSecession: e.target.checked })} />
          Secession
        </label>
        <label className={styles.toggleLabel}>
          <input type="checkbox" checked={settings.enableCapitalDistanceUnrest}
            onChange={e => changeSettings({ enableCapitalDistanceUnrest: e.target.checked })} />
          Capital Distance Unrest
        </label>
        <label className={styles.toggleLabel}>
          <input type="checkbox" checked={settings.enableDisconnectedSplit}
            onChange={e => changeSettings({ enableDisconnectedSplit: e.target.checked })} />
          Split Disconnected States
        </label>
      </section>

      <section className={styles.section}>
        <label className={styles.label}>Map Mode</label>
        <div className={styles.modeButtons}>
          {(['political', 'terrain', 'productivity', 'obstacle'] as const).map(mode => (
            <button
              key={mode}
              className={mapMode === mode ? styles.modeActive : styles.modeBtn}
              onClick={() => setUIState(prev => ({ ...prev, mapMode: mode }))}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.buttonRow}>
          <button className={styles.btn} onClick={saveJSON}>💾 Save</button>
          <button className={styles.btn} onClick={() => fileInputRef.current?.click()}>📂 Load</button>
          <button className={styles.btn} onClick={exportScreenshot}>📷 Export</button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleLoadFile} />
        </div>
      </section>
    </div>
  );
}
