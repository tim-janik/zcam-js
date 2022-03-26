// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

import * as M from './math.js';

// == Chromatic adaptation ==
/// Chromatic adaptation of the white point for `xyz_prev` according to CIECAM02.
export function xyz_chromatic_adaptation ({x, y, z}, Wprev, Wref, D = 1, cat = null) {
  const {x: xp, y: yp, z: zp} = Wprev; // current white point of {x, y, z}
  const {x: xr, y: yr, z: zr} = Wref;  // new reference white point for {x, y, z}
  // The CIECAM02 color appearance model https://scholarworks.rit.edu/other/143
  // D: Degree of adaptation computed using La and surround
  // https://en.wikipedia.org/wiki/CIECAM02#CAT02
  cat = cat && cat.M && cat.I ? cat : BS_CAT;	// cat.I = matrix_invert (cat.M);
  // Some concerns regarding the CAT16 chromatic adaptation transform
  const Ywr2Yw = yp / yr;				// https://lirias.kuleuven.be/retrieve/552107
  const LMSw = M.matrix_mul_v (cat.M, [xp, yp, zp]);	// old white point
  const LMSwr = M.matrix_mul_v (cat.M, [xr, yr, zr]);	// new white point
  const LMS = M.matrix_mul_v (cat.M, [x, y, z]);	// relative to Wprev
  const LMSc = LMS.map ((lms,i) => (Ywr2Yw * LMSwr[i] / LMSw[i] * D + 1 - D) * lms);
  const [xd, yd, zd] = M.matrix_mul_v (cat.I, LMSc);	// relative to Wref
  return { x: xd, y: yd, z: zd };
}

/// Invert a previous adaptation to `Wref` that resulted in `xyz_dst`.
export function xyz_chromatic_adaptation_invert ({x, y, z}, Wref, Wprev, D = 1, cat = null) {
  const {x: xr, y: yr, z: zr} = Wref;  // current white point of {x, y, z}
  const {x: xp, y: yp, z: zp} = Wprev; // new target white point for {x, y, z}
  // See the forward version xyz_chromatic_adaptation() for commentary
  cat = cat && cat.M && cat.I ? cat : BS_CAT;  // cat.I = matrix_invert (cat.M);
  const Ywr2Yw = yp / yr;
  const LMSw = M.matrix_mul_v (cat.M, [xp, yp, zp]);
  const LMSwr = M.matrix_mul_v (cat.M, [xr, yr, zr]);
  const LMSc = M.matrix_mul_v (cat.M, [x, y, z]);
  const LMS = LMSc.map ((lmsc,i) => (lmsc * LMSw[i]) / (D * LMSwr[i] * Ywr2Yw + (1 - D) * LMSw[i]));
  const [xd, yd, zd] = M.matrix_mul_v (cat.I, LMS);
  return { x: xd, y: yd, z: zd };
}

/// CIECAM02 CAT02 chromatic adaptation transforms matrix.
export const CAT02_CAT = {
  // The CIECAM02 color appearance model; https://scholarworks.rit.edu/other/143
  M: [ [ +0.7328, +0.4296, -0.1624 ], [ -0.7036, +1.6975, +0.0061 ], [ +0.0030, +0.0136, +0.9834 ] ],
  I: [ [ +1.096123820835514e0,  -2.788690002182872e-1, +1.827451793827731e-1 ],
       [ +4.543690419753592e-1, +4.735331543074117e-1, +7.20978037172291e-2  ],
       [ -9.627608738429352e-3, -5.698031216113419e-3, +1.015325639954543e0  ] ] };

/// S. Bianco, R. Schettini (2010) chromatic adaptation transforms matrix.
export const BS_CAT = {
  // Two New von Kries Based Chromatic Adaptation Transforms Found by Numerical Optimization
  // https://web.stanford.edu/~sujason/ColorBalancing/Papers/Two%20New%20von%20Kries%20Based%20Chromatic%20Adaptation.pdf
  // A von Kries based chromatic adaptation transforms that outperforms existent CATs (2010)
  M: [ [0.8752, 0.2787, -0.1539], [-0.8904, 1.8709, 0.0195], [-0.0061, 0.0162, 0.9899] ],
  I: [ [9.919708341864988e-1, -1.491305030322726e-1, 1.571596688457738e-1],
       [4.721162516131751e-1, 4.6361647918884e-1, 6.426726919798491e-2],
       [-1.613558124654806e-3, -8.506195606986636e-3, 1.010119753731641e0] ] };
/// S. Bianco, R. Schettini (2010) chromatic adaptation transforms matrix without negative lobes.
export const BS_PC_CAT = {
  M: [ [0.6489, 0.3915, -0.0404], [-0.3775, 1.3055, 0.0720], [-0.0271, 0.0888, 0.9383] ],
  // A von Kries based CAT without negative lobes
  I: [ [1.31231502986015e0, -3.994721455894366e-1, 8.715711572928647e-2],
       [3.793603435220356e-1, 6.545307997171692e-1, -3.389114323920488e-2],
       [1.999934780404241e-3, -7.348186098301007e-2, 1.071481926202606e0] ] };
/// Li, Changjun et al, "The Problem with CAT 02 and Its Correction" chromatic adaptation transforms matrix.
export const LPLV_CAT = {
  // The Problem with CAT02 and Its Correction
  // https://rua.ua.es/dspace/bitstream/10045/18684/1/CAT02-CRA.pdf
  M: [ [ 1.007245, 0.011136, -0.018381], [-0.318061, 1.314589,  0.003471], [0, 0, 1] ],
  I: [ [9.901584949593542e-1, -8.387720420502049e-3, 1.822921707342745e-2],
       [2.3956597922641e-1,    7.586646421469635e-1, 1.770137291268533e-3], [0, 0, 1] ] };

// == tests ==
async function main (args) {
  const assert = await import ('assert');
  const rnd = (v, d = 0) => Math.round (v * 10**d) / 10**d, rnd3 = v => rnd (v, 3), rnd7 = v => rnd (v, 7);
  const xyz_ref = { x: 95.0429, y: 100, z: 108.89 };
  const xyz_100 = { x: 100, y: 100, z: 100 };
  let xyz_dest = xyz_chromatic_adaptation (xyz_100, xyz_100, xyz_ref);
  assert.deepEqual (Object.values (xyz_dest).map (rnd7), Object.values (xyz_ref));
  xyz_dest = xyz_chromatic_adaptation_invert (xyz_ref, xyz_ref, xyz_100);
  assert.deepEqual (Object.values (xyz_dest).map (rnd7), Object.values (xyz_100));
  const xyz_918 = { x: 96.42, y: 100, z: 82.49 }, D = 0.98765;
  xyz_dest = xyz_chromatic_adaptation ({ x: 50, y: 70, z: 60 }, xyz_918, xyz_ref, D);
  xyz_dest = xyz_chromatic_adaptation_invert (xyz_dest, xyz_ref, xyz_918, D);
  assert.deepEqual (Object.values (xyz_dest).map (rnd7), Object.values ({ x: 50, y: 70, z: 60 }));
}
if (!process.ROLLUP && process.argv[1] == import.meta.url.replace (/^file:\/\//, ''))
  process.exit (await main (process.argv.splice (2)));
