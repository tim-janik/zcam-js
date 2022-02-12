// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

// == Chromatic adaptation ==
/// Chromatic adaptation of the white point for `xyz_prev` according to CIECAM02.
export function xyz_chromatic_adaptation ({x, y, z}, Wprev, Wref, D = 1) {
  const {x: xp, y: yp, z: zp} = Wprev; // current white point of {x, y, z}
  const {x: xr, y: yr, z: zr} = Wref;  // new reference white point for {x, y, z}
  // The CIECAM02 color appearance model https://scholarworks.rit.edu/other/143
  // D: Degree of adaptation computed using La and surround
  // https://en.wikipedia.org/wiki/CIECAM02#CAT02
  const cat = CAT02_CAT;
  // Some concerns regarding the CAT16 chromatic adaptation transform
  const Ywr2Yw = yp / yr;				// https://lirias.kuleuven.be/retrieve/552107
  const LMSw = M.matrix_mul_v (cat.M, [xp, yp, zp]);	// old white point
  const LMSwr = M.matrix_mul_v (cat.M, [xr, yr, zr]);	// new white point
  const LMS = M.matrix_mul_v (cat.M, [x, y, z]);	// relative to Wprev
  const LMSc = LMS.map ((lms,i) => (Ywr2Yw * LMSwr[i] / LMSw[i] * D + 1 - D) * lms);
  const [xd, yd, zd] = M.matrix_mul_v (cat.I, LMSc);	// relative to Wref
  return { x: xd, y: yd, z: zd };
}

/// CIECAM02 CAT02 chromatic adaptation transforms matrix.
export const CAT02_CAT = {
  // The CIECAM02 color appearance model; https://scholarworks.rit.edu/other/143
  M: [ [ +0.7328, +0.4296, -0.1624 ], [ -0.7036, +1.6975, +0.0061 ], [ +0.0030, +0.0136, +0.9834 ] ],
  I: [ [ +1.096123820835514e0,  -2.788690002182872e-1, +1.827451793827731e-1 ],
       [ +4.543690419753592e-1, +4.735331543074117e-1, +7.20978037172291e-2  ],
       [ -9.627608738429352e-3, -5.698031216113419e-3, +1.015325639954543e0  ] ] };
