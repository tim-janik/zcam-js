// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

import * as M from './math.js';
import * as S from './srgb.js';

// == Jzazbz color space ==
const Jzazbz_b = 1.15, Jzazbz_g = 0.66, Jzazbz_d0 = 1.6295499532821566e-11;
const Jzazbz_η = 2610 / 2**14, Jzazbz_ρ = 1.7 * 2523 / 2**5;
const Jzazbz_iη = 1 / Jzazbz_η, Jzazbz_iρ = 1 / Jzazbz_ρ;
const Jzazbz_c1 = 3424 / 2**12, Jzazbz_c2 = 2413 / 2**7, Jzazbz_c3 = 2392 / 2**7;
const Jzazbz_M1 = [ [0.41478972, 0.579999, 0.0146480], [-0.2015100, 1.120649, 0.0531008], [-0.0166008, 0.264800, 0.6684799] ];
const Jzazbz_R1 = [ [ 1.9242264357876069,   -1.0047923125953657,   0.037651404030618014],
		    [ 0.35031676209499912,   0.72648119393165533, -0.065384422948085025 ],
		    [-0.090982810982847592, -0.31272829052307399,  1.5227665613052606 ] ]; // == Jzazbz_M1^-1

function Jzazbz_PQ (v) {
  // PQ (0 … 1e304) -> 3.703522621019e-11 … 3.22711272562802
  const vη = (v / 10000)**Jzazbz_η;
  return ((Jzazbz_c1 + Jzazbz_c2 * vη) / (1 + Jzazbz_c3 * vη))**Jzazbz_ρ;
}

function Jzazbz_PQinv (v) {
  // PQinv (3.703522621019e-11 … 3.227112725627976130) -> 0.0 … 1.07046320073227e+88
  if (v < 3.0506790660512e-8)	return 1e-7;
  if (v > 2.1581301655179)	return 1e+7;
  const vq = v**Jzazbz_iρ;
  return 10000 * ((Jzazbz_c1 - vq) / (Jzazbz_c3 * vq - Jzazbz_c2))**Jzazbz_iη;
}

/// Convert from sRGB to Jzazbz color space.
export function Jzazbz_from_srgb (srgb) {
  let [r, g, b] = S.srgb_from (srgb);
  r = S.srgb_eotf (r);
  g = S.srgb_eotf (g);
  b = S.srgb_eotf (b);
  // zcam.mac: LRGB_4_JZAZBZ
  const R = 3.58511921774749334e1 * r + 5.091922957421885366e1 * g + 1.040820078800592943e1 * b;
  const G = 2.204457695152168704e1 * r + 5.922847248145243308e1 * g + 1.595169005745199446e1 * b;
  const B = 7.938752681588265631e0 * r + 2.303367492067649837e1 * g + 6.630876550216657741e1 * b;
  const L_ = Jzazbz_PQ (R), M_ = Jzazbz_PQ (G), S_ = Jzazbz_PQ (B);
  const az = +3.524000 * L_ -4.066708 * M_ +0.542708 * S_;
  const bz = +0.199076 * L_ +1.096799 * M_ -1.295875 * S_;
  const Iz = 0.5 * (L_ + M_);
  const Jz = (0.44 * Iz) / (1 - 0.56*Iz) - Jzazbz_d0;
  return [Jz, az, bz];
}

/// Convert from absolute XYZ (D65/2°) to Jzazbz color space.
export function Jzazbz_from_xyz ({ x: x65, y: y65, z: z65 }) {
  // Perceptually uniform color space for image signals including high dynamic range and wide gamut
  // https://doi.org/10.1364/OE.25.015131
  const X_D65 = Jzazbz_b*x65 - (Jzazbz_b-1)*z65;
  const Y_D65 = Jzazbz_g*y65 - (Jzazbz_g-1)*x65;
  const LMS = M.matrix33_mul3 (Jzazbz_M1, [X_D65, Y_D65, z65]);
  const [L_, M_, S_] = LMS.map (v => Jzazbz_PQ (v));
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
  const RGB = [L_, M_, S_].map (Jzazbz_PQinv);
  const [X_, Y_, Z] = M.matrix33_mul3 (Jzazbz_R1, RGB);
  const X = 1/Jzazbz_b * (X_ + (Jzazbz_b-1) * Z);
  const Y = 1/Jzazbz_g * (Y_ + (Jzazbz_g-1) * X);
  return { x: X, y: Y, z: Z };
}

/// Convert from Jzazbz color space to sRGB array.
export function srgb_from_Jzazbz ([Jz, az, bz]) {
  const Jzd0 = Jz + Jzazbz_d0;
  const Iz = Jzd0 / (0.44 + 0.56 * Jzd0);
  const L_ = Iz +0.13860504327153927  * az +0.058047316156118862 * bz;
  const M_ = Iz -0.13860504327153927  * az -0.058047316156118862 * bz;
  const S_ = Iz -0.096019242026318938 * az -0.81189189605603884  * bz;
  const R = Jzazbz_PQinv (L_), G = Jzazbz_PQinv (M_), B = Jzazbz_PQinv (S_);
  // zcam.mac: JZAZBZ_4_LRGB
  const r = 5.929652233247211478e-2 * R + -5.224597023432028461e-2 * G + 3.261128627931201466e-3 * B;
  const g = -2.223843357025295048e-2 * R + 3.822057767168349576e-2 * G + -5.703932567002518455e-3 * B;
  const b = 6.257456855404509128e-4 * R + -7.021583369018091867e-3 * G + 1.667190191984017222e-2 * B;
  return [S.srgb_companding (r), S.srgb_companding (g), S.srgb_companding (b)];
}

// == Izazbz color space ==
const Izazbz_ϵ = 3.7035226210190005e-11;

/// Convert from sRGB to Izazbz color space.
export function Izazbz_from_srgb (srgb) {
  let [r, g, b] = S.srgb_from (srgb);
  r = S.srgb_eotf (r);
  g = S.srgb_eotf (g);
  b = S.srgb_eotf (b);
  // zcam.mac: LRGB_4_JZAZBZ
  const R = 3.58511921774749334e1 * r + 5.091922957421885366e1 * g + 1.040820078800592943e1 * b;
  const G = 2.204457695152168704e1 * r + 5.922847248145243308e1 * g + 1.595169005745199446e1 * b;
  const B = 7.938752681588265631e0 * r + 2.303367492067649837e1 * g + 6.630876550216657741e1 * b;
  const R_ = Jzazbz_PQ (R), G_ = Jzazbz_PQ (G), B_ = Jzazbz_PQ (B);
  const az = +3.524000 * R_ -4.066708 * G_ +0.542708 * B_;
  const bz = +0.199076 * R_ +1.096799 * G_ -1.295875 * B_;
  const Iz = G_ - Izazbz_ϵ;
  return { Iz, az, bz };
}

/// Convert from absolute XYZ (D65/2°) to Izazbz color space.
export function Izazbz_from_xyz ({ x: X, y: Y, z: Z }) {
  const X_D65 = Jzazbz_b*X - (Jzazbz_b-1)*Z; // use Z in second term, wrong in ZCAM paper, right in Jzazbz, fix via inverse(ZCAM supplement)
  const Y_D65 = Jzazbz_g*Y - (Jzazbz_g-1)*X; // use X in second term, wrong in ZCAM paper, right in Jzazbz, fix via inverse(ZCAM supplement)
  const [R, G, B] = M.matrix33_mul3 (Jzazbz_M1, [X_D65, Y_D65, Z]);
  const [R_, G_, B_] = [Jzazbz_PQ (R), Jzazbz_PQ (G), Jzazbz_PQ (B)];
  const az = +3.524000 * R_ -4.066708 * G_ +0.542708 * B_;
  const bz = +0.199076 * R_ +1.096799 * G_ -1.295875 * B_;
  const Iz = G_ - Izazbz_ϵ;
  return { Iz, az, bz };
}

/// Convert from Izazbz color space to linear RGB object.
export function linear_rgb_from_Izazbz ({ Iz, az, bz }) {
  const I = Iz + Izazbz_ϵ;
  const R_ = I +0.2772100865430786 * az +0.11609463231223774 * bz;
  const G_ = I; // +0 +0
  const B_ = I +0.042585801245220344 * az -0.75384457989992004 * bz;
  const [R, G, B] = [Jzazbz_PQinv (R_), Jzazbz_PQinv (G_), Jzazbz_PQinv (B_)];
  // zcam.mac: JZAZBZ_4_LRGB
  const r = 5.929652233247211478e-2 * R + -5.224597023432028461e-2 * G + 3.261128627931201466e-3 * B;
  const g = -2.223843357025295048e-2 * R + 3.822057767168349576e-2 * G + -5.703932567002518455e-3 * B;
  const b = 6.257456855404509128e-4 * R + -7.021583369018091867e-3 * G + 1.667190191984017222e-2 * B;
  return {r, g, b};
}

/// Convert from Izazbz color space to sRGB array.
export function srgb_from_Izazbz (Izazbz) {
  const {r, g, b} = linear_rgb_from_Izazbz (Izazbz);
  return [S.srgb_companding (r), S.srgb_companding (g), S.srgb_companding (b)];
}

/// Convert from Izazbz color space to absolute XYZ (D65/2°).
export function xyz_from_Izazbz ({ Iz, az, bz }) {
  const I = Iz + Izazbz_ϵ;
  const R_ = I +0.2772100865430786 * az +0.11609463231223774 * bz;
  const G_ = I; // +0 +0
  const B_ = I +0.042585801245220344 * az -0.75384457989992004 * bz;
  const RGB = [Jzazbz_PQinv (R_), Jzazbz_PQinv (G_), Jzazbz_PQinv (B_)];
  const [X_, Y_, Z] = M.matrix33_mul3 (Jzazbz_R1, RGB);
  const X = 1/Jzazbz_b * (X_ + (Jzazbz_b-1) * Z);
  const Y = 1/Jzazbz_g * (Y_ + (Jzazbz_g-1) * X);
  return { x: X, y: Y, z: Z };
}
