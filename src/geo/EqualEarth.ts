/**
 * Equal Earth projection (Šavrič, Patterson & Jenny 2018).
 *
 * An equal-area pseudocylindrical projection. Used to lay out the hex grid in
 * projected space so each hex covers a roughly constant real-world area (no
 * Mercator-style high-latitude inflation). Pure math — no DOM, identical in
 * Node and the browser.
 *
 * Forward maps (lon λ, lat φ) → (x, y); inverse maps (x, y) → (lon λ, lat φ)
 * via Newton–Raphson on the y-polynomial. See architecture §3.
 */

/** Polynomial coefficients from the original Equal Earth paper. */
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;

const SQRT3 = Math.sqrt(3);
/** (√3 / 2) — factor applied to sin φ inside the parametric angle θ. */
const HALF_SQRT3 = SQRT3 / 2;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface ProjectedPoint {
  x: number;
  y: number;
}

export interface LonLatRad {
  lonRad: number;
  latRad: number;
}

export interface LonLatDeg {
  lonDeg: number;
  latDeg: number;
}

/** Clamp `v` into the closed interval [min, max]. */
function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/**
 * The y-polynomial in θ: y(θ) = A4θ⁹ + A3θ⁷ + A2θ³ + A1θ.
 */
function yPoly(theta: number): number {
  const t2 = theta * theta;
  const t3 = t2 * theta;
  const t7 = t3 * t3 * theta;
  const t9 = t7 * t2;
  return A4 * t9 + A3 * t7 + A2 * t3 + A1 * theta;
}

/**
 * Derivative dy/dθ = 9A4θ⁸ + 7A3θ⁶ + 3A2θ² + A1.
 * Note: this same expression also forms the denominator factor in the
 * forward x-equation.
 */
function yPolyPrime(theta: number): number {
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  const t8 = t6 * t2;
  return 9 * A4 * t8 + 7 * A3 * t6 + 3 * A2 * t2 + A1;
}

/**
 * Forward projection from radians.
 *
 * @param lonRad longitude λ in radians, typically [-π, π]
 * @param latRad latitude φ in radians, [-π/2, π/2]
 * @returns projected planar coordinates {x, y}
 */
export function forward(lonRad: number, latRad: number): ProjectedPoint {
  const theta = Math.asin(clamp(HALF_SQRT3 * Math.sin(latRad), -1, 1));
  const denom = yPolyPrime(theta);
  const x = (2 * SQRT3 * lonRad * Math.cos(theta)) / (3 * denom);
  const y = yPoly(theta);
  return { x, y };
}

/**
 * Forward projection from degrees (convenience wrapper).
 */
export function forwardDeg(lonDeg: number, latDeg: number): ProjectedPoint {
  return forward(lonDeg * DEG2RAD, latDeg * DEG2RAD);
}

/**
 * Inverse projection to radians.
 *
 * Recovers θ from y via Newton–Raphson (the y-polynomial is strictly
 * monotonic in θ over the valid range, so convergence is fast and stable),
 * then derives φ and λ. Robust at the ±90° poles: the argument of every
 * `asin` is clamped to [-1, 1] to absorb floating-point overshoot.
 *
 * @param x projected x
 * @param y projected y
 * @param tol convergence tolerance on θ (default 1e-9)
 * @param maxIter maximum Newton iterations (default 12)
 */
export function inverse(
  x: number,
  y: number,
  tol = 1e-9,
  maxIter = 12,
): LonLatRad {
  // Initial guess: for small θ, y ≈ A1·θ, so θ ≈ y / A1.
  let theta = y / A1;
  for (let i = 0; i < maxIter; i++) {
    const f = yPoly(theta) - y;
    const fp = yPolyPrime(theta);
    const delta = f / fp;
    theta -= delta;
    if (Math.abs(delta) < tol) break;
  }

  const latRad = Math.asin(clamp(Math.sin(theta) / HALF_SQRT3, -1, 1));
  const denom = yPolyPrime(theta);
  const lonRad = (3 * denom * x) / (2 * SQRT3 * Math.cos(theta));
  return { lonRad, latRad };
}

/**
 * Inverse projection returning degrees (convenience wrapper).
 */
export function inverseDeg(x: number, y: number): LonLatDeg {
  const { lonRad, latRad } = inverse(x, y);
  return { lonDeg: lonRad * RAD2DEG, latDeg: latRad * RAD2DEG };
}
