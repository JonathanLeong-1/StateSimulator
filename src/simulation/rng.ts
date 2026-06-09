/**
 * Mulberry32 — fast deterministic 32-bit PRNG.
 * Returns a function that produces values in [0, 1) from the given seed.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function (): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}
