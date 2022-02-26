// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

import * as M from './math.js';

// == Jzazbz color space ==
const Jzazbz_b = 1.15, Jzazbz_g = 0.66, Jzazbz_d0 = 1.6295499532821566e-11;
const Jzazbz_η = 2610 / 2**14, Jzazbz_ρ = 1.7 * 2523 / 2**5;
const Jzazbz_c1 = 3424 / 2**12, Jzazbz_c2 = 2413 / 2**7, Jzazbz_c3 = 2392 / 2**7;
const Jzazbz_M1 = [ [0.41478972, 0.579999, 0.0146480], [-0.2015100, 1.120649, 0.0531008], [-0.0166008, 0.264800, 0.6684799] ];
const Jzazbz_R1 = [ [ 1.9242264357876069,   -1.0047923125953657,   0.037651404030618014],
		    [ 0.35031676209499912,   0.72648119393165533, -0.065384422948085025 ],
		    [-0.090982810982847592, -0.31272829052307399,  1.5227665613052606 ] ]; // == Jzazbz_M1^-1

/// Convert from absolute XYZ (D65/2°) to Jzazbz color space.
export function Jzazbz_from_xyz ({ x: x65, y: y65, z: z65 }) {
  // Perceptually uniform color space for image signals including high dynamic range and wide gamut
  // https://doi.org/10.1364/OE.25.015131
  const X_D65 = Jzazbz_b*x65 - (Jzazbz_b-1)*z65;
  const Y_D65 = Jzazbz_g*y65 - (Jzazbz_g-1)*x65;
  const LMS = M.matrix33_mul3 (Jzazbz_M1, [X_D65, Y_D65, z65]);
  const PQ = v => {
    const vη = (v / 10000)**Jzazbz_η;
    return ((Jzazbz_c1 + Jzazbz_c2 * vη) / (1 + Jzazbz_c3 * vη))**Jzazbz_ρ;
  }
  const [L_, M_, S_] = LMS.map (v => PQ (v));
  const az = +3.524000 * L_ -4.066708 * M_ +0.542708 * S_;
  const bz = +0.199076 * L_ +1.096799 * M_ -1.295875 * S_;
  const Iz = 0.5 * (L_ + M_);
  const Jz = (0.44 * Iz) / (1 - 0.56*Iz) - Jzazbz_d0;
  return { j: Jz, a: az, b: bz };
}

/// Convert from Jzazbz color space to absolute XYZ (D65/2°).
export function xyz_from_Jzazbz ({ j: Jz, a: az, b: bz }) {
  const Jzd0 = Jz + Jzazbz_d0;
  const Iz = Jzd0 / (0.44 + 0.56 * Jzd0);
  const L_ = Iz +0.13860504327153927  * az +0.058047316156118862 * bz;
  const M_ = Iz -0.13860504327153927  * az -0.058047316156118862 * bz;
  const S_ = Iz -0.096019242026318938 * az -0.81189189605603884  * bz;
  const iη = 1 / Jzazbz_η, iρ = 1 / Jzazbz_ρ;
  const PQinv = v => {
    const vq = v**iρ;
    return 10000 * ((Jzazbz_c1 - vq) / (Jzazbz_c3 * vq - Jzazbz_c2))**iη;
  };
  const RGB = [L_, M_, S_].map (PQinv);
  const [X_, Y_, Z] = M.matrix33_mul3 (Jzazbz_R1, RGB);
  const X = 1/Jzazbz_b * (X_ + (Jzazbz_b-1) * Z);
  const Y = 1/Jzazbz_g * (Y_ + (Jzazbz_g-1) * X);
  return { x: X, y: Y, z: Z };
}

/// Convert from sRGB to Jzazbz color space.
export function Jzazbz_from_srgb (srgb) {
  return Jzazbz_from_xyz (E.xyz_from_srgb (srgb));
}

/// Convert from Jzazbz color space to sRGB array.
export function srgb_from_Jzazbz (Jzazbz) {
  return E.srgb_from_xyz (xyz_from_Jzazbz (Jzazbz));
}
