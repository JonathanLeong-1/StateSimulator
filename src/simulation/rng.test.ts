import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng';

describe('mulberry32', () => {
  it('should return values in [0, 1) when called repeatedly', () => {
    const rand = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('should be deterministic — same seed produces same sequence', () => {
    const rand1 = mulberry32(12345);
    const rand2 = mulberry32(12345);
    for (let i = 0; i < 50; i++) {
      expect(rand1()).toBe(rand2());
    }
  });

  it('should produce different sequences when given different seeds', () => {
    const rand1 = mulberry32(1);
    const rand2 = mulberry32(2);
    const seq1 = Array.from({ length: 10 }, () => rand1());
    const seq2 = Array.from({ length: 10 }, () => rand2());
    expect(seq1).not.toEqual(seq2);
  });

  it('should produce a valid sequence when seed is 0', () => {
    const rand = mulberry32(0);
    const v = rand();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});
