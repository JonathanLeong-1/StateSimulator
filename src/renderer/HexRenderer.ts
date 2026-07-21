import type { WorldData } from '../types/world';
import type { SimState } from '../types/simulation';
import type { UIState } from '../types/ui';
import type { AnimationController } from './AnimationController';
import { getTileColor } from './MapModes';
import { getOffsetNeighbors } from '../simulation/hexUtils';

const HEX_SIZE = 12;

function hexVertices(cx: number, cy: number, size: number): [number, number][] {
  const verts: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const angle = (Math.PI / 180) * (60 * k);
    verts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return verts;
}

export class HexRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: WorldData;
  private camera = { x: 0, y: 0, scale: 1 };

  constructor(canvas: HTMLCanvasElement, world: WorldData) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.world = world;
    this.fitToView(canvas.width, canvas.height);
  }

  private fitToView(w: number, h: number): void {
    const tiles = this.world.tiles;
    if (tiles.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const tile of tiles) {
      const [wx, wy] = this.tileCenter(tile.q, tile.r);
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy;
      if (wy > maxY) maxY = wy;
    }
    const mapW = maxX - minX + HEX_SIZE * 2;
    const mapH = maxY - minY + HEX_SIZE * 2;
    const scaleX = w / mapW;
    const scaleY = h / mapH;
    this.camera.scale = Math.min(scaleX, scaleY) * 0.95;
    this.camera.x = (w - mapW * this.camera.scale) / 2 - minX * this.camera.scale + HEX_SIZE * this.camera.scale;
    this.camera.y = (h - mapH * this.camera.scale) / 2 - minY * this.camera.scale + HEX_SIZE * this.camera.scale;
  }

  private tileCenter(q: number, r: number): [number, number] {
    return [
      HEX_SIZE * (3 / 2) * q,
      HEX_SIZE * Math.sqrt(3) * r + (q % 2 !== 0 ? HEX_SIZE * Math.sqrt(3) / 2 : 0),
    ];
  }

  render(simState: SimState, uiState: UIState, animations: AnimationController): void {
    const { ctx, canvas, world } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { tiles } = world;

    ctx.save();
    ctx.setTransform(this.camera.scale, 0, 0, this.camera.scale, this.camera.x, this.camera.y);

    // PASS 1: fill terrain colors
    for (const tile of tiles) {
      const [cx, cy] = this.tileCenter(tile.q, tile.r);
      const color = getTileColor(tile, uiState.mapMode);

      ctx.beginPath();
      const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
      ctx.moveTo(verts[0][0], verts[0][1]);
      for (let i = 1; i < 6; i++) ctx.lineTo(verts[i][0], verts[i][1]);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    // PASS 1b: State color overlay (political mode only)
    if (uiState.mapMode === 'political') {
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (const tile of tiles) {
      if (tile.terrain === 'ocean') continue;
      const stateId = simState.ownership[tile.index];
      if (stateId == null || stateId < 0) continue;
      const state = simState.states.get(stateId);
      if (!state) continue;
      const [cx, cy] = this.tileCenter(tile.q, tile.r);
      const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
      ctx.beginPath();
      ctx.moveTo(verts[0][0], verts[0][1]);
      for (let i = 1; i < 6; i++) ctx.lineTo(verts[i][0], verts[i][1]);
      ctx.closePath();
      ctx.fillStyle = state.color;
      ctx.fill();
    }
    ctx.restore();
    } // end political overlay

    // PASS 1c: Hovered state overlay
    const hoveredStateId = uiState.hoveredTileIndex !== null
      ? simState.ownership[uiState.hoveredTileIndex]
      : null;
    if (hoveredStateId !== null && hoveredStateId >= 0) {
      const hState = simState.states.get(hoveredStateId);
      if (hState) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        for (const idx of hState.tileIndices) {
          const tile = tiles[idx];
          if (!tile) continue;
          const [cx, cy] = this.tileCenter(tile.q, tile.r);
          const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
          ctx.beginPath();
          ctx.moveTo(verts[0][0], verts[0][1]);
          for (let i = 1; i < 6; i++) ctx.lineTo(verts[i][0], verts[i][1]);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // PASS 2: two-category borders
    // Build index map so we can look up neighbors by (q,r) for direction-aware edge drawing.
    // This correctly handles map-edge tiles (no neighbor = treat as open boundary).
    const tileIndexMap = new Map<string, number>();
    for (const tile of tiles) tileIndexMap.set(`${tile.q},${tile.r}`, tile.index);

    const greyEdges: Array<[[number, number], [number, number]]> = [];
    const blackEdges: Array<[[number, number], [number, number]]> = [];

    for (const tile of tiles) {
      const stateId = simState.ownership[tile.index];
      const [cx, cy] = this.tileCenter(tile.q, tile.r);
      const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
      const neighbors6 = getOffsetNeighbors(tile.q, tile.r);

      for (let k = 0; k < 6; k++) {
        const [nq, nr] = neighbors6[k];
        const neighborIdx = tileIndexMap.get(`${nq},${nr}`) ?? -1;

        // Dedup: only process each valid shared edge from the lower-index tile.
        // Map-boundary edges (neighborIdx < 0) are never deduped — draw from this tile.
        if (neighborIdx >= 0 && tile.index >= neighborIdx) continue;

        const v1 = verts[k] as [number, number];
        const v2 = verts[(k + 1) % 6] as [number, number];

        const tileHasState = tile.terrain !== 'ocean' && stateId >= 0;
        const neighborHasState = neighborIdx >= 0 &&
          tiles[neighborIdx]?.terrain !== 'ocean' &&
          (simState.ownership[neighborIdx] ?? -1) >= 0;
        const neighborState = neighborIdx >= 0 ? (simState.ownership[neighborIdx] ?? -1) : -1;

        const isFrontier = uiState.mapMode === 'political' && (
          (tileHasState && neighborHasState && stateId !== neighborState) ||
          (tileHasState && !neighborHasState) ||  // land→ocean or land→map-edge
          (!tileHasState && neighborHasState)      // ocean→land
        );

        if (isFrontier) {
          blackEdges.push([v1, v2]);
        } else {
          greyEdges.push([v1, v2]);
        }
      }
    }

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = 'rgba(180,180,180,0.20)';
    ctx.beginPath();
    for (const [v1, v2] of greyEdges) { ctx.moveTo(v1[0], v1[1]); ctx.lineTo(v2[0], v2[1]); }
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.88)';
    ctx.beginPath();
    for (const [v1, v2] of blackEdges) { ctx.moveTo(v1[0], v1[1]); ctx.lineTo(v2[0], v2[1]); }
    ctx.stroke();

    // PASS 5: Edge flash — conquest (gold) / secession (red)
    // Only flash edges shared with neighboring tiles from a different state.
    const flashingTiles = animations.getFlashingTiles();
    if (uiState.showEventFlashes && flashingTiles.size > 0) {
      for (const [tileIndex, { type, intensity }] of flashingTiles) {
        const tile = tiles[tileIndex];
        if (!tile) continue;
        const flashColor = type === 'conquest'
          ? `rgba(255,215,0,${intensity})`
          : `rgba(255,60,60,${intensity})`;
        const tileState = simState.ownership[tile.index];
        const [cx, cy] = this.tileCenter(tile.q, tile.r);
        const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
        ctx.save();
        ctx.strokeStyle = flashColor;
        ctx.lineWidth = 2.5;
        for (let k = 0; k < 6; k++) {
          const neighborIdx = tile.allNeighborIndices[k];
          if (neighborIdx === undefined || neighborIdx < 0) continue;
          const neighborState = simState.ownership[neighborIdx];
          if (neighborState === tileState) continue; // only flash edges bordering a different state
          const v1 = verts[k] as [number, number];
          const v2 = verts[(k + 1) % 6] as [number, number];
          ctx.beginPath();
          ctx.moveTo(v1[0], v1[1]);
          ctx.lineTo(v2[0], v2[1]);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Highlight selected state
    if (uiState.selectedStateId !== null) {
      const selectedState = simState.states.get(uiState.selectedStateId);
      if (selectedState) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([]);
        for (const idx of selectedState.tileIndices) {
          const tile = tiles[idx];
          const [cx, cy] = this.tileCenter(tile.q, tile.r);
          const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
          ctx.beginPath();
          ctx.moveTo(verts[0][0], verts[0][1]);
          for (let i = 1; i < 6; i++) ctx.lineTo(verts[i][0], verts[i][1]);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }

    // PASS 7: Hovered tile dot
    if (uiState.hoveredTileIndex !== null) {
      const tile = tiles[uiState.hoveredTileIndex];
      if (tile) {
        const [cx, cy] = this.tileCenter(tile.q, tile.r);
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.70)';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // PASS 8: Sea voyage arcs
    ctx.setLineDash([]);
    for (const voyage of animations.getActiveSeaVoyages()) {
      const tile1 = tiles[voyage.fromIndex];
      const tile2 = tiles[voyage.toIndex];
      if (!tile1 || !tile2) continue;

      const [x1, y1] = this.tileCenter(tile1.q, tile1.r);
      const [x2, y2] = this.tileCenter(tile2.q, tile2.r);

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const cpX = mx - dy * 0.25;
      const cpY = my + dx * 0.25;

      ctx.save();
      ctx.globalAlpha = voyage.opacity;
      ctx.strokeStyle = voyage.stateColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(y2 - cpY, x2 - cpX);
      ctx.translate(x2, y2);
      ctx.rotate(angle);
      ctx.fillStyle = voyage.stateColor;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-8, -2.5);
      ctx.lineTo(-8, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // PASS 9: State labels are placed in screen space. This keeps major states
    // readable when zoomed out, while collision checks reveal smaller states as
    // the user zooms in and more room becomes available.
    const labelCandidates = [...simState.states.values()]
      .filter(state => state.size > 0)
      .sort((a, b) => b.size - a.size)
      .map(state => {
        let sx = 0;
        let sy = 0;
        let count = 0;
        for (const idx of state.tileIndices) {
          const tile = tiles[idx];
          if (!tile) continue;
          const [tx, ty] = this.tileCenter(tile.q, tile.r);
          sx += tx;
          sy += ty;
          count++;
        }
        return {
          state,
          x: this.camera.x + (sx / count) * this.camera.scale,
          y: this.camera.y + (sy / count) * this.camera.scale,
        };
      });

    const density = Math.min(1, this.camera.scale / 2);
    const maxLabels = Math.max(6, Math.round(8 + density * 52));
    const fontSize = Math.round(10 + density * 3);
    const occupiedLabels: Array<{ left: number; top: number; right: number; bottom: number }> = [];

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${fontSize}px sans-serif`;

    let labelsDrawn = 0;
    for (const { state, x, y } of labelCandidates) {
      if (labelsDrawn >= maxLabels) break;
      if (x < -40 || x > canvas.width + 40 || y < -24 || y > canvas.height + 24) continue;

      const width = ctx.measureText(state.name).width + 12;
      const showCount = density >= 0.35 && state.size >= 3;
      const height = showCount ? fontSize * 2.25 : fontSize + 8;
      const bounds = {
        left: x - width / 2,
        top: y - height / 2,
        right: x + width / 2,
        bottom: y + height / 2,
      };
      const overlaps = occupiedLabels.some(label =>
        bounds.left < label.right && bounds.right > label.left &&
        bounds.top < label.bottom && bounds.bottom > label.top,
      );
      if (overlaps) continue;

      occupiedLabels.push(bounds);
      labelsDrawn++;
      const nameY = showCount ? y - fontSize * 0.43 : y;

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.76)';
      ctx.strokeText(state.name, x, nameY);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.fillText(state.name, x, nameY);

      if (showCount) {
        ctx.font = `500 ${Math.max(9, fontSize - 2)}px sans-serif`;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.66)';
        ctx.strokeText(`${state.size}`, x, y + fontSize * 0.7);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.76)';
        ctx.fillText(`${state.size}`, x, y + fontSize * 0.7);
        ctx.font = `600 ${fontSize}px sans-serif`;
      }
    }
    ctx.restore();

    ctx.restore();
  }

  getTileAtPixel(sx: number, sy: number): number | null {
    const wx = (sx - this.camera.x) / this.camera.scale;
    const wy = (sy - this.camera.y) / this.camera.scale;
    const { world } = this;
    let bestIdx: number | null = null;
    let bestDist = Infinity;
    for (const tile of world.tiles) {
      const [cx, cy] = this.tileCenter(tile.q, tile.r);
      const ddx = wx - cx;
      const ddy = wy - cy;
      const dist = ddx * ddx + ddy * ddy;
      if (dist < bestDist && dist < HEX_SIZE * HEX_SIZE) {
        bestDist = dist;
        bestIdx = tile.index;
      }
    }
    return bestIdx;
  }

  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
    this.fitToView(w, h);
  }

  panBy(dx: number, dy: number): void {
    this.camera.x += dx;
    this.camera.y += dy;
  }

  zoomAt(screenX: number, screenY: number, factor: number): void {
    const MIN_ZOOM = 0.2;
    const MAX_ZOOM = 10.0;
    const wx = (screenX - this.camera.x) / this.camera.scale;
    const wy = (screenY - this.camera.y) / this.camera.scale;
    this.camera.scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.camera.scale * factor));
    this.camera.x = screenX - wx * this.camera.scale;
    this.camera.y = screenY - wy * this.camera.scale;
  }

  resetView(w: number, h: number): void {
    this.fitToView(w, h);
  }
}
