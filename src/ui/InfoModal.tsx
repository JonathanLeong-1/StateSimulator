import styles from '../styles/InfoModal.module.css';

interface Props {
  onClose: () => void;
}

export function InfoModal({ onClose }: Props) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>How World Simulator Works</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Overview</h3>
            <p className={styles.text}>
              World Simulator is a turn-based political geography engine. Each turn, states on a hex-grid world
              compete for territory through conquest and internal fracture. Watch empires rise, consolidate,
              and collapse in real time.
            </p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Turns &amp; Time</h3>
            <p className={styles.text}>
              Each turn represents one unit of simulated time (~5 years by default). Every turn executes four phases in order:
            </p>
            <ol className={styles.list}>
              <li><strong>Conflict proposals</strong> — productive border tiles roll for attacks against neighbouring states.</li>
              <li><strong>Conflict resolution</strong> — attacker and defender power are compared; terrain and settings modify the outcome.</li>
              <li><strong>Secession</strong> — border tiles far from their capital may break away and form new micro-states.</li>
              <li><strong>Stats update</strong> — HHI, state counts, continent unification, and chart history are recalculated.</li>
            </ol>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>States &amp; Power</h3>
            <p className={styles.text}>
              Every land tile begins as its own independent city-state. States grow by conquering adjacent tiles.
              A state's <strong>Power</strong> is the sum of productivity across all tiles it controls —
              larger, more fertile states win conflicts more often. Power is recalculated every turn.
            </p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Conflict Logic</h3>
            <p className={styles.text}>
              An attacker tile rolls against a defender tile. The base probability favours the side with higher
              power, modified by:
            </p>
            <ul className={styles.list}>
              <li><strong>Terrain obstacle</strong> — mountains and hills reduce attacker success chance.</li>
              <li><strong>Geography Difficulty</strong> — amplifies terrain penalties globally.</li>
              <li><strong>Productivity Influence</strong> — scales how much tile fertility boosts power.</li>
              <li><strong>Conflict Frequency</strong> — how many border tiles propose attacks each turn.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Terrain &amp; Productivity</h3>
            <p className={styles.text}>
              Each tile has a terrain type that determines its base productivity and obstacle score:
            </p>
            <ul className={styles.list}>
              <li><strong>River Valley</strong> (~0.93 prod) — most fertile, easiest to hold.</li>
              <li><strong>Plains</strong> (~0.70 prod) — productive and low obstacle.</li>
              <li><strong>Forest</strong> (~0.53 prod) — moderate fertility, some obstacle.</li>
              <li><strong>Hills</strong> (~0.40 prod) — lower fertility, higher obstacle.</li>
              <li><strong>Desert / Tundra</strong> (~0.15–0.18 prod) — sparse, hard to project power from.</li>
              <li><strong>Mountains</strong> (~0.15 prod) — very high obstacle; effective natural borders.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Sea Conquest</h3>
            <p className={styles.text}>
              When enabled, coastal states can project power across narrow bodies of water to nearby coastlines.
              Each potential crossing rolls against the Sea Conquest Chance setting. Successful crossings are
              shown as animated arcs in the political view.
            </p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Secession &amp; Fragmentation</h3>
            <p className={styles.text}>
              Large empires are inherently unstable. Border tiles far from their state's capital accumulate
              unrest and may secede — forming a new independent state. If a state's territory becomes
              geographically disconnected (e.g. split by a rival conquest), each piece can become independent.
            </p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>HHI — Fragmentation Index</h3>
            <p className={styles.text}>
              The <strong>Herfindahl-Hirschman Index (HHI)</strong> measures political concentration.
              A high HHI (→ 1.0) means one state dominates most of the land. A low HHI (→ 0) means
              many small equal-sized states. Watch it fall as empires form and spike as they collapse.
            </p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Map Modes</h3>
            <ul className={styles.list}>
              <li><strong>Political</strong> — state colour fill with bold borders and name labels.</li>
              <li><strong>Terrain</strong> — raw terrain type with state colour tint overlay.</li>
              <li><strong>Productivity</strong> — green heatmap showing tile fertility.</li>
              <li><strong>Obstacle</strong> — red heatmap showing how hard each tile is to conquer.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Map Builder</h3>
            <p className={styles.text}>
              Design your own world from scratch using paint tools, then launch the full simulation on it.
              Each brush stroke is a single undo step. Use Ctrl+Z to undo strokes.
            </p>
          </section>

        </div>

        <div className={styles.footer}>
          <button className={styles.footerBtn} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
