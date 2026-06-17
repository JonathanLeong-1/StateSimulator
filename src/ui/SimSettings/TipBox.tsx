import styles from '../../styles/SimSettings.module.css';

interface TipBoxProps {
  tipKey: string;
  activeTip: string | null;
  tips: Record<string, string>;
}

export function TipBox({ tipKey, activeTip, tips }: TipBoxProps) {
  return activeTip === tipKey ? (
    <div className={styles.tipBox}>{tips[tipKey]}</div>
  ) : null;
}
