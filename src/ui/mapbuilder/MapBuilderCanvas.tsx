import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMapBuilder } from './MapBuilderContext';
import { MapBuilderRenderer } from './MapBuilderRenderer';
import styles from './MapBuilderCanvas.module.css';

export function MapBuilderCanvas() {
  const ctx = useMapBuilder();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapBuilderRenderer | null>(null);
  const isPaintingRef = useRef(false);
  const lastPaintedIdxRef = useRef<number | null>(null);
  const hoveredBrushRef = useRef<Set<number>>(new Set());
  const hoveredIdxRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const isPanningRef = useRef(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const isSpacePanRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 800;
    canvas.height = canvas.offsetHeight || 600;
    rendererRef.current = new MapBuilderRenderer(canvas, ctx.state.width, ctx.state.height);
    // Initial layout — fit tiles to view once on mount
    rendererRef.current.setTiles(ctx.state.tiles);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // RAF render loop
  useEffect(() => {
    const loop = () => {
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.render(ctx.state.tiles, hoveredBrushRef.current, hoveredIdxRef.current);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ctx.state.tiles]);

  // Window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer) return;
      renderer.resize(canvas.offsetWidth, canvas.offsetHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Non-passive wheel listener for zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (!rendererRef.current) return;
      const rect = canvas.getBoundingClientRect();
      rendererRef.current.zoomAt(
        e.clientX - rect.left,
        e.clientY - rect.top,
        e.deltaY < 0 ? 1.12 : 1 / 1.12
      );
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        if (!isSpacePanRef.current) {
          isSpacePanRef.current = true;
          setSpaceHeld(true);
        }
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') { ctx.redo(); return; }
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { ctx.undo(); return; }
      if (e.ctrlKey && e.key === 'y') { ctx.redo(); return; }
      if (e.key === '[') ctx.setBrushSize(Math.max(0, ctx.state.brushSize - 1));
      if (e.key === ']') ctx.setBrushSize(Math.min(8, ctx.state.brushSize + 1));
      if (e.key === 'l' || e.key === 'L') ctx.setTool('paint-land');
      if (e.key === 'o' || e.key === 'O') ctx.setTool('paint-ocean');
      if (e.key === 'b' || e.key === 'B') ctx.setTool('paint-biome');
      if (e.key === 'p' || e.key === 'P') ctx.setTool('paint-productivity');
      if (e.key === 'r' || e.key === 'R') {
        const canvas = canvasRef.current;
        const renderer = rendererRef.current;
        if (canvas && renderer) renderer.resetView(canvas.offsetWidth, canvas.offsetHeight);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        isSpacePanRef.current = false;
        setSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [ctx]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      rendererRef.current?.panBy(e.movementX, e.movementY);
      return;
    }
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = renderer.getTileAtPixel(x, y);
    hoveredIdxRef.current = idx;
    if (idx !== null) {
      hoveredBrushRef.current = renderer.getBrushTileIndices(idx, ctx.state.brushSize);
      if (isPaintingRef.current && idx !== lastPaintedIdxRef.current) {
        lastPaintedIdxRef.current = idx;
        ctx.applyBrush(idx);
      }
    } else {
      hoveredBrushRef.current = new Set();
    }
  }, [ctx]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2) {
      isPanningRef.current = true;
      setIsNavigating(true);
      e.preventDefault();
      return;
    }
    if (e.button === 0 && isSpacePanRef.current) {
      isPanningRef.current = true;
      setIsNavigating(true);
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = renderer.getTileAtPixel(x, y);
    if (idx !== null) {
      isPaintingRef.current = true;
      lastPaintedIdxRef.current = idx;
      ctx.applyBrush(idx);
    }
  }, [ctx]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2) {
      isPanningRef.current = false;
      setIsNavigating(false);
      return;
    }
    isPaintingRef.current = false;
    lastPaintedIdxRef.current = null;
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsNavigating(false);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    isPaintingRef.current = false;
    lastPaintedIdxRef.current = null;
    isPanningRef.current = false;
    setIsNavigating(false);
    isSpacePanRef.current = false;
    setSpaceHeld(false);
    hoveredBrushRef.current = new Set();
    hoveredIdxRef.current = null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={isNavigating ? styles.navigating : spaceHeld ? styles.spaceReady : styles.canvas}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
