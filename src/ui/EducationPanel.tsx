import { useState, useEffect } from 'react';
import styles from './EducationPanel.module.css';

const TIPS = [
  'Fertile areas generate stronger states.',
  'Mountains and deserts slow conquest.',
  'Large states with long frontiers fragment more easily.',
  'Seas make cross-continental conquest rare.',
  'The Herfindahl index measures political concentration — higher means more fragmented.',
  'Productivity influences which states initiate conflict.',
  'The Geography Difficulty slider amplifies terrain barriers.',
];

export function EducationPanel() {
  const [tipIndex, setTipIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setTipIndex(i => (i + 1) % TIPS.length);
        setVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.bar}>
      <span className={styles.icon}>💡</span>
      <span className={styles.tip} style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}>
        {TIPS[tipIndex]}
      </span>
    </div>
  );
}
