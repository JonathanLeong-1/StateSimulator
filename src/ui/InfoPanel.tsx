import { useState } from 'react';
import { useSimulation } from '../SimulationContext';
import styles from './InfoPanel.module.css';

export function InfoPanel() {
  const { world, simState, uiState, setUIState, renameState } = useSimulation();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const { selectedStateId } = uiState;
  if (selectedStateId === null || !simState || !world) return null;

  const state = simState.states.get(selectedStateId);
  if (!state) return null;

  // Compute terrain breakdown
  const terrainCounts: Record<string, number> = {};
  for (const idx of state.tileIndices) {
    const t = world.tiles[idx]?.terrain;
    if (t) terrainCounts[t] = (terrainCounts[t] ?? 0) + 1;
  }

  const handleRename = () => {
    if (editing && nameInput.trim()) {
      renameState(selectedStateId, nameInput.trim());
    }
    setEditing(e => !e);
    setNameInput(state.name);
  };

  const deselect = () => setUIState(prev => ({ ...prev, selectedStateId: null }));

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: state.color }} />
          {editing ? (
            <input
              className={styles.nameInput}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          ) : (
            <span className={styles.name}>{state.name}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={styles.smallBtn} onClick={handleRename} aria-label={editing ? 'Confirm rename' : 'Rename state'}>
            {editing ? '✓' : '✎'}
          </button>
          <button className={styles.smallBtn} onClick={deselect} aria-label="Deselect state">✕</button>
        </div>
      </div>

      <div className={styles.grid}>
        <span className={styles.label}>ID</span><span className={styles.value}>{state.id}</span>
        <span className={styles.label}>Continent</span><span className={styles.value}>{state.continent !== null ? state.continent + 1 : '—'}</span>
        <span className={styles.label}>Size</span><span className={styles.value}>{state.size} tiles</span>
        <span className={styles.label}>Power</span><span className={styles.value}>{state.power.toFixed(2)}</span>
        <span className={styles.label}>Capital</span><span className={styles.value}>#{state.capital}</span>
      </div>

      <div className={styles.terrains}>
        {Object.entries(terrainCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
          <span key={t} className={styles.terrain}>{t}: {n}</span>
        ))}
      </div>
    </div>
  );
}
