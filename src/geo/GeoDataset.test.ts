import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { RasterGeoDataset, type GeoManifest } from './GeoDataset';
import { loadGeoDatasetFromDir } from './GeoDataset.node';
import { koppenToBiome } from './koppen';

/** Build a tiny 4×2 synthetic dataset for unit-testing the sampling math. */
function makeSyntheticDataset(rivers: unknown): RasterGeoDataset {
  const manifest: GeoManifest = {
    version: 1,
    elevation: { file: 'e.bin', width: 4, height: 2, bounds: [-180, -90, 180, 90], seaLevel: 0 },
    koppen: { file: 'k.bin', width: 4, height: 2, bounds: [-180, -90, 180, 90] },
    rivers: { file: 'r.geojson' },
  };
  // row 0 = north (lat 0..90), row 1 = south (lat -90..0); cols span lon west→east.
  const elevation = Int16Array.from([
    100, -50, 200, 300, // north row
    -10, 50, -20, 400, // south row
  ]).buffer;
  const koppen = Uint8Array.from([
    1, 4, 14, 29, // north row
    3, 6, 25, 30, // south row
  ]).buffer;
  return RasterGeoDataset.fromBuffers(manifest, {
    elevation,
    koppen,
    rivers: rivers as never,
  });
}

describe('RasterGeoDataset row/col mapping', () => {
  const ds = makeSyntheticDataset({ features: [] });

  it('should sample the north-west cell for a far north-west coordinate', () => {
    expect(ds.sampleElevation(-170, 80)).toBe(100);
    expect(ds.sampleKoppen(-170, 80)).toBe(1);
  });

  it('should sample the south-east cell for a far south-east coordinate', () => {
    expect(ds.sampleElevation(170, -80)).toBe(400);
    expect(ds.sampleKoppen(170, -80)).toBe(30);
  });

  it('should classify land vs ocean from the sea level', () => {
    expect(ds.isLand(-170, 80)).toBe(true); // 100 m
    expect(ds.isLand(-50, 80)).toBe(false); // -50 m
  });

  it('should clamp out-of-bounds coordinates to the edge cells', () => {
    expect(ds.sampleElevation(-1000, 1000)).toBe(100); // clamps to NW corner
    expect(ds.sampleElevation(1000, -1000)).toBe(400); // clamps to SE corner
  });

  it('should reject buffers that do not match the declared dimensions', () => {
    const manifest: GeoManifest = {
      version: 1,
      elevation: { file: 'e', width: 4, height: 2, bounds: [-180, -90, 180, 90], seaLevel: 0 },
      koppen: { file: 'k', width: 4, height: 2, bounds: [-180, -90, 180, 90] },
      rivers: { file: 'r' },
    };
    expect(() =>
      RasterGeoDataset.fromBuffers(manifest, {
        elevation: new ArrayBuffer(2),
        koppen: new ArrayBuffer(8),
        rivers: { features: [] },
      }),
    ).toThrow();
  });
});

describe('RasterGeoDataset river hit-test', () => {
  it('should detect a point near a river segment', () => {
    const ds = makeSyntheticDataset({
      features: [{ geometry: { type: 'LineString', coordinates: [[0, 0], [2, 0]] } }],
    });
    expect(ds.riverNear(1, 0.05, 0.2)).toBe(true);
    expect(ds.riverNear(1, 5, 0.2)).toBe(false);
  });

  it('should handle MultiLineString geometry', () => {
    const ds = makeSyntheticDataset({
      features: [
        { geometry: { type: 'MultiLineString', coordinates: [[[10, 10], [10, 12]]] } },
      ],
    });
    expect(ds.riverNear(10, 11, 0.2)).toBe(true);
  });

  it('should tolerate null / empty / malformed geometry without throwing', () => {
    const ds = makeSyntheticDataset({
      features: [
        { geometry: null },
        { geometry: { type: 'LineString', coordinates: null } },
        { geometry: { type: 'LineString', coordinates: [[1, 1]] } }, // single point
        { geometry: { type: 'Point', coordinates: [0, 0] } }, // wrong type
        {}, // no geometry
        { geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }, // one real river
      ],
    });
    expect(() => ds.riverNear(0.5, 0.5, 0.2)).not.toThrow();
    expect(ds.riverNear(0.5, 0.5, 0.2)).toBe(true);
    expect(ds.riverNear(50, 50, 0.2)).toBe(false);
  });

  it('should return false when there are no river features', () => {
    const ds = makeSyntheticDataset({ features: [] });
    expect(ds.riverNear(0, 0, 1)).toBe(false);
  });

  it('should tolerate a completely empty / null feature collection', () => {
    const ds1 = makeSyntheticDataset({});
    const ds2 = makeSyntheticDataset(null);
    expect(ds1.riverNear(0, 0, 1)).toBe(false);
    expect(ds2.riverNear(0, 0, 1)).toBe(false);
  });
});

describe('RasterGeoDataset over the real bundled geodata', () => {
  let ds: RasterGeoDataset;

  beforeAll(() => {
    ds = loadGeoDatasetFromDir(join(process.cwd(), 'public', 'geodata'));
  });

  it('should report open Pacific ocean as not land', () => {
    expect(ds.isLand(-160, 0)).toBe(false);
  });

  it('should report high elevation over the Himalaya', () => {
    expect(ds.sampleElevation(87, 28)).toBeGreaterThan(3000);
    expect(ds.isLand(87, 28)).toBe(true);
  });

  it('should classify the central Sahara as an arid (desert) biome', () => {
    expect(ds.isLand(20, 23)).toBe(true);
    const code = ds.sampleKoppen(20, 23);
    expect([4, 5, 6, 7]).toContain(code); // B-group arid
    expect(koppenToBiome(code)).toBe('desert');
  });
});
