import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MapBuilderProvider, useMapBuilder } from './MapBuilderContext';
import { DEFAULT_GRID, MAX_HEX_BUDGET, MIN_DIM } from '../../geo/dimensionSolver';

function setup() {
  return renderHook(() => useMapBuilder(), { wrapper: MapBuilderProvider });
}

describe('MapBuilderContext setDimensions', () => {
  it('starts at the default grid with width*height tiles', () => {
    const { result } = setup();
    expect(result.current.state.width).toBe(DEFAULT_GRID.width);
    expect(result.current.state.height).toBe(DEFAULT_GRID.height);
    expect(result.current.state.tiles).toHaveLength(DEFAULT_GRID.width * DEFAULT_GRID.height);
  });

  it('resizes to a fresh blank map with width*height ocean tiles', () => {
    const { result } = setup();
    act(() => result.current.setDimensions(80, 60));
    expect(result.current.state.width).toBe(80);
    expect(result.current.state.height).toBe(60);
    expect(result.current.state.tiles).toHaveLength(80 * 60);
    expect(result.current.state.tiles.every(t => t.terrain === 'ocean')).toBe(true);
    // tile coordinates derive from the new width
    expect(result.current.state.tiles[81]).toMatchObject({ q: 1, r: 1 });
  });

  it('clamps each axis to at least MIN_DIM', () => {
    const { result } = setup();
    act(() => result.current.setDimensions(2, 1));
    expect(result.current.state.width).toBe(MIN_DIM);
    expect(result.current.state.height).toBe(MIN_DIM);
    expect(result.current.state.tiles).toHaveLength(MIN_DIM * MIN_DIM);
  });

  it('shrinks proportionally so the total never exceeds MAX_HEX_BUDGET', () => {
    const { result } = setup();
    act(() => result.current.setDimensions(1000, 1000));
    const { width, height } = result.current.state;
    expect(width * height).toBeLessThanOrEqual(MAX_HEX_BUDGET);
    expect(width).toBeGreaterThanOrEqual(MIN_DIM);
    expect(height).toBeGreaterThanOrEqual(MIN_DIM);
    expect(result.current.state.tiles).toHaveLength(width * height);
  });

  it('preserves the requested aspect when shrinking an over-budget request (400×200 ⇒ ~2:1)', () => {
    const { result } = setup();
    // 400×200 = 80k hexes exceeds the 64k cap and must shrink while keeping ~2:1.
    act(() => result.current.setDimensions(400, 200));
    const { width, height } = result.current.state;
    expect(width * height).toBeLessThanOrEqual(MAX_HEX_BUDGET);
    // Requested aspect 2.0 preserved within rounding tolerance.
    expect(width / height).toBeCloseTo(2, 1);
    expect(result.current.state.tiles).toHaveLength(width * height);
  });

  it('resets undo history on resize so a prior stroke cannot be undone', () => {
    const { result } = setup();
    // Paint something on the default grid, producing an undoable history entry.
    act(() => {
      result.current.beginStroke();
      result.current.applyBrush(0);
    });
    expect(result.current.state.tiles[0].terrain).not.toBe('ocean');
    // Resize discards content and history.
    act(() => result.current.setDimensions(80, 60));
    const afterResize = result.current.state.tiles;
    // Undo must be a no-op now (history was cleared) — map stays blank at new size.
    act(() => result.current.undo());
    expect(result.current.state.width).toBe(80);
    expect(result.current.state.height).toBe(60);
    expect(result.current.state.tiles).toHaveLength(80 * 60);
    expect(result.current.state.tiles.every(t => t.terrain === 'ocean')).toBe(true);
    expect(result.current.state.tiles).toEqual(afterResize);
  });

  it('marks the builder dirty after a resize', () => {
    const { result } = setup();
    expect(result.current.state.isDirty).toBe(false);
    act(() => result.current.setDimensions(120, 80));
    expect(result.current.state.isDirty).toBe(true);
  });

  it('is a no-op (same reference) when the dimensions are unchanged', () => {
    const { result } = setup();
    const before = result.current.state;
    act(() => result.current.setDimensions(DEFAULT_GRID.width, DEFAULT_GRID.height));
    expect(result.current.state).toBe(before);
  });
});
