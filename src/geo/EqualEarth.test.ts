import { describe, it, expect } from 'vitest';
import { forward, forwardDeg, inverse, inverseDeg } from './EqualEarth';

const DEG2RAD = Math.PI / 180;

describe('EqualEarth.forward', () => {
  it('should map the origin to (0, 0)', () => {
    const p = forwardDeg(0, 0);
    expect(Math.abs(p.x)).toBeLessThan(1e-12);
    expect(Math.abs(p.y)).toBeLessThan(1e-12);
  });

  it('should produce a positive x for eastern longitudes and negative for western', () => {
    expect(forwardDeg(90, 0).x).toBeGreaterThan(0);
    expect(forwardDeg(-90, 0).x).toBeLessThan(0);
  });

  it('should produce a positive y for northern latitudes and negative for southern', () => {
    expect(forwardDeg(0, 45).y).toBeGreaterThan(0);
    expect(forwardDeg(0, -45).y).toBeLessThan(0);
  });

  it('should be symmetric about the equator and prime meridian', () => {
    const north = forwardDeg(30, 40);
    const south = forwardDeg(30, -40);
    expect(north.x).toBeCloseTo(south.x, 12);
    expect(north.y).toBeCloseTo(-south.y, 12);
  });
});

describe('EqualEarth round-trip (forward ∘ inverse)', () => {
  it('should recover lon/lat within 1e-6 over a global grid', () => {
    let maxErr = 0;
    for (let lat = -90; lat <= 90; lat += 5) {
      for (let lon = -180; lon <= 180; lon += 5) {
        const p = forward(lon * DEG2RAD, lat * DEG2RAD);
        const back = inverse(p.x, p.y);
        const lonErr = Math.abs(back.lonRad - lon * DEG2RAD);
        const latErr = Math.abs(back.latRad - lat * DEG2RAD);
        maxErr = Math.max(maxErr, lonErr, latErr);
      }
    }
    expect(maxErr).toBeLessThan(1e-6);
  });

  it('should remain numerically robust at the ±90° poles', () => {
    for (const lat of [-90, 90]) {
      for (const lon of [-180, -45, 0, 45, 180]) {
        const p = forwardDeg(lon, lat);
        const back = inverseDeg(p.x, p.y);
        expect(Number.isFinite(back.lonDeg)).toBe(true);
        expect(Number.isFinite(back.latDeg)).toBe(true);
        expect(back.latDeg).toBeCloseTo(lat, 5);
        expect(back.lonDeg).toBeCloseTo(lon, 5);
      }
    }
  });

  it('should round-trip to ≤1e-6 over a dense grid incl. near-pole and antimeridian', () => {
    let maxErr = 0;
    let worst = { lon: 0, lat: 0 };
    for (let lat = -89; lat <= 89; lat += 1) {
      for (let lon = -180; lon <= 180; lon += 1) {
        const p = forward(lon * DEG2RAD, lat * DEG2RAD);
        const back = inverse(p.x, p.y);
        expect(Number.isNaN(back.lonRad)).toBe(false);
        expect(Number.isNaN(back.latRad)).toBe(false);
        const lonErr = Math.abs(back.lonRad - lon * DEG2RAD);
        const latErr = Math.abs(back.latRad - lat * DEG2RAD);
        const err = Math.max(lonErr, latErr);
        if (err > maxErr) {
          maxErr = err;
          worst = { lon, lat };
        }
      }
    }
     
    console.log(`[proj] dense round-trip max err ${maxErr.toExponential(3)} at`, worst);
    expect(maxErr).toBeLessThan(1e-6);
  });

  it('should converge (no NaN) at the most extreme lat/lon corners', () => {
    for (const lat of [-89.999, -89, 89, 89.999]) {
      for (const lon of [-180, -179.999, 179.999, 180]) {
        const p = forwardDeg(lon, lat);
        const back = inverseDeg(p.x, p.y);
        expect(Number.isFinite(back.lonDeg)).toBe(true);
        expect(Number.isFinite(back.latDeg)).toBe(true);
        expect(back.latDeg).toBeCloseTo(lat, 4);
        expect(back.lonDeg).toBeCloseTo(lon, 4);
      }
    }
  });
});

describe('EqualEarth.inverseDeg', () => {
  it('should return the origin for (0, 0)', () => {
    const ll = inverseDeg(0, 0);
    expect(ll.lonDeg).toBeCloseTo(0, 9);
    expect(ll.latDeg).toBeCloseTo(0, 9);
  });
});
