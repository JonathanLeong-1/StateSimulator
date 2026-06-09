import { useSimulation } from '../SimulationContext';
import styles from '../styles/StatsPanel.module.css';

export function StatsPanel() {
  const { simState, world } = useSimulation();
  if (!simState || !world) return <div className={styles.panel}><p className={styles.muted}>Loading…</p></div>;

  const { stats } = simState;

  const hhiColor = stats.hhi > 0.3 ? '#ff6b6b' : stats.hhi > 0.1 ? '#ffd700' : '#00ff88';

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Statistics</h3>
      <div className={styles.grid}>
        <span className={styles.label}>Turn</span>
        <span className={styles.value}>{stats.turn}</span>

        <span className={styles.label}>Year</span>
        <span className={styles.value}>{stats.year}</span>

        <span className={styles.label}>States</span>
        <span className={styles.value}>{stats.stateCount}</span>

        <span className={styles.label}>Largest State</span>
        <span className={styles.value}>{stats.largestStateSize} ({(stats.largestStateShare * 100).toFixed(1)}%)</span>

        <span className={styles.label}>Avg Size</span>
        <span className={styles.value}>{stats.avgStateSize.toFixed(1)}</span>

        <span className={styles.label}>HHI</span>
        <span className={styles.value} style={{ color: hhiColor }}>{stats.hhi.toFixed(4)}</span>

        <span className={styles.label}>Conflicts</span>
        <span className={styles.value}>{stats.conflictsThisTurn}</span>

        <span className={styles.label}>Conquests</span>
        <span className={styles.value}>{stats.conquestsThisTurn}</span>

        <span className={styles.label}>Secessions</span>
        <span className={styles.value}>{stats.secessionsThisTurn}</span>

        <span className={styles.label}>Land Tiles</span>
        <span className={styles.value}>{stats.totalLandTiles}</span>
      </div>

      {stats.continentUnificationScores.length > 0 && (
        <div className={styles.continents}>
          <span className={styles.sectionTitle}>Continent Unification</span>
          {stats.continentUnificationScores.map((score, i) => (
            <div key={i} className={styles.contRow}>
              <span className={styles.label}>Continent {i + 1}</span>
              <span className={styles.value}>{(score * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
