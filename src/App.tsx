import { useCallback, useState } from 'react';
import { SimulationProvider, useSimulation } from './SimulationContext';
import { MapCanvas } from './ui/MapCanvas';
import { BottomBar } from './ui/BottomBar';
import { SimSettings } from './ui/SimSettings';
import { StatsPanel } from './ui/StatsPanel';
import { InfoPanel } from './ui/InfoPanel';
import { WelcomeSplash } from './ui/WelcomeSplash';
import { InfoModal } from './ui/InfoModal';
import { Tooltip } from './ui/Tooltip';
import { EducationPanel } from './ui/EducationPanel';
import { Legend } from './ui/Legend';
import { MapBuilderProvider } from './ui/mapbuilder/MapBuilderContext';
import { MapBuilderPanel } from './ui/mapbuilder/MapBuilderPanel';
import { MapBuilderCanvas } from './ui/mapbuilder/MapBuilderCanvas';
import type { WorldData } from './types/world';
import styles from './styles/App.module.css';

function AppInner() {
  const [appMode, setAppMode] = useState<'simulate' | 'build'>('simulate');
  const [showSplash, setShowSplash] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const simContext = useSimulation();

  const handleRunSimulation = useCallback((worldData: WorldData) => {
    simContext.loadCustomWorld(worldData);
    setAppMode('simulate');
  }, [simContext]);

  const handleDismissSplash = useCallback(() => {
    setShowSplash(false);
    simContext.loadEurasia();
    simContext.setUIState(prev => ({ ...prev, isPlaying: false, speed: 300 }));
  }, [simContext]);

  return (
    <div className={styles.app}>
      <header className={styles.topBar}>
        <span className={styles.appTitle}>🌍 State Simulator</span>
        <button
          className={styles.modeToggleBtn}
          onClick={() => setAppMode(m => m === 'simulate' ? 'build' : 'simulate')}
        >
          {appMode === 'simulate' ? '🗺 Map Builder' : '▶ Simulator'}
        </button>
        <Legend />
        <div className={styles.headerRight}>
          {simContext.simState && (
            <span className={styles.stateCounter}>
              {simContext.simState.stats.stateCount} states
            </span>
          )}
          <button
            className={styles.infoBtn}
            onClick={() => setShowInfo(true)}
            aria-label="How it works"
          >
            ℹ
          </button>
        </div>
      </header>
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      {appMode === 'simulate' ? (
        <div className={styles.main}>
          <MapCanvas />
          <SimSettings />
          <StatsPanel />
          <InfoPanel />
          {showSplash && <WelcomeSplash onDismiss={handleDismissSplash} />}
          <BottomBar />
        </div>
      ) : (
        <MapBuilderProvider>
          <div className={styles.builderMain}>
            <MapBuilderPanel onRunSimulation={handleRunSimulation} />
            <MapBuilderCanvas />
          </div>
        </MapBuilderProvider>
      )}
      <EducationPanel />
      <Tooltip />
    </div>
  );
}

function App() {
  return (
    <SimulationProvider>
      <AppInner />
    </SimulationProvider>
  );
}

export default App;

