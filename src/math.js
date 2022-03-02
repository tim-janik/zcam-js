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

// Golden-Section Search
const gss_upper = 0.61803398874989484820458683436563811772030917980575; // = 1 / phi = 0.5 * (5**0.5 - 1)
const gss_lower = 0.38196601125010515179541316563436188227969082019424; // = 1 / phi^2 = 0.5 * (3 - 5**0.5)
// Given f() with single local extremum in [a,b], yield [c,d] containing it within eps.
function gss_extremum (f, a, b, M, eps) {
  // https://en.wikipedia.org/wiki/Golden-section_search#Recursive_algorithm
  let range = b - a, i = 0, c, fc, d, fd;
  while (i++ < 257) {
    if (c === undefined) {
      c = a + gss_lower * range;
      fc = f (c);
    }
    if (d === undefined) {
      d = a + gss_upper * range;
      fd = f (d);
    }
    const fc_gt_fd = (fc > fd) ^ M; // M = need_minimum
    //                   a   c  d   b
    if (fc_gt_fd) { //   [-  ^  _  -]
      b = d;
      d = c; fd = fc;
      c = undefined;
    } else { // fd > fc  [-  _  ^  -]
      a = c;
      c = d; fc = fd;
      d = undefined;
    }
    range = b - a;
    if (range < eps)
      return fc_gt_fd ? { a, b, x: d, y: fd } : { a, b, x: c, y: fc };
  }
  throw new Error ('Too many iterations: [' + a + ',' + b + '] eps=' + eps);
}

/// Golden-section search for single maximum of `f([a…b])`
export function gss_max (f, a, b, eps = 1e-5) {
  return gss_extremum (f, Math.min (a, b), Math.max (a, b), 0, eps);
}

/// Golden-section search for single minimum of `f([a…b])`
export function gss_min (f, a, b, eps = 1e-5) {
  return gss_extremum (f, Math.min (a, b), Math.max (a, b), 1, eps);
}
