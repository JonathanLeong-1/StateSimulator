import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MapBuilderCanvas } from './MapBuilderCanvas';

// Mutable mock state so individual tests can drive grid-dimension changes.
const mockState = {
  tiles: [] as unknown[],
  width: 10,
  height: 10,
  brushSize: 2,
  selectedBiome: 'plains',
  randomEnabled: false,
  randomIntensity: 0.35,
  randomBiomePool: ['forest', 'hills', 'river_valley'],
  name: 'Test Map',
  isDirty: false,
};

// Mock MapBuilderContext so the component renders without a provider
vi.mock('./MapBuilderContext', () => ({
  useMapBuilder: () => ({
    state: mockState,
    applyBrush: vi.fn(),
    beginStroke: vi.fn(),
    setBrushSize: vi.fn(),
    setSelectedBiome: vi.fn(),
    setRandomEnabled: vi.fn(),
    setRandomIntensity: vi.fn(),
    toggleRandomBiome: vi.fn(),
    setName: vi.fn(),
    setDimensions: vi.fn(),
    generateRandomContinents: vi.fn(),
    clearMap: vi.fn(),
    saveMap: vi.fn(),
    loadMap: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    convertToWorldData: vi.fn(),
  }),
}));

// Records (width, height) for every MapBuilderRenderer construction so tests
// can assert the renderer is rebuilt when grid dimensions change.
const rendererConstructions: Array<{ width: number; height: number }> = [];

// Mock MapBuilderRenderer so canvas rendering does not crash in jsdom
vi.mock('./MapBuilderRenderer', () => ({
  MapBuilderRenderer: class {
    constructor(_canvas: unknown, width: number, height: number) {
      rendererConstructions.push({ width, height });
    }
    setTiles() {}
    render() {}
    resize() {}
    zoomAt() {}
    panBy() {}
    getTileAtPixel() { return null; }
    getBrushTileIndices() { return new Set(); }
    resetView() {}
  },
}));

beforeEach(() => {
  // jsdom canvas stub — getContext returns null by default; enough for our tests
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as unknown as CanvasRenderingContext2D);
  rendererConstructions.length = 0;
  mockState.width = 10;
  mockState.height = 10;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MapBuilderCanvas — renderer rebuild on dimension change', () => {
  it('constructs the renderer with the current grid dimensions on mount', () => {
    render(<MapBuilderCanvas />);
    expect(rendererConstructions.length).toBeGreaterThanOrEqual(1);
    expect(rendererConstructions.at(-1)).toEqual({ width: 10, height: 10 });
  });

  it('re-instantiates the renderer with new dimensions when width/height change', () => {
    const { rerender } = render(<MapBuilderCanvas />);
    const initialCount = rendererConstructions.length;
    expect(rendererConstructions.at(-1)).toEqual({ width: 10, height: 10 });

    // Simulate a resize (e.g. loaded/generated map at a different size).
    mockState.width = 200;
    mockState.height = 120;
    rerender(<MapBuilderCanvas />);

    expect(rendererConstructions.length).toBeGreaterThan(initialCount);
    expect(rendererConstructions.at(-1)).toEqual({ width: 200, height: 120 });
  });

  it('does NOT rebuild the renderer when dimensions are unchanged', () => {
    const { rerender } = render(<MapBuilderCanvas />);
    const initialCount = rendererConstructions.length;
    // Re-render with the same dimensions — the dim-keyed effect must not re-run.
    rerender(<MapBuilderCanvas />);
    expect(rendererConstructions.length).toBe(initialCount);
  });
});

describe('MapBuilderCanvas — Space-pan keyboard behaviour', () => {
  it('calls preventDefault when Space is pressed (prevents page scroll)', () => {
    render(<MapBuilderCanvas />);

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledOnce();
  });

  it('does NOT call preventDefault for non-Space keys', () => {
    render(<MapBuilderCanvas />);

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('handles Space keyup without error', () => {
    render(<MapBuilderCanvas />);

    // First press Space down
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    // Then release — should not throw
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    }).not.toThrow();
  });

  it('removes event listeners on unmount (no stale listeners after cleanup)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<MapBuilderCanvas />);

    const keydownCalls = addSpy.mock.calls.filter(([type]) => type === 'keydown').length;
    const keyupCalls = addSpy.mock.calls.filter(([type]) => type === 'keyup').length;

    expect(keydownCalls).toBeGreaterThanOrEqual(1);
    expect(keyupCalls).toBeGreaterThanOrEqual(1);

    unmount();

    const keydownRemovals = removeSpy.mock.calls.filter(([type]) => type === 'keydown').length;
    const keyupRemovals = removeSpy.mock.calls.filter(([type]) => type === 'keyup').length;

    expect(keydownRemovals).toBeGreaterThanOrEqual(1);
    expect(keyupRemovals).toBeGreaterThanOrEqual(1);
  });
});
