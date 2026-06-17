/**
 * RealWorldPanel — Interactive region picker for generating real-world maps.
 *
 * Allows users to:
 * - View a mini Equal Earth world map
 * - Drag a bounding box to select a region
 * - Adjust hex budget (presets or custom)
 * - Generate a map from the selected region
 * - See a preview (terrain breakdown, tile count)
 * - Load the generated map into the Map Builder
 *
 * Lazy-loads geodata on first mount; stored in a ref to avoid re-renders.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useMapBuilder } from './MapBuilderContext';
import { loadGeoDatasetBrowser } from '../../geo/GeoDataset.browser';
import { rasterizeRegion } from '../../geo/rasterizeRegion';
import { MAX_HEX_BUDGET } from '../../geo/dimensionSolver';
import type { GeoDataset } from '../../geo/GeoDataset';
import type { SavedCustomMap } from '../../types/mapbuilder';
import styles from './RealWorldPanel.module.css';

const SIZE_PRESETS = [
  { label: 'Small', budget: 16_000 },
  { label: 'Medium', budget: 40_000 },
  { label: 'Large', budget: MAX_HEX_BUDGET },
] as const;

interface TerrainHistogram {
  [key: string]: number;
}

interface GeneratedMapPreview extends SavedCustomMap {
  terrainHistogram?: TerrainHistogram;
}

/**
 * Canvas dimensions for the mini world map visualization.
 * The Equal Earth projection spans roughly 2.04:1 aspect ratio (world width:height).
 */
const CANVAS_WIDTH = 432; // width
const CANVAS_HEIGHT = 270; // height for ~1.6:1 aspect

/**
 * Convert a bounding box and the canvas viewport to canvas coordinates.
 * Returns a rect { x, y, w, h } in canvas pixel space.
 */
function bboxToCanvasRect(
  bbox: [number, number, number, number],
  canvasW: number,
  canvasH: number,
): { x: number; y: number; w: number; h: number } {
  const [lonMin, latMin, lonMax, latMax] = bbox;
  // Approximate Equal Earth-like projection: map lon/lat to canvas
  // For MVP, treat as a simple rectangular projection (good enough for region selection)
  const x = ((lonMin + 180) / 360) * canvasW;
  const w = ((lonMax - lonMin) / 360) * canvasW;
  // Latitude is trickier; Equal Earth compresses poles. For MVP, use simple inversion.
  const y = ((90 - latMax) / 180) * canvasH;
  const h = ((latMax - latMin) / 180) * canvasH;

  return { x, y, w, h };
}

/**
 * Convert canvas coordinates back to a bounding box (lon/lat degrees).
 */
function canvasRectToBbox(
  rect: { x: number; y: number; w: number; h: number },
  canvasW: number,
  canvasH: number,
): [number, number, number, number] {
  const lonMin = (rect.x / canvasW) * 360 - 180;
  const lonMax = ((rect.x + rect.w) / canvasW) * 360 - 180;
  const latMax = 90 - (rect.y / canvasH) * 180;
  const latMin = 90 - ((rect.y + rect.h) / canvasH) * 180;
  return [lonMin, latMin, lonMax, latMax];
}

export function RealWorldPanel() {
  const ctx = useMapBuilder();

  // State
  const [selectedBbox, setSelectedBbox] = useState<[number, number, number, number]>([
    -180, -85, 180, 85,
  ]);
  const [hexBudget, setHexBudget] = useState(40_000);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<GeneratedMapPreview | null>(null);
  const [geodataLoaded, setGeodataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const geodataRef = useRef<GeoDataset | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    dragHandle: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;
    originalRect: { x: number; y: number; w: number; h: number } | null;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    dragHandle: null,
    originalRect: null,
  });

  // Load geodata on mount (lazy)
  useEffect(() => {
    const loadGeodata = async () => {
      try {
        const dataset = await loadGeoDatasetBrowser();
        geodataRef.current = dataset;
        setGeodataLoaded(true);
      } catch (e) {
        setError(`Failed to load geodata: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    loadGeodata();
  }, []);

  // Render canvas visualization
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1a1d27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw world border
    ctx.strokeStyle = '#2e3347';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Draw grid (latitude/longitude lines for reference)
    ctx.strokeStyle = '#2e3347';
    ctx.lineWidth = 0.5;
    for (let lon = -180; lon <= 180; lon += 60) {
      const x = ((lon + 180) / 360) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = ((90 - lat) / 180) * canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw selected bbox
    const rect = bboxToCanvasRect(selectedBbox, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(79, 110, 247, 0.2)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = '#4f6ef7';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    // Draw resize handles
    const handleSize = 6;
    ctx.fillStyle = '#4f6ef7';
    const handles = [
      { x: rect.x - handleSize / 2, y: rect.y - handleSize / 2 }, // NW
      { x: rect.x + rect.w - handleSize / 2, y: rect.y - handleSize / 2 }, // NE
      { x: rect.x - handleSize / 2, y: rect.y + rect.h - handleSize / 2 }, // SW
      { x: rect.x + rect.w - handleSize / 2, y: rect.y + rect.h - handleSize / 2 }, // SE
    ];
    for (const handle of handles) {
      ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
    }
  }, [selectedBbox]);

  const getCanvasRect = useCallback(() => {
    return bboxToCanvasRect(selectedBbox, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, [selectedBbox]);

  const getDragHandle = useCallback(
    (canvasX: number, canvasY: number,
    ): 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null => {
      const rect = getCanvasRect();
      const threshold = 8;

      const near = (a: number, b: number) => Math.abs(a - b) < threshold;
      const inside = (x: number, xmin: number, xmax: number) => x >= xmin && x <= xmax;

      if (near(canvasX, rect.x) && near(canvasY, rect.y)) return 'nw';
      if (near(canvasX, rect.x + rect.w) && near(canvasY, rect.y)) return 'ne';
      if (near(canvasX, rect.x) && near(canvasY, rect.y + rect.h)) return 'sw';
      if (near(canvasX, rect.x + rect.w) && near(canvasY, rect.y + rect.h)) return 'se';
      if (near(canvasY, rect.y) && inside(canvasX, rect.x, rect.x + rect.w)) return 'n';
      if (near(canvasY, rect.y + rect.h) && inside(canvasX, rect.x, rect.x + rect.w)) return 's';
      if (near(canvasX, rect.x) && inside(canvasY, rect.y, rect.y + rect.h)) return 'w';
      if (near(canvasX, rect.x + rect.w) && inside(canvasY, rect.y, rect.y + rect.h)) return 'e';
      if (inside(canvasX, rect.x, rect.x + rect.w) && inside(canvasY, rect.y, rect.y + rect.h)) {
        return 'move';
      }
      return null;
    },
    [getCanvasRect],
  );

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const handle = getDragHandle(canvasX, canvasY);
    if (!handle) return;

    draggingRef.current = {
      active: true,
      startX: canvasX,
      startY: canvasY,
      dragHandle: handle,
      originalRect: getCanvasRect(),
    };
  }, [getDragHandle, getCanvasRect]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (!draggingRef.current.active) {
      // Update cursor
      const handle = getDragHandle(canvasX, canvasY);
      if (handle === 'move') canvasRef.current.style.cursor = 'move';
      else if (handle === 'nw' || handle === 'se') canvasRef.current.style.cursor = 'nwse-resize';
      else if (handle === 'ne' || handle === 'sw') canvasRef.current.style.cursor = 'nesw-resize';
      else if (handle === 'n' || handle === 's') canvasRef.current.style.cursor = 'ns-resize';
      else if (handle === 'e' || handle === 'w') canvasRef.current.style.cursor = 'ew-resize';
      else canvasRef.current.style.cursor = 'default';
      return;
    }

    const dx = canvasX - draggingRef.current.startX;
    const dy = canvasY - draggingRef.current.startY;
    const orig = draggingRef.current.originalRect!;
    let newRect = { ...orig };

    if (draggingRef.current.dragHandle === 'move') {
      newRect.x += dx;
      newRect.y += dy;
    } else if (draggingRef.current.dragHandle === 'nw') {
      newRect.x += dx;
      newRect.y += dy;
      newRect.w -= dx;
      newRect.h -= dy;
    } else if (draggingRef.current.dragHandle === 'ne') {
      newRect.y += dy;
      newRect.w += dx;
      newRect.h -= dy;
    } else if (draggingRef.current.dragHandle === 'sw') {
      newRect.x += dx;
      newRect.w -= dx;
      newRect.h += dy;
    } else if (draggingRef.current.dragHandle === 'se') {
      newRect.w += dx;
      newRect.h += dy;
    } else if (draggingRef.current.dragHandle === 'n') {
      newRect.y += dy;
      newRect.h -= dy;
    } else if (draggingRef.current.dragHandle === 's') {
      newRect.h += dy;
    } else if (draggingRef.current.dragHandle === 'w') {
      newRect.x += dx;
      newRect.w -= dx;
    } else if (draggingRef.current.dragHandle === 'e') {
      newRect.w += dx;
    }

    // Clamp to canvas
    newRect.x = Math.max(0, Math.min(newRect.x, CANVAS_WIDTH - newRect.w));
    newRect.y = Math.max(0, Math.min(newRect.y, CANVAS_HEIGHT - newRect.h));
    newRect.w = Math.max(10, Math.min(newRect.w, CANVAS_WIDTH - newRect.x));
    newRect.h = Math.max(10, Math.min(newRect.h, CANVAS_HEIGHT - newRect.y));

    const newBbox = canvasRectToBbox(newRect, CANVAS_WIDTH, CANVAS_HEIGHT);
    setSelectedBbox(newBbox);
  }, [getDragHandle]);

  const handleCanvasMouseUp = () => {
    draggingRef.current.active = false;
  };

  // Handle Generate button
  const handleGenerate = async () => {
    if (!geodataRef.current) {
      setError('Geodata not loaded');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const [lonMin, latMin, lonMax, latMax] = selectedBbox;
      const map = await rasterizeRegion(
        { lonMin, latMin, lonMax, latMax },
        geodataRef.current,
        {
          name: `Generated Map ${new Date().toLocaleString()}`,
          hexBudget,
        },
      );

      // Compute terrain histogram
      const histogram: TerrainHistogram = {};
      for (const tile of map.tiles) {
        histogram[tile.terrain] = (histogram[tile.terrain] ?? 0) + 1;
      }

      setPreview({
        ...map,
        terrainHistogram: histogram,
      });
      setGenerating(false);
    } catch (e) {
      setError(`Generation failed: ${e instanceof Error ? e.message : String(e)}`);
      setGenerating(false);
    }
  };

  // Handle Load into Map Builder
  const handleLoadIntoBuilder = () => {
    if (!preview) return;
    const json = JSON.stringify(preview);
    ctx.loadMap(json);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.title}>🌍 Real-World Region Picker</div>
      </div>

      {!geodataLoaded ? (
        <div className={styles.section}>
          <div className={styles.loadingText}>{error || 'Loading geodata...'}</div>
        </div>
      ) : error ? (
        <div className={styles.section}>
          <div className={styles.error}>{error}</div>
        </div>
      ) : (
        <>
          {/* Map Canvas */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>SELECT REGION</div>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className={styles.canvas}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
            <div className={styles.canvasHint}>
              Drag the box to select a region. Resize by dragging corners or edges.
            </div>
          </div>

          {/* Hex Budget Controls */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>HEX BUDGET</div>
            <div className={styles.presetGrid}>
              {SIZE_PRESETS.map(preset => {
                const active = hexBudget === preset.budget;
                return (
                  <button
                    key={preset.label}
                    className={`${styles.presetBtn} ${active ? styles.presetBtnActive : ''}`}
                    onClick={() => setHexBudget(preset.budget)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className={styles.customBudgetRow}>
              <label htmlFor="hexBudget">Custom:</label>
              <input
                id="hexBudget"
                type="number"
                min={4_000}
                max={MAX_HEX_BUDGET}
                step={1_000}
                value={hexBudget}
                onChange={e => setHexBudget(Math.max(4_000, Math.min(MAX_HEX_BUDGET, +e.target.value)))}
                className={styles.numberInput}
              />
              <span className={styles.budgetHint}>({Math.round(hexBudget / 1000)}k hexes)</span>
            </div>
          </div>

          {/* Generate Button */}
          <div className={styles.section}>
            <button
              className={styles.generateBtn}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? '⏳ Generating...' : '✨ Generate Map'}
            </button>
          </div>

          {/* Preview */}
          {preview && (
            <div className={styles.section}>
              <div className={styles.previewTitle}>Preview</div>
              <div className={styles.previewStats}>
                <p><strong>Tiles:</strong> {preview.tiles.length}</p>
                <p><strong>Dimensions:</strong> {preview.width}×{preview.height}</p>
              </div>
              {preview.terrainHistogram && (
                <div className={styles.terrainHistogram}>
                  <p><strong>Terrain Breakdown:</strong></p>
                  <div className={styles.histogramTable}>
                    {Object.entries(preview.terrainHistogram)
                      .sort(([, a], [, b]) => b - a)
                      .map(([terrain, count]) => (
                        <div key={terrain} className={styles.histogramRow}>
                          <span className={styles.terrainLabel}>{terrain}</span>
                          <span className={styles.terrainCount}>{count} ({((count / preview.tiles.length) * 100).toFixed(1)}%)</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <button
                className={styles.loadBtn}
                onClick={handleLoadIntoBuilder}
              >
                📥 Load into Map Builder
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
