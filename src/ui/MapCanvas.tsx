import { useRef, useEffect, useCallback, useState } from 'react';
import { useSimulation } from '../SimulationContext';
import { HexRenderer } from '../renderer/HexRenderer';
import styles from './MapCanvas.module.css';

export function MapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HexRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const isPanning = useRef(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const hasDragged = useRef(false);
  const DRAG_THRESHOLD = 5;
  const [isNavigating, setIsNavigating] = useState(false);

  const {
    world,
    simState,
    uiState,
    setUIState,
    animationController,
    setCanvasElement,
  } = useSimulation();

  // Register canvas element in context for screenshot export
  useEffect(() => {
    setCanvasElement(canvasRef.current);
    return () => setCanvasElement(null);
  }, [setCanvasElement]);

  // Initialize renderer when world loads
  useEffect(() => {
    if (!canvasRef.current || !world) return;
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth || 800;
    canvas.height = canvas.offsetHeight || 600;
    rendererRef.current = new HexRenderer(canvas, world);
  }, [world]);

  // RAF loop for continuous rendering
  useEffect(() => {
    if (!rendererRef.current || !simState) return;

    const loop = (time: number) => {
      const delta = lastTimeRef.current ? time - lastTimeRef.current : 16;
      lastTimeRef.current = time;
      animationController.tick(delta);
      rendererRef.current?.render(simState, uiState, animationController);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [simState, uiState, animationController]);

  // Window resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current) return;
      const canvas = canvasRef.current;
      rendererRef.current.resize(canvas.offsetWidth, canvas.offsetHeight);
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

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Left-drag detection
    if (dragStartPos.current !== null) {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        hasDragged.current = true;
      }
    }
    if (hasDragged.current || isPanning.current) {
      rendererRef.current?.panBy(e.movementX, e.movementY);
      return;
    }
    if (!rendererRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = rendererRef.current.getTileAtPixel(x, y);
    setUIState(prev => ({ ...prev, hoveredTileIndex: idx }));
  }, [setUIState]);

  const handleMouseLeave = useCallback(() => {
    isPanning.current = false;
    dragStartPos.current = null;
    hasDragged.current = false;
    setIsNavigating(false);
    setUIState(prev => ({ ...prev, hoveredTileIndex: null }));
  }, [setUIState]);

  return (
    <div className={styles.canvasWrapper}>
      <canvas
        ref={canvasRef}
        className={isNavigating ? styles.navigating : styles.canvas}
        role="img"
        aria-label="World Simulator map"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={(e) => {
          if (e.button === 0) {
            dragStartPos.current = { x: e.clientX, y: e.clientY };
            hasDragged.current = false;
            setIsNavigating(true);
          }
          if (e.button === 1 || e.button === 2) {
            isPanning.current = true;
            setIsNavigating(true);
            e.preventDefault();
          }
        }}
        onMouseUp={(e) => {
          if (e.button === 0) {
            if (!hasDragged.current && dragStartPos.current !== null && canvasRef.current && rendererRef.current) {
              const rect = canvasRef.current.getBoundingClientRect();
              const idx = rendererRef.current.getTileAtPixel(e.clientX - rect.left, e.clientY - rect.top);
              if (idx !== null && simState) {
                const stateId = simState.ownership[idx];
                setUIState(prev => ({ ...prev, selectedStateId: stateId >= 0 ? stateId : null }));
              }
            }
            dragStartPos.current = null;
            hasDragged.current = false;
            setIsNavigating(false);
          }
          if (e.button === 1 || e.button === 2) {
            isPanning.current = false;
            setIsNavigating(false);
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
