// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

import * as M from './math.js';
import * as A from './adaptation.js';
import * as J from './jzazbz.js';
import * as S from './srgb.js';

const deg2rad = Math.PI / 180;
const rad2deg = 180 / Math.PI;

// == ZCAM color appearance model ==
export const ZCAM_DARK = 0.525;
export const ZCAM_DIM = 0.59;
export const ZCAM_AVERAGE = 0.69;

/// XYZ values of the white point used in the ZCAM paper
export const ZCAM_D65 = { x: 95.0429, y: 100, z: 108.89 }; // https://github.com/ksmet1977/luxpy/issues/20#issuecomment-943276940
export const _zcam_setup = Symbol ('zcam_setup');

/// Default ZCAM viewing conditions, with ZCAM D65/2° white point in `[Xw,Yw,Zw]`
export const zcam_viewing = zcam_setup ({
  // Safdar2021, A colour appearance model based on a high dynamic range uniform colour space; https://opg.optica.org/oe/fulltext.cfm?uri=oe-29-4-6036&id=447640
  // MacEvoy2005; https://www.handprint.com/HP/WCL/color7.html#CAMformulas
  // Moroney2000, Usage Guidelines for CIECAM97s; https://www.semanticscholar.org/paper/Usage-Guidelines-for-CIECAM97s-Moroney/bf210c5b24dd55285f4c4b51cbb1d3174bfa68da
  // Moroney1998, A Comparison of CIELAB and CIECAM97s; https://library.imaging.org/cic/articles/6/1/art00005
  // Luo1998, The structure of the CIE 1997 Colour Appearance Model (CIECAM97s); https://www.semanticscholar.org/paper/The-structure-of-the-CIE-1997-Colour-Appearance-Luo-Hunt/475a9a314826b2645d03abc6ad55b5ed3dfe758b
  // Green2010, Color Management: Understanding and Using ICC Profiles; https://www.wiley.com/en-us/Color+Management+:+Understanding+and+Using+ICC+Profiles-p-9780470058251
  Fs: ZCAM_DIM,			// Average indicates surround is at >= 20% of illuminant [Moroney2000]
  Yb: 20,			// 20% reflectance, "Grey World" assumption [Moroney2000]
  La: 100,			// Luminance of the adapting field in cd/m²: La = Lw * Yb / 100 [Safdar2021], La = 1/5 * Lw [Luo1998]
  Xw: ZCAM_D65.x,
  Yw: ZCAM_D65.y,		// cd/m², Luminance of the adopted white point (Lw = 100)
  Zw: ZCAM_D65.z,
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
  const IzExp = Fb**0.12 / (1.6 * viewing.Fs);
  const IzDiv = 1.0 / (2700 * viewing.Fs**2.2 * Fb**0.5 * FL**0.2);
  const whitepoint2d65 = w => w; // untransformed, the ZCAM paper expects the white point relative to D65
  const Izw = J.Izazbz_from_xyz (whitepoint2d65 ({ x: viewing.Xw, y: viewing.Yw, z: viewing.Zw })).Iz;
  const Qexp = 1.6 * viewing.Fs / Fb**0.12;
  const Qmul = 2700 * viewing.Fs**2.2 * Math.sqrt (Fb) * FL**0.2;
  const Qzw = Qmul * Izw**Qexp;
  const ByQzw = 100 / Qzw;
  const ByQzwF = 1.0 / (100 * Qzw * FL**1.2);
  const JzDiv = 0.01 * Qzw * IzDiv;
  const Wpc = Qzw * Izw**0.78 * Fb**0.1 / (100 * 100 * FL**0.2); // White point context factor
  const MzF = FL**0.2 * 100 / (Fb**0.1 * Izw**0.78);
  const SzF = 100 * FL**0.6;
  const strict = !!viewing.strict;
  const setup = { D, Fs, FL, Fb, ByQzwF, MzF, SzF, Qexp, Qmul, Qzw, ByQzw, Wpc, JzDiv, IzExp, IzDiv, Izw, strict, ZCAM_D65: Object.freeze (ZCAM_D65) };
  viewing[_zcam_setup] = Object.freeze (setup);
  return Object.freeze (viewing);
}

/// Calculate ZCAM perceptual color attributes from sRGB.
export function zcam_from_srgb (srgb, viewing = undefined) {
  viewing = zcam_setup (viewing ? viewing : zcam_viewing);
  const { ZCAM_D65 } = viewing[_zcam_setup];
  if (viewing.Xw != ZCAM_D65.x || viewing.Zw != ZCAM_D65.z || viewing.Yw != ZCAM_D65.y)
    return zcam_from_xyz (E.xyz_from_srgb (srgb), viewing);
  return zcam_from_Izazbz (J.Izazbz_from_srgb (srgb), viewing);
}

/// Calculate ZCAM perceptual color attributes.
export function zcam_from_xyz (xyz, viewing = undefined) {
  viewing = zcam_setup (viewing ? viewing : zcam_viewing);
  const { D, strict, ZCAM_D65 } = viewing[_zcam_setup];
  let xyz65 = xyz;
  if (viewing.Xw != ZCAM_D65.x || viewing.Zw != ZCAM_D65.z || viewing.Yw != ZCAM_D65.y)
    xyz65 = A.xyz_chromatic_adaptation (xyz, { x: viewing.Xw, y: viewing.Yw, z: viewing.Zw }, ZCAM_D65, D, strict ? A.CAT02_CAT : null);
  return zcam_from_Izazbz (J.Izazbz_from_xyz (xyz65), viewing);
}

const Hue_Quadrature_Table = [ null,
			       { /*1*/ h:  33.44, e: 0.68, H:   0 },   // Red
			       { /*2*/ h:  89.29, e: 0.64, H: 100 },   // Yellow
			       { /*3*/ h: 146.30, e: 1.52, H: 200 },   // Green
			       { /*4*/ h: 238.36, e: 0.77, H: 300 },   // Blue
			       { /*5*/ h: 393.44, e: 0.68, H: 400 } ]; // Red
function hue_composition (hz) {
  hz = hz > 360 ? hz % 360 : hz >= 0 ? hz : 360 - (-hz) % 360;
  const T = Hue_Quadrature_Table, h_ = hz < T[1].h ? hz + 360 : hz;
  const i = h_ < T[3].h ? (h_ >= T[2].h ? 2 : 1) : (h_ >= T[4].h ? 4 : 3);
  const Ti = Hue_Quadrature_Table[i], Tn = Hue_Quadrature_Table[i + 1];
  const hdi = (h_ - Ti.h) / Ti.e;
  const hdn = (Tn.h - h_) / Tn.e;
  const Hz = Ti.H + (100 * hdi) / (hdi + hdn);
  return { Hz, h_ };
}
function hue_angle (Hz) {
  const T = Hue_Quadrature_Table;
  const H = Hz > 400 ? Hz % 400 : Hz >= 0 ? Hz : 400 - (-Hz) % 400;
  const i = H < T[3].H ? (H >= T[2].H ? 2 : 1) : (H >= T[4].H ? 4 : 3);
  const Ti = Hue_Quadrature_Table[i], Tn = Hue_Quadrature_Table[i + 1];
  const Hn = (H - Ti.H) * (Tn.e * Ti.h - Ti.e * Tn.h) - 100 * Tn.e * Ti.h;
  const Hd = (H - Ti.H) * (Tn.e - Ti.e) - 100 * Tn.e, h_= Hn / Hd;
  const hz = h_ > 360 ? h_ - 360 : h_;
  return hz;
}

/// Calculate ZCAM perceptual color attributes from Izazbz.
export function zcam_from_Izazbz ({ Iz, az, bz }, viewing) {
  viewing = zcam_setup (viewing || zcam_viewing);
  // ZCAM, a colour appearance model based on a high dynamic range uniform colour space
  // https://opg.optica.org/oe/fulltext.cfm?uri=oe-29-4-6036&id=447640
  const { ByQzw, Qmul, Qexp, FL, Fb, MzF, SzF } = viewing[_zcam_setup];
  // hue angle
  let hz = Math.atan2 (bz, az) * rad2deg;
  if (hz < 0) hz += 360;
  // hue composition
  const { Hz, h_ } = hue_composition (hz);
  const ez = 1.015 + Math.cos ((89.038 + h_) * deg2rad); // beware, h_ in °, but cos() takes radians
  // brightness
  const Qz  = Qmul * Iz**Qexp;
  // lightness
  const Jz = Qz * ByQzw;
  // colorfulness
  const Mz = (az * az + bz * bz)**0.37 * ez**0.068 * MzF;
  // chroma
  const Cz = Mz * ByQzw, Cz2 = Cz * Cz;
  // saturation
  const Sz = SzF * Math.sqrt (Mz / Math.max (Qz, 1e-17)); // Note, avoid NaN for Qz==0
  // vividness
  const Vz = Math.sqrt ((Jz - 58)**2 + 3.4 * Cz2);
  // blackness
  const Kz = 100 - 0.8 * Math.sqrt (Jz**2 + 8 * Cz2);
  // whiteness
  const Wz = 100 - Math.sqrt ((100 - Jz)**2 + Cz2);
  // result
  const zcam = { FL, Fb, Iz, az, bz, hz, Hz, Qz, Jz, Mz, Cz, Sz, Vz, Kz, Wz, viewing };
  return zcam;
}

/// Construct sRGB array from ZCAM perceptual color attributes.
export function srgb_from_zcam (zcam, viewing = undefined) {
  viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
  const { ZCAM_D65 } = viewing[_zcam_setup];
  if (viewing.Xw != ZCAM_D65.x || viewing.Zw != ZCAM_D65.z || viewing.Yw != ZCAM_D65.y)
    return E.srgb_from_xyz (xyz_from_zcam (zcam, viewing));
  return J.srgb_from_Izazbz (Izazbz_from_zcam (zcam, viewing));
}

/// Construct linear RGB object from ZCAM perceptual color attributes.
export function linear_rgb_from_zcam (zcam, viewing = undefined) {
  viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
  const { ZCAM_D65 } = viewing[_zcam_setup];
  if (viewing.Xw != ZCAM_D65.x || viewing.Zw != ZCAM_D65.z || viewing.Yw != ZCAM_D65.y) {
    const [r, g, b] = E.linear_rgb_from_xyz (xyz_from_zcam (zcam, viewing));
    return {r, g, b};
  }
  return J.linear_rgb_from_Izazbz (Izazbz_from_zcam (zcam, viewing));
}

/// Construct absolute XYZ values from ZCAM perceptual color attributes.
export function xyz_from_zcam (zcam, viewing = undefined) {
  viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
  const { D, strict, ZCAM_D65 } = viewing[_zcam_setup];
  const xyz65 = J.xyz_from_Izazbz (Izazbz_from_zcam (zcam, viewing));
  // xyz @ [Xw,Yw,Zw]
  let xyz = xyz65;
  if (viewing.Xw != ZCAM_D65.x || viewing.Zw != ZCAM_D65.z || viewing.Yw != ZCAM_D65.y)
    xyz = A.xyz_chromatic_adaptation_invert (xyz65, ZCAM_D65, { x: viewing.Xw, y: viewing.Yw, z: viewing.Zw }, D, strict ? A.CAT02_CAT : null);
  return xyz;
}

/// Check if `v` is numeric.
function has (v) {
  return !isNaN (v);
}

function zcam_missing (msg) {
  const m = "xyz_from_zcam(): missing: " + msg;
  console.trace (m);
  throw m;
}

/// Construct Izazbz from ZCAM perceptual color attributes.
export function Izazbz_from_zcam (zcam, viewing) {
  viewing = zcam_setup (viewing || zcam_viewing);
  // Supplementary document for ZCAM, a psychophysical model for colour appearance prediction
  // https://opticapublishing.figshare.com/articles/journal_contribution/Supplementary_document_for_ZCAM_a_psychophysical_model_for_colour_appearance_prediction_-_5022171_pdf/13640927
  const { JzDiv, IzDiv, IzExp, ByQzw, Wpc, ByQzwF } = viewing[_zcam_setup];
  let Iz, Jz, hz, Qz;
  // brightness OR lightness
  if (has (zcam.Qz)) {
    Qz = zcam.Qz;
    Iz = (Qz * IzDiv)**IzExp;
    Jz = Qz * ByQzw;
  } else if (has (zcam.Jz)) {
    Jz = zcam.Jz;
    Iz = (Jz * JzDiv)**IzExp;
    Qz = Jz / ByQzw;
  } else
    zcam_missing ("Qz OR Jz");
  // Cz OR Sz OR Mz OR Vz OR Wz OR Kz
  let Cz;
  if (has (zcam.Cz))
    Cz = zcam.Cz;
  else if (has (zcam.Mz))
    Cz = zcam.Mz * ByQzw;
  else if (has (zcam.Sz))
    Cz = Qz * zcam.Sz * zcam.Sz * ByQzwF;
  else if (has (zcam.Vz))
    Cz = Math.sqrt ((zcam.Vz**2 - (Jz - 58)**2) * (1/3.4));
  else if (has (zcam.Wz))
    Cz = Math.sqrt ((100 - zcam.Wz)**2 - (100 - Jz)**2);
  else if (has (zcam.Kz))
    Cz = Math.sqrt (1.5625 * (100 - zcam.Kz)**2 - Jz**2) * (1.0 / 2**(3/2));
  else
    zcam_missing ("Cz OR Sz OR Mz OR Vz OR Wz OR Kz");
  // Hz OR hz
  const T = Hue_Quadrature_Table;
  if (has (zcam.hz))
    hz = zcam.hz;
  else if (has (zcam.Hz))
    hz = hue_angle (zcam.Hz);
  else
    zcam_missing ("Hz OR hz");
  const h_ = hz < T[1].h ? hz + 360 : hz;
  const ez = 1.015 + Math.cos ((89.038 + h_) * deg2rad); // beware, h_ in °, but cos() takes radians
  const Cz_ = (Wpc * Cz / ez**0.068)**1.3514;
  // xyz65
  const az = Cz_ * Math.cos (hz * deg2rad);
  const bz = Cz_ * Math.sin (hz * deg2rad);
  return {Iz, az, bz};
}

/// Ensure `zcam` contains Jz if missing.
export function zcam_ensure_Jz (zcam, viewing = undefined) {
  if (isNaN (zcam.Jz)) {
    if (viewing || !zcam.viewing?.[_zcam_setup])
      zcam.viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
    const { ByQzw } = zcam.viewing[_zcam_setup];
    zcam.Jz = zcam.Qz * ByQzw;
  }
  return zcam;
}

/// Ensure `zcam` contains Qz if missing.
export function zcam_ensure_Qz (zcam, viewing = undefined) {
  if (isNaN (zcam.Qz)) {
    if (viewing || !zcam.viewing?.[_zcam_setup])
      zcam.viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
    const { ByQzw } = zcam.viewing[_zcam_setup];
    zcam.Qz = zcam.Jz / ByQzw;
  }
  return zcam;
}

/// Ensure `zcam` contains Sz if missing.
export function zcam_ensure_Sz (zcam, viewing = undefined) {
  if (isNaN (zcam.Sz)) {
    if (viewing || !zcam.viewing?.[_zcam_setup])
      zcam.viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
    const { SzF } = zcam.viewing[_zcam_setup];
    const minJz = 1e-17; // Note, avoid NaN for Jz==0
    zcam.Sz = SzF * Math.sqrt (zcam_ensure_Cz (zcam).Cz / Math.max (zcam_ensure_Jz (zcam).Jz, minJz));
  }
  return zcam;
}

/// Ensure `zcam` contains Cz if missing.
export function zcam_ensure_Cz (zcam, viewing = undefined) {
  if (isNaN (zcam.Cz)) {
    if (viewing || !zcam.viewing?.[_zcam_setup])
      zcam.viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
    const { ByQzw, ByQzwF } = zcam.viewing[_zcam_setup];
    if (has (zcam.Mz))
      zcam.Cz = zcam.Mz * ByQzw;
    else if (has (zcam.Sz))
      zcam.Cz = zcam_ensure_Qz (zcam).Qz * zcam.Sz * zcam.Sz * ByQzwF;
    else if (has (zcam.Vz))
      zcam.Cz = Math.sqrt ((zcam.Vz**2 - (zcam_ensure_Jz (zcam).Jz - 58)**2) * (1/3.4));
    else if (has (zcam.Wz))
      zcam.Cz = Math.sqrt ((100 - zcam.Wz)**2 - (100 - zcam_ensure_Jz (zcam).Jz)**2);
    else if (has (zcam.Kz))
      zcam.Cz = Math.sqrt (1.5625 * (100 - zcam.Kz)**2 - zcam_ensure_Jz (zcam).Jz**2) * (1.0 / 2**(3/2));
    else
      zcam_missing ("Cz OR Sz OR Mz OR Vz OR Wz OR Kz");
  }
  return zcam;
}

/// Ensure `zcam` contains Mz if missing.
export function zcam_ensure_Mz (zcam, viewing = undefined) {
  if (isNaN (zcam.Mz)) {
    if (viewing || !zcam.viewing?.[_zcam_setup])
      zcam.viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
    const { ByQzw } = zcam.viewing[_zcam_setup];
    zcam_ensure_Cz (zcam);
    zcam.Mz = zcam.Cz / ByQzw;
  }
  return zcam;
}

/// Ensure `zcam` contains hue composition Hz if missing.
export function zcam_ensure_Hz (zcam, viewing = undefined) {
  if (isNaN (zcam.Hz)) {
    if (viewing || !zcam.viewing?.[_zcam_setup])
      zcam.viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
    const { Hz } = hue_composition (zcam.hz);
    zcam.Hz = Hz;
  }
  return zcam;
}

/// Ensure `zcam` contains hue angle hz if missing.
export function zcam_ensure_hz (zcam, viewing = undefined) {
  if (isNaN (zcam.hz)) {
    if (viewing || !zcam.viewing?.[_zcam_setup])
      zcam.viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
    zcam.hz = hue_angle (zcam.Hz);
  }
  return zcam;
}

/// Add Qz, Jz, Cz, Sz to `zcam` if missing.
export function zcam_extend (zcam, viewing = undefined) {
  if (viewing || !zcam.viewing?.[_zcam_setup])
    zcam.viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
  zcam_ensure_Hz (zcam);
  zcam_ensure_hz (zcam);
  zcam_ensure_Jz (zcam);
  zcam_ensure_Qz (zcam);
  zcam_ensure_Cz (zcam);
  zcam_ensure_Mz (zcam);
  zcam_ensure_Sz (zcam);
  return zcam;
}

/// Retrieve sRGB coordinates and assign `inside` to true if within 8bit sRGB gamut.
export function srgb_from_zcam_8bit (zcam, viewing) {
  const {r, g, b} = linear_rgb_from_zcam (zcam, viewing);
  const inside = S.linear_rgb_inside_8bit_gamut ({r, g, b});
  return { r: S.srgb_companding (r), g: S.srgb_companding (g), b: S.srgb_companding (b), inside };
}

/// Find chroma maximum for hue and brightness that satisfies `rgb_inside_gamut()`.
export function zcam_maximum_Cz (zcam, eps = 1e-3, maxCz = 101, viewing = undefined) {
  viewing = zcam_setup (viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing);
  if (isNaN (zcam.Qz) || isNaN (zcam.hz)) {
    zcam = zcam_ensure_Qz (Object.assign ({}, zcam), viewing);
    zcam = zcam_ensure_hz (zcam);
  }
  const hz = zcam.hz, Qz = zcam.Qz;
  const cz_inside_rgb = Cz => S.rgb_inside_gamut (linear_rgb_from_zcam ({ hz, Qz, Cz }, viewing));
  return M.bsearch_max (cz_inside_rgb, 0, maxCz, eps);
}

/// Find (Cz, Qz) cusp for hue that satisfies `rgb_inside_gamut()`.
/// Execution is expensive, depending on `eps`, several hundred ZCAM transforms may be needed.
export function zcam_hue_find_cusp (hz, eps = 1e-3, maxCz = 101, viewing = undefined) {
  viewing = zcam_setup (viewing ? viewing : zcam_viewing);
  const { JzDiv, IzExp, Qexp, Qmul } = viewing[_zcam_setup];
  const Jz = 100.0001, Iz = (Jz * JzDiv)**IzExp, maxQz = Qmul * Iz**Qexp;
  const hue_maximize_Cz = Qz => zcam_maximum_Cz ({ hz, Qz }, eps, maxCz, viewing);
  const { x: Qz, y: Cz } = M.gss_max (hue_maximize_Cz, 0, maxQz, eps);
  return zcam_extend ({ hz, Qz, Cz }, viewing);
}

// == tests ==
async function main (args) {
  const assert = await import ('assert');
  const verbose = args.indexOf ('--verbose') >= 0;
  const rnd = (v, d = 0) => Math.round (v * 10**d) / 10**d;
  // ZCAM
  const NA = NaN; // not applicable
  const E = [ NA, NA,  NA,  -7,   -7,   -7,   -3,   -7,   -7,   -4,   -4,   -4,   -4,   -4,   -4,   -4,   -4,   -4,   -4,   -4,   -4,   -4,    0,   -4 ];
  const tests = [
    /*T*/ [ "X", "Y", "Z", "Xw", "Yw", "Zw", "Fs", "La", "Yb", "FL", "Fb", "Iz", "az", "bz", "hz", "Hz", "Qz", "Jz", "Mz", "Cz", "Sz", "Vz", "Kz", "Wz" ],
    /*1*/ [ 185, 206, 163, 256, 264, 202, ZCAM_AVERAGE, 264, 100, 1.0970, 0.6155, 0.3947, -0.0165, -0.0048, 196.3524, 237.6401, 321.3464, 92.2520, 10.5252, 3.0216, 19.1314, 34.7022, 25.2994, 91.6837 ],
    /*2*/ [ 89, 96, 120, 256, 264, 202, ZCAM_AVERAGE, 264, 100, 1.0970, 0.6155, 0.3163, -0.0166, -0.0472, 250.6422, 307.0595, 248.0394, 71.2071, 23.8744, 6.8539, 32.7963, 18.2796, 40.4621, 70.4026 ],
    /*3*/ [ 79, 81, 62, 256, 264, 202, ZCAM_DIM, 150*0 + 264, 60*0 + 100, 1.0970, 0.6155, 0.2913, 0.0018, 0.0029, 58.7532, 43.8258, 196.7686, 68.8890, 2.7918, 0.9774, 12.5916, 11.0371, 44.4143, 68.8737 ],
    /*4*/ [ 910, 1114, 500, 2103, 2259, 1401, ZCAM_DARK, 359, 16, 1.2153, 0.0842, 0.6190, -0.0320, 0.0475, 123.9464, 178.6422, 114.7431, 82.6445, 18.1655, 13.0838, 44.7277, 34.4874, 26.8778, 78.2653 ],
    /*5*/ [ 96, 67, 28, 2103, 2259, 1401, ZCAM_DARK, 359, 16, 1.2153, 0.0842, 0.2749, 0.0765, 0.0437, 389.7720 -360, 397.3301, 45.8363, 33.0139, 26.9446, 19.4070, 86.1882, 43.6447, 47.9942, 30.2593 ],
    // Test values (1)-(5) are from "Supplementary document for ZCAM": https://doi.org/10.6084/m9.figshare.13640927.v2
    // About Kz) given ZCAM paper formula (18) for Kz and ZCAM supplement test values for Jz and Cz, the fractional digits of Kz are not plausible
    // About 3) La & Yb are reset to coefficients from tests (1) and (2) for the results to make sense
    // About 5) hz is adjusted to stay within 0…360
  ];
  const T = tests[0], results = [];
  const pad = (s,n = 8) => (s + "").padEnd (n), num = (v,n = 17) => pad (v.toPrecision (12), n);
  const wsign = s => s[0] == "-" ? s : " " + s, dfmt = n => wsign (n.toFixed (9));
  // zcam_from_xyz
  for (let i = 1; i < tests.length; i++) {
    // prepare conditions
    const row = tests[i], diffs = [];
    const zcond = { Xw: row[3], Yw: row[4], Zw: row[5], Fs: row[6], La: row[7], Yb: row[8], strict: true };
    // calc test
    const xyz = { x: row[0], y: row[1], z: row[2] }, zcam = results[i] = zcam_from_xyz (xyz, zcond);
    // calc diffs
    const zval = i => { const v = zcam[T[i]] === undefined ? zcond[T[i]] : zcam[T[i]]; return v === undefined ? NaN : v; };
    let bad = 0;
    for (let j = 0; j < row.length; j++) {
      diffs[j] = row[j] - zval (j);
      bad += !isNaN (E[j]) && !(Math.abs (diffs[j]) < 10**E[j]);
    }
    if (!bad && !verbose) continue;
    // print
    console.log (bad ? "FAIL:" : "OK:", "zcam_from_xyz():");
    console.log (i + ") XYZ:", [row[0], row[1], row[2]], "     [-Diffs-]");
    for (let j = 9; j < row.length; j++) {
      const bad = Math.abs (diffs[j]) < 10**E[j] ? '' : " **BAD** (" + row[j] + ")";
      console.log ("  ", pad (T[j] + ":", 4), num (zval (j)), "  " + dfmt (diffs[j]) + bad);
    }
    assert.deepEqual (bad, false);
  }
  // xyz_from_zcam
  for (let i = 1; i < tests.length; i++) {
    // prepare conditions
    const row = tests[i], zcam = results[i], eps = 0.02;
    const verify = (zinput, xyz) => {
      const diff = [ xyz.x - row[0], xyz.y - row[1], xyz.z - row[2] ];
      const bad = !(Math.abs (diff[0]) < eps) || !(Math.abs (diff[1]) < eps) || !(Math.abs (diff[2]) < eps);
      if (!bad && !verbose) return;
      console.log (bad ? "FAIL:" : "OK:", "xyz_from_zcam():");
      console.log ('xyz=', xyz, '\ndiff=', diff, '\nzinput', zinput, '\nzcam=', zcam);
      assert.deepEqual (bad, false);
    };
    for (const lightness of ['Jz', 'Qz']) { // Qz OR Jz
      for (const chroma of ['Cz', 'Sz', 'Mz', 'Vz', 'Wz', 'Kz']) {
	for (const huekind of ['hz', 'Hz']) {
	  const zinput = { viewing: zcam.viewing };
	  zinput[huekind] = zcam[huekind];
	  zinput[lightness] = zcam[lightness];
	  zinput[chroma] = zcam[chroma];
	  verify (zinput, xyz_from_zcam (zinput));
	}
      }
    }
  }
  // ZCAM and sRGB tests
  assert.deepEqual ('#faebde', S.srgb_hex (srgb_from_zcam (zcam_from_srgb ('#faebde'))));
  assert.deepEqual ('#071adc', S.srgb_hex (srgb_from_zcam (zcam_from_srgb ('#071adc'))));
  assert.deepEqual ('#23be7c', S.srgb_hex (srgb_from_zcam (zcam_from_srgb ('#23be7c'))));
  // ZCAM hue tests
  const o_rnd1 = o => {
    const r = {};
    for (const k in o)
      if ('number' == typeof o[k])
	r[k] = rnd (o[k], 1);
    return r;
  };
  const cusp_259 = { hz: 259, Hz: 311.9, Qz: 79.4, Cz: 42.6, Jz: 49.1, Mz: 68.8, Sz: 81.0 };
  assert.deepEqual (o_rnd1 (zcam_hue_find_cusp (259, 1e-2)), cusp_259);
}
if (!process.ROLLUP && process.argv[1] == import.meta.url.replace (/^file:\/\//, ''))
  process.exit (await main (process.argv.splice (2)));
