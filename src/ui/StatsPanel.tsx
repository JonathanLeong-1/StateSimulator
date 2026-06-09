import { useState } from 'react';
import { useSimulation } from '../SimulationContext';
import styles from '../styles/StatsPanel.module.css';

export function StatsPanel() {
  const { simState, world } = useSimulation();
  // Outer collapse: default expanded
  const [collapsed, setCollapsed] = useState(false);
  // Inner stats grid: default collapsed
  const [statsOpen, setStatsOpen] = useState(false);

  if (!simState || !world) {
    return (
      <div className={styles.panel}>
        <div className={styles.header} onClick={() => setCollapsed(c => !c)}>
          <span className={styles.headerTitle}>Top States</span>
          <span className={styles.headerIcon}>{collapsed ? '▶' : '▼'}</span>
        </div>
        {!collapsed && <p className={styles.muted}>Loading…</p>}
      </div>
    );
  }

  const { stats } = simState;
  const hhiColor = stats.hhi > 0.3 ? '#ff6b6b' : stats.hhi > 0.1 ? '#ffd700' : '#00ff88';

  const topStates = Array.from(simState.states.values())
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  return (
    <div className={styles.panel}>
      {/* Outer header — collapses everything */}
      <div className={styles.header} onClick={() => setCollapsed(c => !c)}>
        <span className={styles.headerTitle}>Top States</span>
        <span className={styles.headerIcon}>{collapsed ? '▶' : '▼'}</span>
      </div>

      {!collapsed && (
        <div className={styles.body}>
          {/* Leaderboard */}
          <div className={styles.leaderboard}>
            {topStates.map((state, i) => (
              <div key={state.id} className={styles.lbRow}>
                <span className={styles.lbRank}>{i + 1}</span>
                <span className={styles.lbSwatch} style={{ background: state.color }} />
                <span className={styles.lbName}>{state.name}</span>
                <span className={styles.lbTiles}>{state.size}</span>
                <span className={styles.lbPct}>
                  {(state.size / stats.totalLandTiles * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>

          {/* Inner stats toggle */}
          <div className={styles.statsToggle} onClick={e => { e.stopPropagation(); setStatsOpen(o => !o); }}>
            <span>{statsOpen ? '▼' : '▶'} Statistics</span>
          </div>

          {statsOpen && (
            <div className={styles.statsGrid}>
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
          )}
        </div>
      )}
    </div>
  );
}
