import { describe, it, expect } from 'vitest';
import { StateManager } from './StateManager';
import { mulberry32 } from './rng';
import type { SimState, SimStats } from '../types/simulation';

const dummyStats: SimStats = {
  turn: 0, year: 0, stateCount: 0, largestStateSize: 0, largestStateShare: 0,
  avgStateSize: 0, hhi: 0, conflictsThisTurn: 0, conquestsThisTurn: 0,
  secessionsThisTurn: 0, totalLandTiles: 0, continentUnificationScores: [],
};

describe('StateManager', () => {
  it('allocateState should return valid StateData', () => {
    const sm = new StateManager();
    const rng = mulberry32(1);
    const state = sm.allocateState(0, 0, rng);
    expect(state.id).toBe(0);
    expect(state.capital).toBe(0);
    expect(state.continent).toBe(0);
    expect(state.tileIndices).toBeInstanceOf(Set);
    expect(state.size).toBe(0);
    expect(state.power).toBe(0);
    expect(typeof state.color).toBe('string');
    expect(typeof state.name).toBe('string');
  });

  it('should assign distinct colors to first 40 states', () => {
    const sm = new StateManager();
    const rng = mulberry32(1);
    const colors = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const state = sm.allocateState(i, 0, rng);
      colors.add(state.color);
    }
    expect(colors.size).toBe(40);
  });

  it('releaseState should return color to pool', () => {
    const sm = new StateManager();
    const rng = mulberry32(1);
    const state1 = sm.allocateState(0, 0, rng);
    const color1 = state1.color;
    sm.allocateState(1, 0, rng); // allocate second
    sm.releaseState(state1.id);
    const state3 = sm.allocateState(2, 0, rng); // should get color1 back (LRU front)
    expect(state3.color).toBe(color1);
  });

  it('generateName for size 1 should include tribal/city tier words', () => {
    const sm = new StateManager();
    const rng = mulberry32(1);
    const tierWords = ['Tribe of', 'City of', 'Settlement', 'Clan'];
    for (let i = 0; i < 10; i++) {
      const name = sm.generateName(1, rng);
      const hasTierWord = tierWords.some(w => name.includes(w));
      expect(hasTierWord).toBe(true);
    }
  });

  it('generateName for size 10 should include kingdom tier words', () => {
    const sm = new StateManager();
    const rng = mulberry32(1);
    const tierWords = ['Kingdom of', 'League', 'Republic', 'Principality', 'Realm'];
    for (let i = 0; i < 10; i++) {
      const name = sm.generateName(10, rng);
      const hasTierWord = tierWords.some(w => name.includes(w));
      expect(hasTierWord).toBe(true);
    }
  });

  it('generateName for size 25 should include empire tier words', () => {
    const sm = new StateManager();
    const rng = mulberry32(1);
    const tierWords = ['Empire', 'Confederation', 'Great', 'Federation', 'Dominion'];
    for (let i = 0; i < 10; i++) {
      const name = sm.generateName(25, rng);
      const hasTierWord = tierWords.some(w => name.includes(w));
      expect(hasTierWord).toBe(true);
    }
  });

  it('renameState should update the name', () => {
    const sm = new StateManager();
    const rng = mulberry32(1);
    const state = sm.allocateState(0, 0, rng);
    sm.renameState(state.id, 'Test Kingdom');
    expect(state.name).toBe('Test Kingdom');
  });

  it('computeStats should return correct stateCount', () => {
    const sm = new StateManager();
    const rng = mulberry32(1);
    const s1 = sm.allocateState(0, 0, rng);
    const s2 = sm.allocateState(1, 0, rng);
    s1.size = 3;
    s2.size = 2;
    sm.setContinentLandCounts([5]);
    const simState: SimState = {
      ownership: new Int32Array(5),
      states: new Map([[s1.id, s1], [s2.id, s2]]),
      stats: dummyStats,
      turn: 0,
    };
    const stats = sm.computeStats(simState, 5);
    expect(stats.stateCount).toBe(2);
  });

  it('computeStats HHI should be 1.0 when only one state owns all tiles', () => {
    const sm = new StateManager();
    const rng = mulberry32(1);
    const state = sm.allocateState(0, 0, rng);
    state.size = 5;
    sm.setContinentLandCounts([5]);
    const simState: SimState = {
      ownership: new Int32Array(5).fill(state.id),
      states: new Map([[state.id, state]]),
      stats: dummyStats,
      turn: 0,
    };
    const stats = sm.computeStats(simState, 5);
    expect(stats.hhi).toBeCloseTo(1.0);
  });

  it('allocates different first-state colors for different colorSeeds', () => {
    const sm1 = new StateManager(1);
    const sm2 = new StateManager(999);
    const rng = mulberry32(0);
    const s1 = sm1.allocateState(0, null, rng);
    const s2 = sm2.allocateState(0, null, rng);
    expect(s1.color).not.toBe(s2.color);
  });
});
