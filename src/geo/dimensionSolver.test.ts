import { describe, it, expect } from 'vitest';
import {
  solveDimensions,
  projectedExtent,
  solveDimensionsForBbox,
  clampHexBudget,
  HEX_ASPECT_FACTOR,
  DEFAULT_HEX_BUDGET,
  MAX_HEX_BUDGET,
  MIN_HEX_BUDGET,
} from './dimensionSolver';

const SQRT3 = Math.sqrt(3);

/** Physical (rendered) aspect of a flat-top offset hex grid. */
function physicalAspect(width: number, height: number): number {
  return (width * 1.5) / (height * SQRT3);
}

describe('solveDimensions', () => {
  it.each([
    [1, DEFAULT_HEX_BUDGET],
    [2, DEFAULT_HEX_BUDGET],
    [0.5, DEFAULT_HEX_BUDGET],
    [2.05, MAX_HEX_BUDGET],
    [3, 16_000],
  ])('should hit budget N within ±5%% for aspect %f, N=%i', (aspect, n) => {
    const { width, height } = solveDimensions(aspect, n);
    const product = width * height;
    expect(product).toBeGreaterThan(n * 0.95);
    expect(product).toBeLessThan(n * 1.05);
  });

  it.each([
    [1, DEFAULT_HEX_BUDGET],
    [2, DEFAULT_HEX_BUDGET],
    [0.5, DEFAULT_HEX_BUDGET],
  ])('should match the projected aspect %f physically', (aspect, n) => {
    const { width, height } = solveDimensions(aspect, n);
    expect(physicalAspect(width, height)).toBeCloseTo(aspect, 1);
  });

  it('should clamp both dimensions to at least 8 for tiny budgets', () => {
    const { width, height } = solveDimensions(1, 1);
    expect(width).toBeGreaterThanOrEqual(8);
    expect(height).toBeGreaterThanOrEqual(8);
  });

  it('should fall back to square-ish dims for a non-positive aspect', () => {
    const { width, height } = solveDimensions(0, DEFAULT_HEX_BUDGET);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it('should expose the documented hex aspect factor 2/√3', () => {
    expect(HEX_ASPECT_FACTOR).toBeCloseTo(1.1547, 4);
  });

  it('should export the documented budget constants', () => {
    expect(DEFAULT_HEX_BUDGET).toBe(40_000);
    expect(MAX_HEX_BUDGET).toBe(64_000);
    expect(MIN_HEX_BUDGET).toBe(4_000);
  });
});

describe('solveDimensions over real region bounding boxes', () => {
  const REGIONS: Array<[string, { lonMin: number; latMin: number; lonMax: number; latMax: number }]> = [
    ['Eurasia (wide)', { lonMin: -10, latMin: 10, lonMax: 150, latMax: 75 }],
    ['Americas (tall)', { lonMin: -130, latMin: -55, lonMax: -35, latMax: 70 }],
    ['Switzerland (small)', { lonMin: 6, latMin: 45.8, lonMax: 10.5, latMax: 47.8 }],
    ['World', { lonMin: -180, latMin: -90, lonMax: 180, latMax: 90 }],
  ];

  it.each(REGIONS)('should hit the budget within ±5%% for %s', (_name, bbox) => {
    const { dimensions } = solveDimensionsForBbox(bbox, DEFAULT_HEX_BUDGET);
    const product = dimensions.width * dimensions.height;
    expect(product).toBeGreaterThan(DEFAULT_HEX_BUDGET * 0.95);
    expect(product).toBeLessThan(DEFAULT_HEX_BUDGET * 1.05);
  });

  it.each(REGIONS)('should match the projected aspect physically for %s', (_name, bbox) => {
    const { dimensions, extent } = solveDimensionsForBbox(bbox, DEFAULT_HEX_BUDGET);
    const physical = physicalAspect(dimensions.width, dimensions.height);
    // Rounding to integer grid dims introduces small error; 1 decimal is ample.
    expect(physical).toBeCloseTo(extent.aspect, 1);
  });

  it('should clamp both dims to ≥8 for a tiny budget over a real bbox', () => {
    const { dimensions } = solveDimensionsForBbox(
      { lonMin: 6, latMin: 45.8, lonMax: 10.5, latMax: 47.8 },
      1,
    );
    expect(dimensions.width).toBeGreaterThanOrEqual(8);
    expect(dimensions.height).toBeGreaterThanOrEqual(8);
  });
});

describe('projectedExtent', () => {
  it('should yield a world aspect near 2.0 for the full globe', () => {
    const ext = projectedExtent({ lonMin: -180, latMin: -90, lonMax: 180, latMax: 90 });
    expect(ext.aspect).toBeGreaterThan(1.8);
    expect(ext.aspect).toBeLessThan(2.3);
    expect(ext.width).toBeGreaterThan(0);
    expect(ext.height).toBeGreaterThan(0);
  });

  it('should produce a wider-than-tall extent for a wide equatorial box', () => {
    const ext = projectedExtent({ lonMin: -60, latMin: -5, lonMax: 60, latMax: 5 });
    expect(ext.aspect).toBeGreaterThan(1);
  });
});

describe('solveDimensionsForBbox', () => {
  it('should produce a budget-consistent grid for a real region', () => {
    const { dimensions } = solveDimensionsForBbox(
      { lonMin: -19, latMin: -35, lonMax: 52, latMax: 38 },
      DEFAULT_HEX_BUDGET,
    );
    const product = dimensions.width * dimensions.height;
    expect(product).toBeGreaterThan(DEFAULT_HEX_BUDGET * 0.9);
    expect(product).toBeLessThan(DEFAULT_HEX_BUDGET * 1.1);
  });
});

describe('clampHexBudget', () => {
  it('should clamp below the minimum up to MIN_HEX_BUDGET', () => {
    expect(clampHexBudget(10)).toBe(MIN_HEX_BUDGET);
  });

  it('should clamp above the maximum down to MAX_HEX_BUDGET', () => {
    expect(clampHexBudget(1_000_000)).toBe(MAX_HEX_BUDGET);
  });

  it('should pass through an in-range budget', () => {
    expect(clampHexBudget(DEFAULT_HEX_BUDGET)).toBe(DEFAULT_HEX_BUDGET);
  });

  it('should fall back to the default for a non-finite budget', () => {
    expect(clampHexBudget(Number.NaN)).toBe(DEFAULT_HEX_BUDGET);
  });
});
