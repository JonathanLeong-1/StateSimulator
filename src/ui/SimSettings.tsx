import { useEffect, useRef, useState } from 'react';
import { useSimulation } from '../SimulationContext';
import { TipBtn } from './SimSettings/TipBtn';
import { TipBox } from './SimSettings/TipBox';
import styles from '../styles/SimSettings.module.css';

interface DefaultMapMeta {
  id: string;
  name: string;
  file: string;
}

interface DefaultMapsManifest {
  version: number;
  maps: DefaultMapMeta[];
}

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
  const [defaultMaps, setDefaultMaps] = useState<DefaultMapMeta[]>([]);
  const [selectedMapId, setSelectedMapId] = useState('eurasia');
  const [isLoadingMap, setIsLoadingMap] = useState(false);

  const toggleTip = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTip(prev => prev === key ? null : key);
  };

  const {
    uiState,
    setUIState,
    changeSettings,
    saveJSON,
    loadJSON,
    exportScreenshot,
    loadBuiltInMap,
    randomizeContinents,
    resetSim,
  } = useSimulation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings, showEventFlashes } = uiState;

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

    void loadManifest();
  }, []);

  const handleLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) loadJSON(ev.target.result as string);
    };
    reader.readAsText(file);
  };

  const handleSelectDefaultMap = async (mapId: string) => {
    setSelectedMapId(mapId);
    setIsLoadingMap(true);
    try {
      await loadBuiltInMap(mapId);
    } catch (err) {
      console.error(`Failed to load map ${mapId}:`, err);
    } finally {
      setIsLoadingMap(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setOpen(o => !o)}>
        <span className={styles.title}>⚙ Simulation Settings</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
      </div>

      {open && (
        <div className={styles.body}>
          <div className={`${styles.section} ${styles.mapSection}`}>
            <label className={`${styles.label} ${styles.mapLabel}`}>Choose a Map</label>
            <span className={styles.mapHint}>Start a simulation from one of the preset worlds.</span>
            {defaultMaps.length > 0 && (
              <select
                className={`${styles.input} ${styles.mapSelect}`}
                value={selectedMapId}
                onChange={e => void handleSelectDefaultMap(e.target.value)}
                disabled={isLoadingMap}
              >
                {defaultMaps.map(map => (
                  <option key={map.id} value={map.id}>
                    {map.name}
                  </option>
                ))}
              </select>
            )}
            <div className={styles.buttonRow}>
              <button className={styles.btn} onClick={randomizeContinents}>🌍 Random</button>
              <button className={styles.btn} onClick={resetSim}>↺ Reset</button>
            </div>
            {isLoadingMap && <div className={styles.label}>Loading map...</div>}
          </div>

          <div className={styles.section}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Conflict Frequency: {settings.baseConflictRate.toFixed(2)}</label>
              <TipBtn tipKey="baseConflictRate" onClick={toggleTip} />
            </div>
            <TipBox tipKey="baseConflictRate" activeTip={activeTip} tips={TIPS} />
            <input type="range" min={0.1} max={1.0} step={0.05} value={settings.baseConflictRate}
              onChange={e => changeSettings({ baseConflictRate: Number(e.target.value) })}
              className={styles.slider} />

            <div className={styles.labelRow}>
              <label className={styles.label}>Sea Conquest: {settings.seaConquestChance.toFixed(2)}</label>
              <TipBtn tipKey="seaConquestChance" onClick={toggleTip} />
            </div>
            <TipBox tipKey="seaConquestChance" activeTip={activeTip} tips={TIPS} />
            <input type="range" min={0.0} max={0.5} step={0.05} value={settings.seaConquestChance}
              onChange={e => changeSettings({ seaConquestChance: Number(e.target.value) })}
              className={styles.slider} />

            <div className={styles.labelRow}>
              <label className={styles.label}>Secession Rate: {settings.secessionRate.toFixed(2)}</label>
              <TipBtn tipKey="secessionRate" onClick={toggleTip} />
            </div>
            <TipBox tipKey="secessionRate" activeTip={activeTip} tips={TIPS} />
            <input type="range" min={0.0} max={1.0} step={0.05} value={settings.secessionRate}
              onChange={e => changeSettings({ secessionRate: Number(e.target.value) })}
              className={styles.slider} />

            <div className={styles.labelRow}>
              <label className={styles.label}>Geography Difficulty: {settings.geographyDifficulty.toFixed(1)}</label>
              <TipBtn tipKey="geographyDifficulty" onClick={toggleTip} />
            </div>
            <TipBox tipKey="geographyDifficulty" activeTip={activeTip} tips={TIPS} />
            <input type="range" min={0.2} max={2.0} step={0.1} value={settings.geographyDifficulty}
              onChange={e => changeSettings({ geographyDifficulty: Number(e.target.value) })}
              className={styles.slider} />

            <div className={styles.labelRow}>
              <label className={styles.label}>Productivity Influence: {settings.productivityInfluence.toFixed(1)}</label>
              <TipBtn tipKey="productivityInfluence" onClick={toggleTip} />
            </div>
            <TipBox tipKey="productivityInfluence" activeTip={activeTip} tips={TIPS} />
            <input type="range" min={0.2} max={2.0} step={0.1} value={settings.productivityInfluence}
              onChange={e => changeSettings({ productivityInfluence: Number(e.target.value) })}
              className={styles.slider} />
          </div>

          <div className={styles.section}>
            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={settings.enableSeaConquest}
                  onChange={e => changeSettings({ enableSeaConquest: e.target.checked })} />
                Sea Conquest
              </label>
              <TipBtn tipKey="enableSeaConquest" onClick={toggleTip} />
            </div>
            <TipBox tipKey="enableSeaConquest" activeTip={activeTip} tips={TIPS} />

            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={settings.enableSecession}
                  onChange={e => changeSettings({ enableSecession: e.target.checked })} />
                Secession
              </label>
              <TipBtn tipKey="enableSecession" onClick={toggleTip} />
            </div>
            <TipBox tipKey="enableSecession" activeTip={activeTip} tips={TIPS} />

            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={settings.enableCapitalDistanceUnrest}
                  onChange={e => changeSettings({ enableCapitalDistanceUnrest: e.target.checked })} />
                Capital Distance Unrest
              </label>
              <TipBtn tipKey="enableCapitalDistanceUnrest" onClick={toggleTip} />
            </div>
            <TipBox tipKey="enableCapitalDistanceUnrest" activeTip={activeTip} tips={TIPS} />

            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={settings.enableDisconnectedSplit}
                  onChange={e => changeSettings({ enableDisconnectedSplit: e.target.checked })} />
                Split Disconnected States
              </label>
              <TipBtn tipKey="enableDisconnectedSplit" onClick={toggleTip} />
            </div>
            <TipBox tipKey="enableDisconnectedSplit" activeTip={activeTip} tips={TIPS} />

            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={showEventFlashes}
                  onChange={e => setUIState(prev => ({ ...prev, showEventFlashes: e.target.checked }))}
                />
                Show conquests and secessions
              </label>
            </div>
          </div>

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
