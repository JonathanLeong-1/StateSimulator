import { describe, it, expect } from 'vitest';
import { WorldGenerator } from './WorldGenerator';
import { SimulationEngine } from './SimulationEngine';

const config = { width: 30, height: 20, seed: 123, seaConquestRadius: 3 };
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

describe('SimulationEngine', () => {
  it('initialize should create one state per land tile', () => {
    const world = new WorldGenerator().generate(config);
    const engine = new SimulationEngine(world, defaultSettings);
    engine.initialize();
    const state = engine.getState();
    expect(state.states.size).toBe(world.totalLandTiles);
  });

  it('ownership array should have no -1 for land tiles after initialize', () => {
    const world = new WorldGenerator().generate(config);
    const engine = new SimulationEngine(world, defaultSettings);
    engine.initialize();
    const state = engine.getState();
    for (let i = 0; i < world.tiles.length; i++) {
      if (world.tiles[i].terrain !== 'ocean') {
        expect(state.ownership[i]).not.toBe(-1);
      }
    }
  });

  it('step should reduce state count over 100 turns', () => {
    const world = new WorldGenerator().generate(config);
    const engine = new SimulationEngine(world, defaultSettings);
    engine.initialize();
    const initialCount = engine.getState().stats.stateCount;
    for (let i = 0; i < 100; i++) engine.step();
    expect(engine.getState().stats.stateCount).toBeLessThan(initialCount);
  });

  it('turn counter should increment on each step', () => {
    const world = new WorldGenerator().generate(config);
    const engine = new SimulationEngine(world, defaultSettings);
    engine.initialize();
    expect(engine.getState().turn).toBe(0);
    engine.step();
    expect(engine.getState().turn).toBe(1);
    engine.step();
    expect(engine.getState().turn).toBe(2);
  });

  it('serialize/deserialize should round-trip correctly', () => {
    const world = new WorldGenerator().generate(config);
    const engine = new SimulationEngine(world, defaultSettings);
    engine.initialize();
    for (let i = 0; i < 5; i++) engine.step();
    const json = engine.serialize();
    engine.deserialize(json);
    expect(engine.getState().turn).toBe(5);
  });

  it('stats.hhi should be between 0 and 1', () => {
    const world = new WorldGenerator().generate(config);
    const engine = new SimulationEngine(world, defaultSettings);
    engine.initialize();
    engine.step();
    const stats = engine.getState().stats;
    expect(stats.hhi).toBeGreaterThanOrEqual(0);
    expect(stats.hhi).toBeLessThanOrEqual(1);
  });

  it('stats.totalLandTiles should equal world.totalLandTiles', () => {
    const world = new WorldGenerator().generate(config);
    const engine = new SimulationEngine(world, defaultSettings);
    engine.initialize();
    expect(engine.getState().stats.totalLandTiles).toBe(world.totalLandTiles);
  });

  it('step() called 100 times should advance turn by exactly 100', () => {
    const world = new WorldGenerator().generate({ width: 160, height: 100, seed: 42, seaConquestRadius: 4 });
    const engine = new SimulationEngine(world, defaultSettings);
    engine.initialize();
    expect(engine.getState().turn).toBe(0);
    for (let i = 0; i < 100; i++) {
      engine.step();
    }
    expect(engine.getState().turn).toBe(100);
  });

  it('produces different results on two runs with no explicit seed', () => {
    const world = new WorldGenerator().generate({ width: 10, height: 10, seed: 1, seaConquestRadius: 2 });
    const e1 = new SimulationEngine(world, defaultSettings);
    const e2 = new SimulationEngine(world, defaultSettings);
    e1.initialize(); e2.initialize();
    for (let i = 0; i < 10; i++) { e1.step(); e2.step(); }
    const o1 = Array.from(e1.getState().ownership);
    const o2 = Array.from(e2.getState().ownership);
    // Statistically near-certain to differ; extremely unlikely to be identical
    expect(o1).not.toEqual(o2);
  });

  it('produces identical results when given the same explicit seed', () => {
    const world = new WorldGenerator().generate({ width: 10, height: 10, seed: 1, seaConquestRadius: 2 });
    const e1 = new SimulationEngine(world, defaultSettings, 9999);
    const e2 = new SimulationEngine(world, defaultSettings, 9999);
    e1.initialize(); e2.initialize();
    for (let i = 0; i < 10; i++) { e1.step(); e2.step(); }
    expect(Array.from(e1.getState().ownership)).toEqual(Array.from(e2.getState().ownership));
  });
});
