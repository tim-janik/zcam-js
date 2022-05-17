// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

import * as M from './math.js';
import * as S from './srgb.js';
import * as Z from './zcam.js';
import * as HT from './hashtable.js';

export class Gamut {
  constructor (zcamviewingconditions = {}) {
    this.viewing = Z.zcam_setup (zcamviewingconditions);
    this.Jz_spline = null;
    this.Cz_spline = null;
    this.extrema = [];
    this.minCz = NaN;
    this.maxCz = NaN;
    this.cached_Cz = null;
  }
  /// Calculate ZCAM perceptual color attributes from sRGB.
  zcam (srgb) {
    return Z.zcam_from_srgb (srgb, this.viewing);
  }
  /// Create hex string from sRGB array.
  srgb_hex (srgb) {
    return S.srgb_hex (srgb);
  }
  /// Create sRGB hex string from ZCAM perceptual color attributes.
  zcam_hex (srgb) {
    return this.srgb_hex (Z.srgb_from_zcam (srgb, this.viewing));
  }
  /// Retrieve sRGB coordinates and assign `inside` to true if within 8bit sRGB gamut.
  contains (zcam) {
    const {r, g, b} = Z.linear_rgb_from_zcam (zcam, this.viewing);
    const inside = S.linear_rgb_inside_8bit_gamut ({r, g, b});
    return { r: S.srgb_companding (r), g: S.srgb_companding (g), b: S.srgb_companding (b), inside };
  }
  /// Return Boolean if `zcam` transforms into sRGB coordinates within gamut.
  inside (zcam) {
    const {r, g, b} = Z.linear_rgb_from_zcam (zcam, this.viewing);
    return S.linear_rgb_inside_8bit_gamut ({r, g, b});
  }
  _optimize_Jz (hz, Cz, maximize, eps) {
    const viewing = this.viewing;
    const cusp = this.find_cusp (hz); // hz, Jz, Cz
    if (Cz >= cusp.Cz)
      return cusp.Jz;
    if (Cz < 1e-7)
      return maximize > 0 ? 100 : 0;
    const jz_inside = Jz => S.rgb_inside_gamut (Z.linear_rgb_from_zcam ({ hz, Cz, Jz }, viewing));
    const optimize = maximize > 0 ? M.bsearch_max : M.bsearch_min;
    const minJz = maximize > 0 ? cusp.Jz : 0;
    const maxJz = maximize > 0 ? 100 : cusp.Jz;
    return optimize (jz_inside, minJz, maxJz, eps);
  }
  /// Find maximum Jz within gamut for `zcam` hue and chroma.
  maximize_Jz (zcam, eps = 2e-3) {
    const viewing = this.viewing;
    if (isNaN (zcam.Cz)) {
      zcam = Object.assign ({}, zcam);
      zcam.Qz = undefined;
      zcam.Jz = 21 / 2; // calculating Cz for Jz==0 would be invalid
      zcam = Z.zcam_ensure_Cz (zcam, viewing);
    }
    const { hz, Cz } = zcam;
    return this._optimize_Jz (hz, Cz, +1, eps);
  }
  /// Find minimum Jz within gamut for `zcam` hue and chroma.
  minimize_Jz (zcam, eps = 2e-3) {
    const viewing = this.viewing;
    if (isNaN (zcam.Cz)) {
      zcam = Object.assign ({}, zcam);
      zcam.Qz = undefined;
      zcam.Jz = 21 / 2; // calculating Cz for Jz==0 would be invalid
      zcam = Z.zcam_ensure_Cz (zcam, viewing);
    }
    const { hz, Cz } = zcam;
    return this._optimize_Jz (hz, Cz, -1, eps);
  }
  /// Find maximum Sz within gamut for `zcam` hue and lightness.
  maximize_Sz (zcam, eps = 2e-3) {
    zcam = Object.assign ({}, zcam);
    const Cz = this._mut_maximize_Cz (zcam, 0.5 * eps);
    const { hz, Jz, viewing } = zcam;
    return Z.zcam_ensure_Sz ({ hz, Jz, Cz, viewing }).Sz;
  }
  /// Find maximum Cz within gamut for `zcam` hue and lightness.
  maximize_Cz (zcam, eps = 1e-3) {
    zcam = Object.assign ({}, zcam);
    return this._mut_maximize_Cz (zcam, eps);
  }
  // Ensure `zcam` contains needed fields and find maximum Cz.
  _mut_maximize_Cz (zcam, eps) {
    const viewing = this.viewing;
    zcam = Z.zcam_ensure_Jz (zcam, viewing);
    const { hz, Jz } = zcam;
    let hash, maxCz;
    const cz_inside = Cz => S.rgb_inside_gamut (Z.linear_rgb_from_zcam ({ hz, Jz, Cz }, viewing));
    if (!this.cached_Cz)
      return M.bsearch_max (cz_inside, 0, this.maxCz || 101, eps);
    const U16 = 1 << 16, hzw = U16 / 360, jzw = (U16 - 1) / 100;
    hash = (Math.floor (hz * hzw) * U16 + Math.floor (Jz * jzw)) >>> 0;
    maxCz = this.cached_Cz.get (hash >>> 0);
    if (maxCz !== undefined)
      return maxCz;
    const spline_hz = this._spline_hz (hz);
    const cuspCz = this.Cz_spline.splint (spline_hz);
    maxCz = M.bsearch_max (cz_inside, 0, cuspCz, 1e-3);
    this.cached_Cz.set (hash, maxCz);
    return maxCz;
  }
  _cached_maximize_Cz (hz, Jz) {
    if (!this.cached_Cz) return undefined;
    const U16 = 1 << 16, hzw = U16 / 360, jzw = (U16 - 1) / 100;
    const hash = (Math.floor (hz * hzw) * U16 + Math.floor (Jz * jzw)) >>> 0;
    const maxCz = this.cached_Cz.get (hash >>> 0);
    return maxCz;
  }
  /// Find and cache cusps (Jz, Cz) for all hues.
  async cache_cusps (cfg = {}) {
    const fdump = cfg.fdump;
    if (this.Cz_spline) return;
    await 0; // distribute slow work
    const viewing = this.viewing;
    // calculation accuracy of reference values
    const cusp_epsilon = 1e-5;
    // accuracy for spline control point selection
    const spline_epsilon = 1e-3;

    // find hues with exact min/max extrema of Jz
    const hue_find_cusp = h => Z.zcam_hue_find_cusp (h, cusp_epsilon, 101, viewing);
    const spots = [ 42, 102, 133, 204, 258, 321, 402 ]; // rough guesses
    for (const [i, spot] of spots.entries()) {
      const gss_minmax = i % 2 ? M.gss_max : M.gss_min;
      // accuracy is important for spline segmentation
      const {x, _y} = gss_minmax (h => hue_find_cusp (h).Jz, spot - 22, spot + 22, 1e-7);
      this.extrema.push (x);
      await 0; // distribute slow work
    }

    // calculate hue samples close to extrema and at equidistant positions
    let xs = [...this.extrema], ys, zs = [], dstep = 0.5;
    for (const x of this.extrema) {
      // offset epsilon by more than *10 to avoid perturbations due to interval nesting inaccuracies
      for (let d = cusp_epsilon * 100; d < dstep; d = d * 2) {
	xs.push (x - d);
	xs.push (x + d);
      }
    }
    for (let i = 0; i < this.extrema[this.extrema.length -1]; i += dstep)
      xs.push (i);
    xs = xs.sort ((a, b) => a - b).filter ((x,i,a) => !i || x != a[i-1]); // sort | uniq
    // Calculate cusp samples
    fdump && console.log ("Calculate cusp samples:", xs.length + '…');
    for (let i = 0; i < xs.length; i++) {
      zs.push (hue_find_cusp (xs[i]));
      if (0 == (i & 0x1f))
	await 0; // distribute slow work
    }
    await 0; // distribute slow work

    // Jz Spline
    ys = zs.map (z => z.Jz);
    this.Jz_spline = fit_spline_segments (xs, ys, this.extrema, spline_epsilon, 256, this.extrema,
					  !fdump ? null : (n, d) => fdump ('xg-jz' + n, d));
    fdump && fdump ('xg-jzf', xs.map ((x, i) => x + ' ' + ys[i]).join ('\n')); // Jz function
    await 0; // distribute slow work

    // Cz Spline
    ys = zs.map (z => z.Cz);
    this.Cz_spline = fit_spline_segments (xs, ys, this.extrema, spline_epsilon, 256, this.extrema,
					  !fdump ? null : (n, d) => fdump ('xg-cz' + n, d));
    fdump && fdump ('xg-czf', xs.map ((x, i) => x + ' ' + ys[i]).join ('\n')); // Cz function
    await 0; // distribute slow work

    // Cz maximum
    this.minCz = Array.from (this.Cz_spline.a).reduce ((p, n) => Math.min (p, n));
    this.maxCz = Array.from (this.Cz_spline.a).reduce ((p, n) => Math.max (p, n));

    // Setup Cz cache
    const cache_Cz = cfg.cache_Cz === undefined ? 4 : cfg.cache_Cz;
    if (cache_Cz > 0)
      this.cached_Cz = new HT.Float64Table (1024, 1024 * 1024 * cache_Cz);
  }
  /// Shift `hz` into range approximated by splines.
  _spline_hz (hz) {
    const max_hue = this.extrema[this.extrema.length-1];
    while (hz > max_hue)
      hz -= 360;
    while (hz < this.extrema[0])
      hz += 360;
    return hz;
  }
  /// Find (Jz, Cz) cusp for `hz°`.
  find_cusp (hz) {
    // calculation accuracy of reference values
    const cusp_epsilon = 1e-5;
    if (!this.Jz_spline)
      return Z.zcam_hue_find_cusp (hz, cusp_epsilon, 101, this.viewing);
    const spline_hz = this._spline_hz (hz);
    const Jz = this.Jz_spline.splint (spline_hz);
    const Cz = this.Cz_spline.splint (spline_hz);
    return { hz, Jz, Cz, viewing: this.viewing };
  }
  /// Return `zcam` so Jz and Cz are within sRGB.
  clamp_chroma (zcam, eps = 1e-3) {
    const viewing = this.viewing;
    const hz = zcam.hz;
    // clamp Jz against black, white thresholds
    let zcam1;
    if (isNaN (zcam.Jz))
      zcam = Z.zcam_ensure_Jz (zcam1 = Object.assign ({}, zcam), this.viewing);
    const Jz = zcam.Jz;
    if (Jz <= 0.0015)
      return { hz, Jz: 0, Cz: 0, viewing };
    if (Jz >= 99.9985)
      return { hz, Jz: 100, Cz: 0, viewing };
    // check chroma
    if (isNaN (zcam.Cz))
      zcam = Z.zcam_ensure_Cz (zcam1 ? zcam1 : zcam1 = Object.assign ({}, zcam), this.viewing);
    let Cz = zcam.Cz;
    if (Cz <= eps)
      return { hz, Jz, Cz: 0, viewing };
    // clamp Cz against cached values
    const maxCz = this._cached_maximize_Cz (hz, Jz);
    if (maxCz !== undefined)
      return { hz, Jz, Cz: Math.min (maxCz, Cz), viewing };
    // find Cz inside gamut
    const cz_inside = Cz => S.rgb_inside_gamut (Z.linear_rgb_from_zcam ({ hz, Jz, Cz }, viewing));
    if (!cz_inside (Cz))
      Cz = this._mut_maximize_Cz ({ hz, Jz, Cz }, eps);
    return { hz, Jz, Cz, viewing };
  }
}

// == Spline fitting ==
function fit_spline_segments (xs, ys, segpointes, eps, pmax, fixed = [], fdump) {
  const spline = new M.CubicSpline();
  for (let j = 1; j < segpointes.length; j++) {
    const spline_xs = [], spline_ys = [];
    for (let i = 0; i < xs.length; i++)
      if (xs[i] >= segpointes[j-1] && xs[i] <= segpointes[j]) {
	spline_xs.push (xs[i]);
	spline_ys.push (ys[i]);
      }
    let { spline: seg, diff } = M.spline_fit (spline_xs, spline_ys, eps, 37, fixed);
    if (fdump) console.log ("segment:", "points=" + seg.x.length, "diff=" + diff);
    spline.add_segment (seg.x, seg.a);
  }
  if (fdump) {
    console.log ("Spline:", "points=" + spline.x.length);
    const vs = [], K = 57;
    for (let i = 1; i < spline.x.length; i++)
      for (let j = 0; j <= K; j++) {
	const x = spline.x[i-1] + (spline.x[i] - spline.x[i-1]) * j / K;
	const y = spline.splint (x);
	vs.push (x + ' ' + y);
      }
    fdump ('s', vs.join ('\n')); // points
    fdump ('p', Array.from (spline.x).map ((v, i) => v + ' ' + spline.a[i]).join ('\n') + '\n'); // spline eval
  }
  return spline;
}

// == test ==
async function main (args) {
  const assert = await import ('assert');
  const plot = args.indexOf ('--plot') >= 0;
  const FS = !plot ? null : await import ('fs');	// use module 'fs' to create gnuplot files
  const rnd = (v, digits = 0) => Math.round (v * 10**digits) / 10**digits;
  const rnd2 = v => rnd (v, 2);
  const g = new Gamut();
  let c = g.contains ({ Jz: 99, Sz: 43, hz: 258 });
  assert.deepEqual (c.inside, false); // not inside
  assert.deepEqual (c.b > c.g && c.b > c.r, true); // is blue
  c = g.contains ({ Jz: 50, Sz: 20, hz: 258 });
  assert.deepEqual (c.inside, true); // is inside
  assert.deepEqual (c.b > c.g && c.b > c.r, true); // is blue
  assert.deepEqual (rnd2 (g.zcam ('#ff0000').hz), 42.48); // is red
  assert.deepEqual (S.srgb_hex (g.contains ({ Jz: 50, Sz: 0, hz: 0 })), '#737373');
  function fdump (filename, contents) {
    FS.writeFileSync (filename, contents);
    console.log (filename, contents.length, "bytes");
  }
  await g.cache_cusps ({
    fdump: FS ? fdump : null,
  });
  assert.deepEqual (rnd2 (g.clamp_chroma ({ hz: 258, Cz: 42, Jz: 79.5 }).Cz), 20.07);

  const tCusp = g.find_cusp (317.8940326089312);
  const tjz = { hz: tCusp.hz, Cz: 0.99 * tCusp.Cz, Jz: 0 };
  tjz.Jz = g.minimize_Jz (tjz);
  assert.ok (tjz.Jz > 60 && tjz.Jz < 80, "invalid optimize_Jz: " + tjz);
  tjz.Jz = g.maximize_Jz (tjz);
  assert.ok (tjz.Jz > 60 && tjz.Jz < 80, "invalid optimize_Jz: " + tjz);

  if (FS)
    console.log (`plot "xg-jzf" with lines, "xg-jzs" with lines, "xg-jzp", "xg-czf" with lines, "xg-czs" with lines, "xg-czp", ${g.minCz}, ${g.maxCz}`);
}
if (!process.ROLLUP && process.argv[1] == import.meta.url.replace (/^file:\/\//, ''))
  process.exit (await main (process.argv.splice (2)));
