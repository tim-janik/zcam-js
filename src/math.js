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

/* Inspired by:
 * 1977, Computer methods for mathematical computations, G. Forsythe, et al; pg 76-79, spline() and seval()
 * 1994, Algorithms Second Edition, Robert Sedgewick; pg 624 makespline() and eval()
 * 2016, https://github.com/LiGengLei/x50/blob/master/src/x50_interface/src/spline_old.cpp
 * 2020, Fast Cubic Spline Interpolation, Haysn Hornbeck; https://arxiv.org/abs/2001.09253
 * 2020, https://github.com/gscalzo/SwiftCubicSpline/blob/master/Sources/SwiftCubicSpline/CubicSpline.swift
 */
export class CubicSpline {
  constructor (xs = [], ys = []) {
    this.setup (xs, ys);
  }
  splint (t) { return this.splint_newint (t); }
  splint_forsythe (t) {
    const x = this.x;
    for (let i = x.length - 1; i >= 0; i--)
      if (x[i] <= t) {				// §4.5 Forsythe, pg. 79
	const f = t - this.x[i];
	const c = this.sg[i] + this.sg[i] + this.sg[i]; // C == SIGMA * 3 == S''(x)/6
	return this.a[i] + f * (this.b[i] + f * (c + f * this.d[i]));
      }
    return this.a[0];
  }
  splint_sedgewick (t) {
    const x = this.x;
    for (let i = x.length - 2; i >= 0; i--)
      if (x[i] <= t) {
	const y = this.a, h = x[i+1] - x[i];
	const w = (t - x[i]) / h, v = 1 - w;	// also, §4.4 Forsythe, pg. 71
	const sg0t = this.sg[i], sg1t = this.sg[i+1]; // == sigma[i], sigma[i+1]
	return w * y[i+1] + v * y[i] + h*h * ((w*w*w - w) * sg1t + (v*v*v - v) * sg0t) /* /6.0 */;
      }
    return this.a[0];
  }
  splint_newint (t) {
    function newint (x, x0, x1, y0, y1, sg0, sg1) { // 2020, Fast Cubic Spline Interpolation, Haysn Hornbeck
      const h = (x1 - x0);
      const wh = (x - x0);
      const inv_h = 1. / h;
      const bx = (x1 - x);
      const h2 = h * h;			// 3 adds , 1 mult , 1 div
      const lower = wh * y1 + bx * y0;
      const C = (wh * wh - h2) * wh * sg1;
      const D = (bx * bx - h2) * bx * sg0;	// 1 add , 2 subs , 8 mults
      // 2 adds , 2 mult = 19 ops + 1 div
      return (lower + /* (1/6)* */ (C + D)) * inv_h;
    }
    const x = this.x;
    for (let i = x.length - 2; i >= 0; i--)
      if (x[i] <= t) {
	return newint (t, x[i], x[i+1], this.a[i], this.a[i+1], this.sg[i], this.sg[i+1]);
      }
    return this.a[0];
  }
  setup (xs, ys) {
    if (xs.length !== ys.length)
      throw 'CubicSpline: setup: mismatching xs/ys values';
    const npoints = xs.length;
    const x = this.x = new Float64Array (xs);		// this.y == S(x)
    const a = this.a = ys.length ? new Float64Array (ys) : new Float64Array (1);
    const b = this.b = new Float64Array (npoints);
    const sg = this.sg = new Float64Array (npoints);
    const d = this.d = new Float64Array (npoints);

    if (npoints <= 1) return;
    const nm1 = npoints - 1;

    // tri-diagonal system and forward substitution
    b[0] = 0
    sg[0] = 0
    d[0] = x[1] - x[0];
    for (let i = 1; i < nm1; i++) {
      d[i] = x[i + 1] - x[i];				// == Forsythe:DO10:D(I) == Sedgewick:for3:u[i]
      const diag = 2 * (x[i + 1] - x[i - 1]);		// == Forsythe:DO10:B(I) == Sedgewick:for2:d[i]
      const d1y0 = a[i] - a[i - 1], d1y1 = a[i + 1] - a[i];
      const d2ydx = d1y1 / d[i] - d1y0 / d[i - 1];	// == Forsythe:DO10:C(I) == Sedgewick:for4:w[i]/6
      const b20 = diag - d[i - 1] * b[i - 1];		// == Forsythe:DO20:B(I) == Sedgewick:for5:d[i]
      b[i] = d[i] / b20;				// == Forsythe:DO20:D(I)/B(I) == Sedgewick:for5:u[i]/d[i]
      sg[i] = (d2ydx - d[i - 1] * sg[i - 1]) / b20;	// == Forsythe:DO20:C(I) == CubicSpline.swift:z[i]/3
    }

    // backward substitution and coefficient calculation
    sg[nm1] = 0;
    for (let i = nm1 - 1; i >= 0; i--) {
      sg[i] = sg[i] - b[i] * sg[i + 1];			// == Forsythe:DO30:C(I) == Forsythe:SIGMA
      const d1y1 = a[i + 1] - a[i];
      const sg22 = sg[i + 1] + 2 * sg[i];
      b[i] = d1y1 / d[i] - d[i] * sg22;			// == Forsythe:DO40:B(I) == S'(x)
      d[i] = (sg[i + 1] - sg[i]) / d[i];		// == Forsythe:DO40:D(i) == S'''(x)/6
      // this.c[i + 1] = sg[i + 1] * 3;			// == Forsythe:DO40:C(I) == S''(x)/6 == SIGMA * 3
    }
  }
}

/// Fit a subset of (xs, ys) within epsilon with a cubic spline.
export function spline_fit (xs, ys, epsilon = 1e-5, max_points = 1e7, fixed = []) {
  // find largest ys diff
  function spline_maxdiff (cpx, cpy) {
    const a = cpx[0], b = cpx[cpx.length-1];
    const spline = new CubicSpline (cpx, cpy);
    let x, y, dy = 0;
    for (let i = 0; i < xs.length; i++) {
      const cx = xs[i], cy = ys[i];
      const delta = cy - spline.splint (cx);
      if (Math.abs (delta) > dy) {
        dy = Math.abs (delta);
        x = cx;
	y = cy;
      }
    }
    return { spline, dy, x, y };
  }
  // force control points at start, end, fixed
  const cp = [], nm1 = xs.length-1;
  cp.push ([ xs[0], ys[0] ]);
  if (fixed)
    for (const [i,x] of xs.entries())
      if (fixed.indexOf (x) >= 0)
	cp.push ([ x, ys[i] ]);
  cp.push ([ xs[nm1], ys[nm1] ]);
  // add control points while diff exceeds eps
  while (true) {
    cp.sort ((p, n) => p[0] - n[0]);
    const { spline, dy, x, y } = spline_maxdiff (cp.map (xy => xy[0]), cp.map (xy => xy[1]));
    if (dy < epsilon || cp.length >= max_points)
      return { spline, diff: dy };
    cp.push ([x, y]);
  }
}
