import { useSimulation } from '../SimulationContext';

export function Tooltip() {
  const { world, simState, uiState } = useSimulation();
  const { hoveredTileIndex } = uiState;

  if (hoveredTileIndex === null || !world || !simState) return null;

  const tile = world.tiles[hoveredTileIndex];
  if (!tile) return null;

  const stateId = simState.ownership[hoveredTileIndex];
  const state = stateId >= 0 ? simState.states.get(stateId) : undefined;

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(26,31,46,0.97)',
      border: '1px solid #2d3748',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      color: '#e2e8f0',
      pointerEvents: 'none',
      zIndex: 100,
      whiteSpace: 'nowrap',
      display: 'flex',
      gap: 16,
    }}>
      <span><b>Terrain:</b> {tile.terrain}</span>
      <span><b>Productivity:</b> {tile.productivity.toFixed(2)}</span>
      <span><b>Obstacle:</b> {tile.obstacle.toFixed(2)}</span>
      {state && <>
        <span><b>State:</b> {state.name}</span>
        <span><b>Size:</b> {state.size}</span>
        <span><b>Power:</b> {state.power.toFixed(2)}</span>
      </>}
    </div>
  );
}
