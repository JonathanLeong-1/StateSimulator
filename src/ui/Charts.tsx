import { useSimulation } from '../SimulationContext';
import type { ChartDataPoint } from '../types/ui';
import styles from '../styles/Charts.module.css';

interface LineChartProps {
  data: ChartDataPoint[];
  getValue: (p: ChartDataPoint) => number;
  color: string;
  label: string;
  yMax?: number;
}

function LineChart({ data, getValue, color, label, yMax }: LineChartProps) {
  const W = 280;
  const H = 120;
  const PAD = { top: 8, right: 8, bottom: 20, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  if (data.length < 2) {
    return (
      <svg width={W} height={H} className={styles.svg}>
        <text x={PAD.left + chartW / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={11}>{label}</text>
      </svg>
    );
  }

  const values = data.map(getValue);
  const maxV = yMax ?? Math.max(...values, 1);
  const minV = 0;

  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => PAD.top + chartH - ((v - minV) / (maxV - minV || 1)) * chartH;

  const pathD = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: toY(minV + f * (maxV - minV)),
    label: (minV + f * (maxV - minV)).toFixed(maxV > 10 ? 0 : 2),
  }));

  return (
    <svg width={W} height={H} className={styles.svg}>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={g.y} x2={PAD.left + chartW} y2={g.y} stroke="#2d3748" strokeWidth={0.5} />
          <text x={PAD.left - 4} y={g.y + 3.5} textAnchor="end" fill="#94a3b8" fontSize={9}>{g.label}</text>
        </g>
      ))}
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} />
      <text x={PAD.left + 4} y={PAD.top + 10} fill={color} fontSize={10} fontWeight="600">{label}</text>
    </svg>
  );
}

export function Charts() {
  const { uiState } = useSimulation();
  const { chartHistory } = uiState;

  return (
    <div className={styles.container}>
      <LineChart data={chartHistory} getValue={p => p.stateCount} color="#4f9eff" label="States" />
      <LineChart data={chartHistory} getValue={p => p.largestStateShare * 100} color="#48bb78" label="Largest %" yMax={100} />
      <LineChart data={chartHistory} getValue={p => p.hhi} color="#ed8936" label="HHI" yMax={1} />
    </div>
  );
}
