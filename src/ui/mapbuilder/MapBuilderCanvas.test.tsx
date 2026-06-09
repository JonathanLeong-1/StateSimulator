import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MapBuilderCanvas } from './MapBuilderCanvas';

// Mock MapBuilderContext so the component renders without a provider
vi.mock('./MapBuilderContext', () => ({
  useMapBuilder: () => ({
    state: {
      tiles: [],
      width: 10,
      height: 10,
      tool: 'paint-land',
      brushSize: 2,
      selectedBiome: 'plains',
      productivityValue: 0.5,
      randomEnabled: false,
      name: 'Test Map',
      isDirty: false,
    },
    applyBrush: vi.fn(),
    setTool: vi.fn(),
    setBrushSize: vi.fn(),
    setSelectedBiome: vi.fn(),
    setProductivityValue: vi.fn(),
    setRandomEnabled: vi.fn(),
    setName: vi.fn(),
    generateRandomContinents: vi.fn(),
    clearMap: vi.fn(),
    saveMap: vi.fn(),
    loadMap: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    convertToWorldData: vi.fn(),
  }),
}));

// Mock MapBuilderRenderer so canvas rendering does not crash in jsdom
vi.mock('./MapBuilderRenderer', () => ({
  MapBuilderRenderer: class {
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
