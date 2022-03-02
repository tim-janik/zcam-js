// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';


/// Multiply 3x3 matrix by 3 element vector.
export function matrix33_mul3 (A, V) {
  const [[a,b,c], [d,e,f], [g,h,i]] = A;
  const [x,y,z] = V;
  const u = a*x + b*y + c*z;
  const v = d*x + e*y + f*z;
  const w = g*x + h*y + i*z;
  return [u,v,w];
}

/// Multiply matrix `M` by vector `V`.
export function matrix_mul_v (M, v) {
  const d = M.length;
  const r = Array (d);
  for (let j = 0; j < d; j++) {
    let sum = 0;
    const row = M[j], l = row.length;
    for (let i = 0; i < l; i++)
      sum += row[i] * v[i];
    r[j] = sum;
  }
  return r;
}

/// Constrain `x` to lie within `min` and `max`.
export function clamp (x, min, max) {
  return x < min ? min : x > max ? max : x; // retains x if NaN
}

/// Linear interpolation function for scalars of vectors.
export function lerp (u, v, t = 0.5) {
  const b = clamp (t, 0, 1), a = 1 - b;
  return u.map ? u.map ((ui, i) => ui * a + v[i] * b) : u * a + v * b;
}

/// Yield 0 for 0, -1 for negative and +1 for positive inputs without branching.
export function sgn (x) {
  return (0 < x) - (x < 0);
}

/// Find largest position (within `eps`) in `[vmin…vmax]` for which `predicate()` is true.
export function bsearch_max (predicate, vmin, vmax, eps = 1e-5) {
  let v;
  for (v = (vmax + vmin) * 0.5; Math.abs (vmax - vmin) > eps; v = (vmax + vmin) * 0.5) {
    if (predicate (v))
      vmin = v;
    else
      vmax = v;
  }
  return v;
}
