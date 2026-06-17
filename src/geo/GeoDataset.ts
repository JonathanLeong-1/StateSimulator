/**
 * GeoDataset — environment-agnostic access to the bundled geodata.
 *
 * Abstracts raster sampling (elevation, Köppen) and a river vector hit-test
 * behind a small interface so the SAME rasterizer core runs in Node (fs-backed
 * buffers) and the browser (fetch-backed buffers). No DOM, no fs, no fetch in
 * this file — callers supply already-loaded buffers via {@link RasterGeoDataset.fromBuffers}.
 *
 * Row/col mapping matches WS1's writer (`scripts/geodata/`): row 0 is the
 * northern edge (`bounds[3]`, +90°), columns run west→east from `bounds[0]`.
 * Elevation is Int16 little-endian, row-major; Köppen is Uint8, row-major.
 */

import type { TerrainType } from '../types/world';

/** Bounds tuple `[lonMin, latMin, lonMax, latMax]`. */
export type GeoBounds = [number, number, number, number];

export interface RasterLayerManifest {
  file: string;
  width: number;
  height: number;
  bounds: GeoBounds;
}

export interface ElevationLayerManifest extends RasterLayerManifest {
  seaLevel: number;
}

export interface GeoManifest {
  version: number;
  elevation: ElevationLayerManifest;
  koppen: RasterLayerManifest;
  rivers: { file: string };
}

/** A GeoJSON-ish geometry; only LineString / MultiLineString carry rivers. */
interface RiverGeometry {
  type: string;
  coordinates: unknown;
}

interface RiverFeature {
  geometry?: RiverGeometry | null;
}

interface RiverFeatureCollection {
  features?: RiverFeature[] | null;
}

/**
 * The sampling API consumed by the rasterizer. Implementations differ only in
 * how the underlying buffers were loaded.
 */
export interface GeoDataset {
  /** Elevation in metres at the given lon/lat (nearest-neighbour). */
  sampleElevation(lonDeg: number, latDeg: number): number;
  /** Köppen class code at the given lon/lat (nearest-neighbour; never interpolated). */
  sampleKoppen(lonDeg: number, latDeg: number): number;
  /** True when elevation is strictly above sea level. */
  isLand(lonDeg: number, latDeg: number): boolean;
  /** True when any river segment passes within `radiusDeg` of the point. */
  riverNear(lonDeg: number, latDeg: number, radiusDeg: number): boolean;
}

/** A river segment expressed as two endpoints in degrees. */
interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Buffers required to construct a {@link RasterGeoDataset}. */
export interface GeoBuffers {
  elevation: ArrayBuffer;
  koppen: ArrayBuffer;
  rivers: RiverFeatureCollection;
}

/** Cell size (degrees) of the uniform spatial hash used for river lookups. */
const RIVER_INDEX_CELL_DEG = 1;

/** Squared Euclidean distance (in degrees) from point (px,py) to segment. */
function pointSegDistSq(px: number, py: number, s: Segment): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - s.x1) * dx + (py - s.y1) * dy) / lenSq : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = s.x1 + t * dx;
  const cy = s.y1 + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey;
}

/**
 * Uniform-grid spatial index over river segments, keyed by 1° cells. Each
 * segment is registered in every cell its bounding box overlaps, so a radius
 * query only tests nearby segments rather than all ~thousands of them.
 */
class RiverIndex {
  private readonly cells = new Map<string, Segment[]>();
  private empty = true;

  constructor(fc: RiverFeatureCollection | null | undefined) {
    const features = fc?.features;
    if (!Array.isArray(features)) return;
    for (const feature of features) {
      const geom = feature?.geometry;
      if (!geom || !geom.coordinates) continue; // defensive: skip null/empty geometry
      if (geom.type === 'LineString') {
        this.addLine(geom.coordinates as number[][]);
      } else if (geom.type === 'MultiLineString') {
        const lines = geom.coordinates as number[][][];
        if (!Array.isArray(lines)) continue;
        for (const line of lines) this.addLine(line);
      }
    }
  }

  private addLine(coords: number[][] | null | undefined): void {
    if (!Array.isArray(coords) || coords.length < 2) return;
    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i];
      const b = coords[i + 1];
      if (!Array.isArray(a) || !Array.isArray(b)) continue;
      const x1 = a[0];
      const y1 = a[1];
      const x2 = b[0];
      const y2 = b[1];
      if (
        !Number.isFinite(x1) || !Number.isFinite(y1) ||
        !Number.isFinite(x2) || !Number.isFinite(y2)
      ) {
        continue;
      }
      this.insert({ x1, y1, x2, y2 });
    }
  }

  private insert(seg: Segment): void {
    this.empty = false;
    const minX = Math.min(seg.x1, seg.x2);
    const maxX = Math.max(seg.x1, seg.x2);
    const minY = Math.min(seg.y1, seg.y2);
    const maxY = Math.max(seg.y1, seg.y2);
    const c0 = Math.floor(minX / RIVER_INDEX_CELL_DEG);
    const c1 = Math.floor(maxX / RIVER_INDEX_CELL_DEG);
    const r0 = Math.floor(minY / RIVER_INDEX_CELL_DEG);
    const r1 = Math.floor(maxY / RIVER_INDEX_CELL_DEG);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const key = `${c},${r}`;
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        bucket.push(seg);
      }
    }
  }

  near(lonDeg: number, latDeg: number, radiusDeg: number): boolean {
    if (this.empty) return false;
    const r = Math.max(0, radiusDeg);
    const rSq = r * r;
    const c0 = Math.floor((lonDeg - r) / RIVER_INDEX_CELL_DEG);
    const c1 = Math.floor((lonDeg + r) / RIVER_INDEX_CELL_DEG);
    const r0 = Math.floor((latDeg - r) / RIVER_INDEX_CELL_DEG);
    const r1 = Math.floor((latDeg + r) / RIVER_INDEX_CELL_DEG);
    const seen = new Set<Segment>();
    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = c0; cc <= c1; cc++) {
        const bucket = this.cells.get(`${cc},${rr}`);
        if (!bucket) continue;
        for (const seg of bucket) {
          if (seen.has(seg)) continue;
          seen.add(seg);
          if (pointSegDistSq(lonDeg, latDeg, seg) <= rSq) return true;
        }
      }
    }
    return false;
  }
}

/**
 * Concrete {@link GeoDataset} backed by in-memory raster/vector buffers.
 *
 * Construct via {@link RasterGeoDataset.fromBuffers}; thin Node/browser loaders
 * (separate files) are responsible for fetching the bytes.
 */
export class RasterGeoDataset implements GeoDataset {
  private readonly elevation: Int16Array;
  private readonly koppen: Uint8Array;
  private readonly riverIndex: RiverIndex;

  private readonly elevWidth: number;
  private readonly elevHeight: number;
  private readonly elevBounds: GeoBounds;
  private readonly seaLevel: number;

  private readonly kopWidth: number;
  private readonly kopHeight: number;
  private readonly kopBounds: GeoBounds;

  private constructor(manifest: GeoManifest, buffers: GeoBuffers) {
    const e = manifest.elevation;
    const k = manifest.koppen;

    const expectedElev = e.width * e.height * 2;
    if (buffers.elevation.byteLength !== expectedElev) {
      throw new Error(
        `elevation buffer size ${buffers.elevation.byteLength} ≠ expected ${expectedElev} (${e.width}×${e.height} Int16)`,
      );
    }
    const expectedKop = k.width * k.height;
    if (buffers.koppen.byteLength !== expectedKop) {
      throw new Error(
        `koppen buffer size ${buffers.koppen.byteLength} ≠ expected ${expectedKop} (${k.width}×${k.height} Uint8)`,
      );
    }

    // Int16Array requires a byteOffset-aligned buffer; the bundle is written
    // little-endian, matching every realistic JS host (all little-endian).
    this.elevation = new Int16Array(buffers.elevation);
    this.koppen = new Uint8Array(buffers.koppen);
    this.riverIndex = new RiverIndex(buffers.rivers);

    this.elevWidth = e.width;
    this.elevHeight = e.height;
    this.elevBounds = e.bounds;
    this.seaLevel = e.seaLevel;

    this.kopWidth = k.width;
    this.kopHeight = k.height;
    this.kopBounds = k.bounds;
  }

  /**
   * Build a dataset from a manifest plus already-loaded buffers.
   *
   * @param manifest parsed `manifest.json`
   * @param buffers `{ elevation, koppen }` raw ArrayBuffers + parsed `rivers` GeoJSON
   */
  static fromBuffers(manifest: GeoManifest, buffers: GeoBuffers): RasterGeoDataset {
    return new RasterGeoDataset(manifest, buffers);
  }

  /** Convert lon/lat → flat raster index for a given layer. */
  private indexFor(
    lonDeg: number,
    latDeg: number,
    width: number,
    height: number,
    bounds: GeoBounds,
  ): number {
    const [lonMin, latMin, lonMax, latMax] = bounds;
    let col = Math.floor(((lonDeg - lonMin) / (lonMax - lonMin)) * width);
    let row = Math.floor(((latMax - latDeg) / (latMax - latMin)) * height);
    if (col < 0) col = 0;
    else if (col >= width) col = width - 1;
    if (row < 0) row = 0;
    else if (row >= height) row = height - 1;
    return row * width + col;
  }

  sampleElevation(lonDeg: number, latDeg: number): number {
    const idx = this.indexFor(lonDeg, latDeg, this.elevWidth, this.elevHeight, this.elevBounds);
    return this.elevation[idx];
  }

  sampleKoppen(lonDeg: number, latDeg: number): number {
    const idx = this.indexFor(lonDeg, latDeg, this.kopWidth, this.kopHeight, this.kopBounds);
    return this.koppen[idx];
  }

  isLand(lonDeg: number, latDeg: number): boolean {
    return this.sampleElevation(lonDeg, latDeg) > this.seaLevel;
  }

  riverNear(lonDeg: number, latDeg: number, radiusDeg: number): boolean {
    return this.riverIndex.near(lonDeg, latDeg, radiusDeg);
  }
}

/** Re-export for downstream consumers that map Köppen codes to terrain. */
export type { TerrainType };
