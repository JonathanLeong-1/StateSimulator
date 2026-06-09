import { useEffect } from 'react';
import { useSimulation } from '../SimulationContext';
import styles from '../styles/WelcomeSplash.module.css';

interface Props {
  onDismiss: () => void;
}

export function WelcomeSplash({ onDismiss }: Props) {
  const { setUIState } = useSimulation();

  // Start playing slowly while splash is shown
  useEffect(() => {
    setUIState(prev => ({ ...prev, isPlaying: true, speed: 900 }));
  }, [setUIState]);

  return (
    <div className={styles.overlay} onClick={onDismiss}>
      <div className={styles.card}>
        <div className={styles.title}>Welcome!</div>
        <p className={styles.subtitle}>
          Watch civilizations rise and fall in real time — a procedural political
          simulator where states conquer, fragment, and reform across a living world map.
        </p>
        <span className={styles.hint}>Click anywhere to begin</span>
      </div>
    </div>
  );
}
