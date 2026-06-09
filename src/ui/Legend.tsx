import { useSimulation } from '../SimulationContext';
import styles from './Legend.module.css';

const TERRAIN_COLORS: Record<string, string> = {
  ocean: '#1a3a5c', plains: '#8fa85a', river_valley: '#6db56d',
  forest: '#4a7c45', hills: '#9a8c6e', mountains: '#888888',
  desert: '#d4b483', tundra: '#c8d4e0',
};

export function Legend() {
  const { uiState, simState } = useSimulation();
  const { mapMode } = uiState;

  if (mapMode === 'terrain') {
    return (
      <div className={styles.legend}>
        {Object.entries(TERRAIN_COLORS).filter(([t]) => t !== 'ocean').map(([t, c]) => (
          <span key={t} className={styles.item}>
            <span style={{ background: c }} className={styles.swatch} />
            {t.replace('_', ' ')}
          </span>
        ))}
      </div>
    );
  }

  if (mapMode === 'political') {
    const stateCount = simState?.states.size ?? 0;
    return (
      <div className={styles.legend}>
        <span className={styles.badge}>{stateCount} states</span>
      </div>
    );
  }

  const isProductivity = mapMode === 'productivity';
  const lowColor = isProductivity ? '#1a2a1a' : '#1a1a2a';
  const highColor = isProductivity ? '#00ff88' : '#ff4444';
  const gradLabel = isProductivity ? 'Productivity' : 'Obstacle';

  return (
    <div className={styles.legend}>
      <span className={styles.gradLabel}>Low</span>
      <span className={styles.gradient} style={{
        background: `linear-gradient(to right, ${lowColor}, ${highColor})`,
      }} />
      <span className={styles.gradLabel}>High</span>
      <span className={styles.item} style={{ marginLeft: 8 }}>{gradLabel}</span>
    </div>
  );
}
