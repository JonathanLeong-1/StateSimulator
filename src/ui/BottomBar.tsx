import { useSimulation } from '../SimulationContext';
import styles from '../styles/BottomBar.module.css';

export function BottomBar() {
  const { uiState, setUIState, playPause, stepOnce, stepN } = useSimulation();
  const { isPlaying, speed, mapMode } = uiState;

  // Inverted: slider value 100 = fastest (50ms), value 0 = slowest (2000ms)
  const toSlider = (ms: number) =>
    100 - Math.round((Math.log(ms) - Math.log(50)) / (Math.log(2000) - Math.log(50)) * 100);
  const fromSlider = (v: number) =>
    Math.round(Math.exp(Math.log(50) + ((100 - v) / 100) * (Math.log(2000) - Math.log(50))));

  return (
    <div className={styles.bar}>
      {/* Left: Step + Speed */}
      <div className={styles.colLeft}>
        <div className={styles.stepRow}>
          <button className={styles.btn} onClick={stepOnce} disabled={isPlaying}>⏭ Step</button>
          <button className={styles.btn} onClick={() => stepN(100)} disabled={isPlaying}>⏭×100</button>
        </div>
        <div className={styles.speedRow}>
          <span className={styles.speedLabelSlow}>Slow</span>
          <input
            type="range" min={0} max={100} step={1}
            value={toSlider(speed)}
            onChange={e => setUIState(prev => ({ ...prev, speed: fromSlider(Number(e.target.value)) }))}
            className={styles.speedSlider}
          />
          <span className={styles.speedLabelFast}>Fast</span>
        </div>
      </div>

      {/* Center: Play/Pause */}
      <div className={styles.colCenter}>
        <button className={styles.primaryBtn} onClick={playPause}>
          {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
      </div>

      {/* Right: View mode 2×2 */}
      <div className={styles.colRight}>
        <span className={styles.viewModeLabel}>View Mode</span>
        <div className={styles.modeGrid}>
          {(['political', 'terrain', 'productivity', 'obstacle'] as const).map(mode => (
            <button
              key={mode}
              className={mapMode === mode ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => setUIState(prev => ({ ...prev, mapMode: mode }))}
            >
              {mode === 'political' ? 'Political'
               : mode === 'terrain' ? 'Terrain'
               : mode === 'productivity' ? 'Productivity'
               : 'Obstacle'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
