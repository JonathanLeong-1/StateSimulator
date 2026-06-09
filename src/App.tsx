import { useCallback, useState } from 'react';
import { SimulationProvider, useSimulation } from './SimulationContext';
import { MapCanvas } from './ui/MapCanvas';
import { ControlPanel } from './ui/ControlPanel';
import { StatsPanel } from './ui/StatsPanel';
import { Charts } from './ui/Charts';
import { InfoPanel } from './ui/InfoPanel';
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
  const simContext = useSimulation();

  const handleRunSimulation = useCallback((worldData: WorldData) => {
    simContext.loadCustomWorld(worldData);
    setAppMode('simulate');
  }, [simContext]);

  return (
    <div className={styles.app}>
      <header className={styles.topBar}>
        <span className={styles.appTitle}>🌍 World Simulator</span>
        <button
          className={styles.modeToggleBtn}
          onClick={() => setAppMode(m => m === 'simulate' ? 'build' : 'simulate')}
        >
          {appMode === 'simulate' ? '🗺 Map Builder' : '▶ Simulator'}
        </button>
        <Legend />
      </header>
      {appMode === 'simulate' ? (
        <div className={styles.main}>
          <ControlPanel />
          <MapCanvas />
          <div className={styles.rightColumn}>
            <StatsPanel />
            <Charts />
            <InfoPanel />
          </div>
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

