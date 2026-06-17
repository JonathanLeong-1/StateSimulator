import { describe, it, expect } from 'vitest';
import { WorldGenerator } from './WorldGenerator';
import { SimulationEngine } from './SimulationEngine';
import { gridForBudget, MAX_HEX_BUDGET } from '../geo/dimensionSolver';

const defaultSettings = {
  baseConflictRate: 0.3,
  seaConquestChance: 0.1,
  secessionRate: 0.3,
  geographyDifficulty: 1.0,
  productivityInfluence: 1.0,
  enableSeaConquest: true,
  enableSecession: true,
  enableCapitalDistanceUnrest: true,
  enableDisconnectedSplit: true,
};

/**
 * Performance validation for the variable-grid hex budget (architecture §8).
 *
 * Proves that a MAX_HEX_BUDGET (64k) world generates, initializes, and steps
 * without errors and within a generous wall-clock budget. The budget is loose
 * on purpose (CI machines vary widely) — the goal is to catch pathological
 * regressions, not to benchmark exact throughput. Measured step timing is
 * printed for the developer log / architect review.
 */
describe('SimulationEngine performance at MAX_HEX_BUDGET', () => {
  it('generates and steps a 64k-tile world without errors', () => {
    const { width, height } = gridForBudget(MAX_HEX_BUDGET);
    expect(width * height).toBeGreaterThan(MAX_HEX_BUDGET * 0.95);

    const genStart = performance.now();
    const world = new WorldGenerator().generate({ width, height, seed: 42, seaConquestRadius: 4 });
    const engine = new SimulationEngine(world, defaultSettings);
    engine.initialize();
    const genMs = performance.now() - genStart;

    const STEPS = 50;
    const stepStart = performance.now();
    for (let i = 0; i < STEPS; i++) engine.step();
    const stepTotalMs = performance.now() - stepStart;
    const msPerStep = stepTotalMs / STEPS;

    // Surface the numbers for the developer log / architect review.
    console.log(
      `[perf] 64k world (${width}x${height}=${width * height}): gen+init ${genMs.toFixed(0)}ms, ` +
      `${STEPS} steps ${stepTotalMs.toFixed(0)}ms (${msPerStep.toFixed(1)}ms/step)`,
    );

    expect(engine.getState().turn).toBe(STEPS);
    // Generous ceiling: 50 steps of a 64k world must finish well under 30s on CI.
    expect(stepTotalMs).toBeLessThan(30_000);
  });
});
