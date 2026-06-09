import type { MapBuilderTile } from '../../types/mapbuilder';
import { TERRAIN_COLORS } from '../../renderer/MapModes';

export class MapBuilderRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private tileSize: number = 0;
  private tileCenters: Map<number, [number, number]> = new Map();
  private neighborLookup: Map<number, number[]> = new Map();
  private tiles: MapBuilderTile[] = [];
  private camera = { x: 0, y: 0, scale: 1 };
  private layoutInitialized = false;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.width = width;
    this.height = height;
    // Compute tileSize from canvas dimensions for fitToView to work
    this.computeTileSize();
  }

  private computeTileSize(): void {
    const cw = this.canvas.width || 800;
    const ch = this.canvas.height || 600;
    const hexW = cw / (this.width * 0.75 + 0.25);
    const hexH = ch / (this.height + 0.5);
    this.tileSize = Math.min(hexW / Math.sqrt(3), hexH) * 0.95;
  }

  private fitToView(w: number, h: number): void {
    if (this.tiles.length === 0) {
      this.camera = { x: w / 2, y: h / 2, scale: 1 };
      return;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of this.tiles) {
      const [wx, wy] = this.tileCenter(t.q, t.r);
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
    }
    const pad = this.tileSize * 2;
    const mapW = maxX - minX + pad;
    const mapH = maxY - minY + pad;
    const scaleX = w / mapW;
    const scaleY = h / mapH;
    this.camera.scale = Math.min(scaleX, scaleY) * 0.95;
    this.camera.x = (w - mapW * this.camera.scale) / 2 - minX * this.camera.scale + (pad / 2) * this.camera.scale;
    this.camera.y = (h - mapH * this.camera.scale) / 2 - minY * this.camera.scale + (pad / 2) * this.camera.scale;
  }

  private tileCenter(q: number, r: number): [number, number] {
    const size = this.tileSize;
    return [
      size * (3 / 2) * q,
      size * Math.sqrt(3) * r + (q % 2 !== 0 ? size * Math.sqrt(3) / 2 : 0),
    ];
  }

  private hexCorners(cx: number, cy: number): [number, number][] {
    const corners: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i);
      corners.push([cx + this.tileSize * Math.cos(angle), cy + this.tileSize * Math.sin(angle)]);
    }
    return corners;
  }

  setTiles(tiles: MapBuilderTile[]): void {
    this.tiles = tiles;
    this.tileCenters.clear();
    this.neighborLookup.clear();
    for (const t of tiles) {
      this.tileCenters.set(t.index, this.tileCenter(t.q, t.r));
    }
    const indexMap = new Map<string, number>();
    for (const t of tiles) indexMap.set(`${t.q},${t.r}`, t.index);
    const DIRS_EVEN = [[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]];
    const DIRS_ODD  = [[1,1],[1,0],[0,-1],[-1,0],[-1,1],[0,1]];
    for (const t of tiles) {
      const DIRS = t.q % 2 === 0 ? DIRS_EVEN : DIRS_ODD;
      const neighbors: number[] = [];
      for (const [dq, dr] of DIRS) {
        const ni = indexMap.get(`${t.q + dq},${t.r + dr}`);
        if (ni !== undefined) neighbors.push(ni);
      }
      this.neighborLookup.set(t.index, neighbors);
    }
    this.fitToView(this.canvas.width, this.canvas.height);
    this.layoutInitialized = true;
  }

  render(tiles: MapBuilderTile[], hoveredBrushIndices: Set<number>, hoveredIndex: number | null): void {
    // Update tile data; rebuild layout only if structure changed or not yet initialized
    if (!this.layoutInitialized || tiles.length !== this.tiles.length) {
      this.setTiles(tiles);
    } else {
      this.tiles = tiles;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.setTransform(this.camera.scale, 0, 0, this.camera.scale, this.camera.x, this.camera.y);

    // Pass 1: fill terrain colors
    for (const t of tiles) {
      const center = this.tileCenters.get(t.index);
      if (!center) continue;
      const corners = this.hexCorners(center[0], center[1]);
      ctx.beginPath();
      ctx.moveTo(corners[0][0], corners[0][1]);
      for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
      ctx.closePath();
      ctx.fillStyle = (TERRAIN_COLORS as Record<string, string>)[t.terrain] ?? '#555';
      ctx.fill();
    }

    // Pass 2: grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 0.5;
    for (const t of tiles) {
      const center = this.tileCenters.get(t.index);
      if (!center) continue;
      const corners = this.hexCorners(center[0], center[1]);
      ctx.beginPath();
      ctx.moveTo(corners[0][0], corners[0][1]);
      for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
      ctx.closePath();
      ctx.stroke();
    }

    // Pass 3: brush preview overlay
    if (hoveredBrushIndices.size > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (const idx of hoveredBrushIndices) {
        const center = this.tileCenters.get(idx);
        if (!center) continue;
        const corners = this.hexCorners(center[0], center[1]);
        ctx.beginPath();
        ctx.moveTo(corners[0][0], corners[0][1]);
        for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Pass 4: hovered tile highlight (dashed outline)
    if (hoveredIndex !== null) {
      const center = this.tileCenters.get(hoveredIndex);
      if (center) {
        const corners = this.hexCorners(center[0], center[1]);
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(corners[0][0], corners[0][1]);
        for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  getTileAtPixel(px: number, py: number): number | null {
    const wx = (px - this.camera.x) / this.camera.scale;
    const wy = (py - this.camera.y) / this.camera.scale;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const [idx, [cx, cy]] of this.tileCenters) {
      const d = Math.hypot(wx - cx, wy - cy);
      if (d < bestDist && d < this.tileSize * 1.2) {
        bestDist = d;
        best = idx;
      }
    }
    return best;
  }

  getBrushTileIndices(centerIndex: number, brushSize: number): Set<number> {
    const result = new Set<number>();
    if (!this.tiles.length) return result;
    const center = this.tiles[centerIndex];
    if (!center) return result;
    result.add(centerIndex);
    if (brushSize <= 0) return result;

    const visited = new Set<number>([centerIndex]);
    const centerQ = center.q;
    const centerR = center.r;

    const hexDist = (q1: number, r1: number, q2: number, r2: number): number => {
      const toCube = (q: number, r: number): [number, number, number] => {
        const x = q; const z = r - (q - (q & 1)) / 2; return [x, -x - z, z];
      };
      const [x1, y1, z1] = toCube(q1, r1);
      const [x2, y2, z2] = toCube(q2, r2);
      return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
    };

    const bfsQueue = [centerIndex];
    while (bfsQueue.length > 0) {
      const curr = bfsQueue.shift()!;
      const neighbors = this.neighborLookup.get(curr) ?? [];
      for (const ni of neighbors) {
        if (visited.has(ni)) continue;
        visited.add(ni);
        const nt = this.tiles[ni];
        if (!nt) continue;
        if (hexDist(nt.q, nt.r, centerQ, centerR) <= brushSize) {
          result.add(ni);
          bfsQueue.push(ni);
        }
      }
    }
    return result;
  }

  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
    this.computeTileSize();
    this.fitToView(w, h);
  }

  panBy(dx: number, dy: number): void {
    this.camera.x += dx;
    this.camera.y += dy;
  }

  zoomAt(screenX: number, screenY: number, factor: number): void {
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 15.0;
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
