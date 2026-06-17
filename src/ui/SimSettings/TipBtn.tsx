import styles from '../../styles/SimSettings.module.css';

interface TipBtnProps {
  tipKey: string;
  onClick: (key: string, e: React.MouseEvent) => void;
}

export function TipBtn({ tipKey, onClick }: TipBtnProps) {
  return (
    <button
      className={styles.tipBtn}
      onClick={e => onClick(tipKey, e)}
      aria-label={`Info for ${tipKey}`}
      type="button"
    >
      ⓘ
    </button>
  );
}
