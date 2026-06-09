import { useRef, useState } from 'react';
import { useSimulation } from '../SimulationContext';
import styles from '../styles/SimSettings.module.css';

const TIPS: Record<string, string> = {
  baseConflictRate:
    'How often border tiles propose attacks each turn. Higher values mean more aggressive expansion and faster territorial changes.',
  seaConquestChance:
    'Probability that a coastal state successfully crosses water to attack a nearby coastline. Only active when Sea Conquest is enabled.',
  secessionRate:
    'How likely border tiles are to break away and form a new micro-state each turn. Higher values create more fragmentation.',
  geographyDifficulty:
    'Amplifies terrain obstacles globally. At high values, mountains and hills become near-impassable natural borders.',
  productivityInfluence:
    'How much a tile\'s fertility boosts its state\'s combat power. Higher values make rich farmland far more strategically important.',
  enableSeaConquest:
    'Allows coastal states to project military power across water to reach distant coastlines. Disable for a purely land-based simulation.',
  enableSecession:
    'Allows border tiles to break away from large empires, forming new independent states. Disable to prevent fragmentation.',
  enableCapitalDistanceUnrest:
    'Border tiles that are far from their state\'s capital are more likely to secede, simulating the difficulty of holding distant territories.',
  enableDisconnectedSplit:
    'If a state\'s territory becomes geographically split (two non-adjacent blobs), each disconnected piece automatically becomes an independent state.',
};

export function SimSettings() {
  const [open, setOpen] = useState(true);
  const [activeTip, setActiveTip] = useState<string | null>(null);

  const toggleTip = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTip(prev => prev === key ? null : key);
  };

  const TipBtn = ({ tipKey }: { tipKey: string }) => (
    <button
      className={styles.tipBtn}
      onClick={e => toggleTip(tipKey, e)}
      aria-label={`Info for ${tipKey}`}
      type="button"
    >
      ⓘ
    </button>
  );

  const TipBox = ({ tipKey }: { tipKey: string }) =>
    activeTip === tipKey ? (
      <div className={styles.tipBox}>{TIPS[tipKey]}</div>
    ) : null;

  const {
    uiState,
    changeSettings,
    changeSeed,
    saveJSON,
    loadJSON,
    exportScreenshot,
    loadEurasia,
    randomizeContinents,
    resetSim,
  } = useSimulation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings, seed } = uiState;

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

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setOpen(o => !o)}>
        <span className={styles.title}>⚙ Simulation Settings</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
      </div>

      {open && (
        <div className={styles.body}>
          {/* Map */}
          <div className={styles.section}>
            <label className={styles.label}>Map</label>
            <div className={styles.buttonRow}>
              <button className={styles.btn} onClick={loadEurasia}>🗺 Eurasia</button>
              <button className={styles.btn} onClick={randomizeContinents}>🌍 Random</button>
              <button className={styles.btn} onClick={resetSim}>↺ Reset</button>
            </div>
          </div>

          {/* Seed */}
          <div className={styles.section}>
            <label className={styles.label}>Seed (Enter to apply)</label>
            <input
              className={styles.input}
              defaultValue={seed}
              onKeyDown={handleSeedKeyDown}
              placeholder="Press Enter to apply"
            />
          </div>

          {/* Sliders */}
          <div className={styles.section}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Conflict Frequency: {settings.baseConflictRate.toFixed(2)}</label>
              <TipBtn tipKey="baseConflictRate" />
            </div>
            <TipBox tipKey="baseConflictRate" />
            <input type="range" min={0.1} max={1.0} step={0.05} value={settings.baseConflictRate}
              onChange={e => changeSettings({ baseConflictRate: Number(e.target.value) })}
              className={styles.slider} />

            <div className={styles.labelRow}>
              <label className={styles.label}>Sea Conquest: {settings.seaConquestChance.toFixed(2)}</label>
              <TipBtn tipKey="seaConquestChance" />
            </div>
            <TipBox tipKey="seaConquestChance" />
            <input type="range" min={0.0} max={0.5} step={0.05} value={settings.seaConquestChance}
              onChange={e => changeSettings({ seaConquestChance: Number(e.target.value) })}
              className={styles.slider} />

            <div className={styles.labelRow}>
              <label className={styles.label}>Secession Rate: {settings.secessionRate.toFixed(2)}</label>
              <TipBtn tipKey="secessionRate" />
            </div>
            <TipBox tipKey="secessionRate" />
            <input type="range" min={0.0} max={1.0} step={0.05} value={settings.secessionRate}
              onChange={e => changeSettings({ secessionRate: Number(e.target.value) })}
              className={styles.slider} />

            <div className={styles.labelRow}>
              <label className={styles.label}>Geography Difficulty: {settings.geographyDifficulty.toFixed(1)}</label>
              <TipBtn tipKey="geographyDifficulty" />
            </div>
            <TipBox tipKey="geographyDifficulty" />
            <input type="range" min={0.2} max={2.0} step={0.1} value={settings.geographyDifficulty}
              onChange={e => changeSettings({ geographyDifficulty: Number(e.target.value) })}
              className={styles.slider} />

            <div className={styles.labelRow}>
              <label className={styles.label}>Productivity Influence: {settings.productivityInfluence.toFixed(1)}</label>
              <TipBtn tipKey="productivityInfluence" />
            </div>
            <TipBox tipKey="productivityInfluence" />
            <input type="range" min={0.2} max={2.0} step={0.1} value={settings.productivityInfluence}
              onChange={e => changeSettings({ productivityInfluence: Number(e.target.value) })}
              className={styles.slider} />
          </div>

          {/* Toggles */}
          <div className={styles.section}>
            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={settings.enableSeaConquest}
                  onChange={e => changeSettings({ enableSeaConquest: e.target.checked })} />
                Sea Conquest
              </label>
              <TipBtn tipKey="enableSeaConquest" />
            </div>
            <TipBox tipKey="enableSeaConquest" />

            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={settings.enableSecession}
                  onChange={e => changeSettings({ enableSecession: e.target.checked })} />
                Secession
              </label>
              <TipBtn tipKey="enableSecession" />
            </div>
            <TipBox tipKey="enableSecession" />

            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={settings.enableCapitalDistanceUnrest}
                  onChange={e => changeSettings({ enableCapitalDistanceUnrest: e.target.checked })} />
                Capital Distance Unrest
              </label>
              <TipBtn tipKey="enableCapitalDistanceUnrest" />
            </div>
            <TipBox tipKey="enableCapitalDistanceUnrest" />

            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={settings.enableDisconnectedSplit}
                  onChange={e => changeSettings({ enableDisconnectedSplit: e.target.checked })} />
                Split Disconnected States
              </label>
              <TipBtn tipKey="enableDisconnectedSplit" />
            </div>
            <TipBox tipKey="enableDisconnectedSplit" />
          </div>

          {/* Save / Load / Export */}
          <div className={styles.section}>
            <div className={styles.buttonRow}>
              <button className={styles.btn} onClick={saveJSON}>💾 Save</button>
              <button className={styles.btn} onClick={() => fileInputRef.current?.click()}>📂 Load</button>
              <button className={styles.btn} onClick={exportScreenshot}>📷 Export</button>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleLoadFile} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
