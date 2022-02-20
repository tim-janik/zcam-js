// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

import * as A from './adaptation.js';
import * as M from './math.js';

const deg2rad = Math.PI / 180;
const rad2deg = 180 / Math.PI;

// == ZCAM color appearance model ==
export const ZCAM_DARK = 0.525;
export const ZCAM_DIM = 0.59;
export const ZCAM_AVERAGE = 0.69;

// ZCAM_D65 uses this XYZ white point; https://github.com/ksmet1977/luxpy/issues/20#issuecomment-943276940
const zcam_white_point = { x: 95.0429, y: 100, z: 108.89 };
const _zcam_setup = Symbol ('zcam_setup');

/// Default ZCAM viewing conditions, with ZCAM D65/2° white point in `[Xw,Yw,Zw]`
export const zcam_viewing = zcam_setup ({
  // Safdar21, A colour appearance model based on a high dynamic range uniform colour space; https://opg.optica.org/oe/fulltext.cfm?uri=oe-29-4-6036&id=447640
  // MacEvoy2005; https://www.handprint.com/HP/WCL/color7.html#CAMformulas
  // Moroney2000; https://www.semanticscholar.org/paper/Usage-Guidelines-for-CIECAM97s-Moroney/bf210c5b24dd55285f4c4b51cbb1d3174bfa68da
  // Green2010, Color Management: Understanding and Using ICC Profiles; https://www.wiley.com/en-us/Color+Management+:+Understanding+and+Using+ICC+Profiles-p-9780470058251
  Fs: ZCAM_DIM,			// Average indicates surround is at >= 20% of illuminant [Moroney2000]
  Yb: 20,			// 20% reflectance, "Grey World" assumption [Moroney2000]
  La: 100,			// cd/m² = Lw * Yb / 100 (Luminance of the adapting field) [Safdar21]
  Xw: zcam_white_point.x,
  Yw: zcam_white_point.y,	// cd/m², Luminance of the adopted white point (Lw = 100)
  Zw: zcam_white_point.z,
}, {});

/// Precalculate ZCAM `viewing` auxillary values.
export function zcam_setup (viewing, fallback_viewing = zcam_viewing) {
  if (Object.isFrozen (viewing) && viewing[_zcam_setup])
    return viewing;
  // merge with missing values into new instance
  viewing = Object.assign ({}, fallback_viewing, viewing);
  const Fs = viewing.Fs;
  const Fb = Math.sqrt (viewing.Yb / viewing.Yw);
  const FL = 0.171 * viewing.La ** (1/3) * (1 - Math.exp (-48/9 * viewing.La));
  const F = viewing.Fs >= ZCAM_AVERAGE ? 1.0 : viewing.Fs >= ZCAM_DIM ? 0.9 : 0.8; // The CIECAM02 color appearance model
  const D = F * (1.0 - 1/3.6 * Math.exp ((viewing.La + 42.0) / -92.0));	// https://en.wikipedia.org/wiki/CIECAM02#CAT02
  const ZCAM_D65 = zcam_white_point;
  const IzExp = Fb**0.12 / (1.6 * viewing.Fs);
  const IzDiv = 2700 * viewing.Fs**2.2 * Fb**0.5 * FL**0.2;
  const whitepoint2d65 = w => w; // untransformed, the ZCAM paper expects the white point relative to D65
  const Izw = Izazbz_from_xyz (whitepoint2d65 ({ x: viewing.Xw, y: viewing.Yw, z: viewing.Zw }))[0];
  const Qexp = 1.6 * viewing.Fs / Fb**0.12;
  const Qmul = 2700 * viewing.Fs**2.2 * Math.sqrt (Fb) * FL**0.2;
  const Qzw = Qmul * Izw**Qexp;
  const strict = !!viewing.strict;
  const setup = { D, F, Fs, Fb, FL, Qexp, Qmul, Qzw, IzExp, IzDiv, Izw, strict, ZCAM_D65: Object.freeze (ZCAM_D65) };
  viewing[_zcam_setup] = Object.freeze (setup);
  return Object.freeze (viewing);
}

/// Calculate ZCAM perceptual color attributes.
export function zcam_from_xyz (xyz, viewing = undefined) {
  // ZCAM, a colour appearance model based on a high dynamic range uniform colour space
  // https://opg.optica.org/oe/fulltext.cfm?uri=oe-29-4-6036&id=447640
  viewing = zcam_setup (viewing ? viewing : zcam_viewing);
  const { IzDiv, IzExp, Qzw, Qmul, Qexp, Izw, Fb, FL, D, strict, ZCAM_D65 } = viewing[_zcam_setup];
  const xyz65 = A.xyz_chromatic_adaptation (xyz, { x: viewing.Xw, y: viewing.Yw, z: viewing.Zw }, ZCAM_D65, D, strict ? A.CAT02_CAT : null);
  const [Iz, az, bz] = Izazbz_from_xyz (xyz65);
  let hz = Math.atan2 (bz, az) * rad2deg;
  if (hz < 0) hz += 360;
  // step 4: Hue Composition (TODO)
  // Hue Quadrature Table:
  // i:   1      2      3      4      5
  // hi: 33.44  89.29 146.30 238.36 393.44
  // ei:  0.68   0.64   1.52   0.77   0.68
  // Hi:  0    100    200    300    400
  const h1 = 33.44, h_ = hz < h1 ? hz + 360 : hz;
  const ez = 1.015 + Math.cos ((89.038 + h_) * deg2rad); // beware, h_ in °, but cos() takes radians
  // brightness
  const Qz  = Qmul * Iz**Qexp;
  // lightness
  const Jz = 100 * (Qz / Qzw);
  // colorfulness
  const Mz = 100 * (az**2 + bz**2)**0.37 * (ez**0.068 * FL**0.2) / (Fb**0.1 * Izw**0.78);
  // chroma
  const Cz = 100 * (Mz / Qzw);
  // saturation
  const Sz = 100 * FL**0.6 * Math.sqrt (Mz / Math.max (Qz, 1e-17)); // Note, avoid NaN for Qz==0
  // vividness
  const Vz = Math.sqrt ((Jz - 58)**2 + 3.4 * Cz**2);
  // blackness
  const Kz = 100 - 0.8 * Math.sqrt (Jz**2 + 8 * Cz**2);
  // whiteness
  const Wz = 100 - Math.sqrt ((100 - Jz)**2 + Cz**2);
  // result
  const zcam = { X: xyz[0], Y: xyz[1], Z: xyz[2], xyz65,
		 FL, Fb, Iz, az, bz, hz, Qz, Jz, Mz, Cz, Sz, Vz, Kz, Wz,
		 viewing };
  return zcam;
}

/// Construct absolute XYZ values from ZCAM perceptual color attributes.
export function xyz_from_zcam (zcam, viewing = undefined) {
  // Supplementary document for ZCAM, a psychophysical model for colour appearance prediction
  // https://opticapublishing.figshare.com/articles/journal_contribution/Supplementary_document_for_ZCAM_a_psychophysical_model_for_colour_appearance_prediction_-_5022171_pdf/13640927
  const zcam_missing = s => { const m = "xyz_from_zcam(): missing: " + s; console.trace (m); throw m; };
  viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
  const { IzDiv, IzExp, Qzw, Qmul, Qexp, Izw, Fb, FL, D, strict, ZCAM_D65 } = viewing[_zcam_setup];
  const has = v => v !== undefined && !isNaN (v);
  let Iz, Jz, hz, Qz;
  // brightness OR lightness
  if (has (zcam.Qz)) {
    Qz = zcam.Qz;
    Iz = (Qz / IzDiv)**IzExp;
    Jz = 100 * (Qz / Qzw);
  } else if (has (zcam.Jz)) {
    Jz = zcam.Jz;
    Iz = (Jz * 0.01 * Qzw / IzDiv)**IzExp;
    Qz = Qmul * Iz**Qexp;
  } else
    zcam_missing ("Qz OR Jz");
  // Cz OR Sz OR Vz OR Wz OR Kz
  let Cz;
  if (has (zcam.Cz))
    Cz = zcam.Cz;
  else if (has (zcam.Sz))
    Cz = Qz * zcam.Sz * zcam.Sz / (100 * Qzw * FL**1.2);
  else if (has (zcam.Vz))
    Cz = Math.sqrt ((zcam.Vz**2 - (Jz - 58)**2) * (1/3.4));
  else if (has (zcam.Wz))
    Cz = Math.sqrt ((100 - zcam.Wz)**2 - (100 - Jz)**2);
  else if (has (zcam.Kz))
    Cz = Math.sqrt (1.5625 * (100 - zcam.Kz)**2 - Jz**2) / 2**(3/2);
  else
    zcam_missing ("Cz OR Sz OR Vz OR Wz OR Kz");
  // TODO: Hz
  if (has (zcam.hz))
    hz = zcam.hz;
  else
    zcam_missing ("hz");
  const Mz = Cz * Qzw / 100;
  const h1 = 33.44, h_ = hz < h1 ? hz + 360 : hz;
  const ez = 1.015 + Math.cos ((89.038 + h_) * deg2rad); // beware, h_ in °, but cos() takes radians
  const Cz_ = (Mz * Izw**0.78 * Fb**0.1 / (100 * ez**0.068 * FL**0.2))**1.3514;
  // xyz65
  const az = Cz_ * Math.cos (hz * deg2rad);
  const bz = Cz_ * Math.sin (hz * deg2rad);
  const xyz65 = xyz_from_Izazbz ([Iz, az, bz]);
  // xyz @ [Xw,Yw,Zw]
  const xyz = A.xyz_chromatic_adaptation_invert (xyz65, ZCAM_D65, { x: viewing.Xw, y: viewing.Yw, z: viewing.Zw }, D, strict ? A.CAT02_CAT : null);
  return xyz;
}

/// Calculate ZCAM perceptual color attributes from sRGB.
export function zcam_from_srgb (srgb, viewing = undefined) {
  return zcam_from_xyz (E.xyz_from_srgb (srgb), viewing);
}

/// Construct sRGB array from ZCAM perceptual color attributes.
export function srgb_from_zcam (zcam, viewing = undefined) {
  return E.srgb_from_xyz (xyz_from_zcam (zcam, viewing));
}
