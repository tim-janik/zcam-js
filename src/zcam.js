// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

// == ZCAM color appearance model ==
export const ZCAM_DARK = 0.525;
export const ZCAM_DIM = 0.59;
export const ZCAM_AVERAGE = 0.69;
export const zcam_viewing = Object.freeze ({
  Fs: ZCAM_AVERAGE,
  Yb: 20,	// sRGB: 20% surround reflectance of reference ambient; https://www.itu.int/dms_pub/itu-r/opb/rep/R-REP-BT.2408-4-2021-PDF-E.pdf
  La: 4,	// cd/m², luminance of the adapting field; gray world assumption
  Yw: 203,	// cd/m², HDR Reference White; ITU-R BT.2408-4 https://www.itu.int/dms_pub/itu-r/opb/rep/R-REP-BT.2408-4-2021-PDF-E.pdf
  Xw: 95.047/100 * 203, Zw: 108.883/100 * 203,
});

/// Calculate ZCAM perceptual color attributes.
export function zcam_from_xyz (xyz, viewing = undefined) {
  // ZCAM, a colour appearance model based on a high dynamic range uniform colour space
  // https://opg.optica.org/oe/fulltext.cfm?uri=oe-29-4-6036&id=447640
  viewing = viewing ? viewing : zcam_viewing;
  const Fb = Math.sqrt (viewing.Yb / viewing.Yw);
  const FL = 0.171 * viewing.La ** (1/3) * (1 - Math.exp (-48/9 * viewing.La));
  const F = viewing.Fs >= ZCAM_AVERAGE ? 1.0 : viewing.Fs >= ZCAM_DIM ? 0.9 : 0.8; // The CIECAM02 color appearance model
  const D = F * (1.0 - 1/3.6 * Math.exp ((viewing.La + 42.0) / -92.0));	// https://en.wikipedia.org/wiki/CIECAM02#CAT02
  const xyz65 = xyz; // FIXME: white point ?
  const [Iz, az, bz] = Izazbz_from_xyz (xyz65);
  let hz = Math.atan2 (bz, az) * 180/Math.PI;
  if (hz < 0) hz += 360;
  // step 4: Hue Composition (TODO)
  // Hue Quadrature Table:
  // i:   1      2      3      4      5
  // hi: 33.44  89.29 146.30 238.36 393.44
  // ei:  0.68   0.64   1.52   0.77   0.68
  // Hi:  0    100    200    300    400
  const h1 = 33.44, h_ = hz < h1 ? hz + 360 : hz;
  const ez = 1.015 + Math.cos (89.038 + h_);
  const whitepoint2d65 = w => w; // untransformed
  const Izw = Izazbz_from_xyz (whitepoint2d65 ({ x: viewing.Xw, y: viewing.Yw, z: viewing.Zw }))[0];
  // brightness
  const Qexp = 1.6 * viewing.Fs / Fb**0.12, Qmul = 2700 * viewing.Fs**2.2 * Math.sqrt (Fb) * FL**0.2;
  const Qz  = Qmul * Iz**Qexp, Qzw = Qmul * Izw**Qexp;
  // lightness
  const Jz = 100 * (Qz / Qzw);
  // colorfulness
  const Mz = 100 * (az**2 + bz**2)**0.37 * (ez**0.068 * FL**0.2) / (Fb**0.1 * Izw**0.78);
  // chroma
  const Cz = 100 * (Mz / Qzw);
  // saturation
  const Sz = 100 * FL**0.6 * Math.sqrt (Mz / Qz);
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
  viewing = viewing ? viewing : zcam.viewing ? zcam.viewing : zcam_viewing;
  const Fb = Math.sqrt (viewing.Yb / viewing.Yw);
  const FL = 0.171 * viewing.La ** (1/3) * (1 - Math.exp (-48/9 * viewing.La));
  const IzExp = Fb**0.12 / (1.6 * viewing.Fs);
  const IzDiv = 2700 * viewing.Fs**2.2 * Fb**0.5 * FL**0.2;
  const zcam_missing = s => { const m = "xyz_from_zcam(): missing: " + s; console.trace (m); throw m; };
  const has = v => v !== undefined && !isNaN (v);
  let Iz, Jz, hz, Qz;
  // brightness OR lightness
  const whitepoint2d65 = w => w; // untransformed, the ZCAM paper expects the white point relative to D65
  const Izw = Izazbz_from_xyz (whitepoint2d65 ({ x: viewing.Xw, y: viewing.Yw, z: viewing.Zw }))[0];
  const Qexp = 1.6 * viewing.Fs / Fb**0.12, Qmul = 2700 * viewing.Fs**2.2 * Math.sqrt (Fb) * FL**0.2;
  const Qzw = Qmul * Izw**Qexp;
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
  // Cz OR Sz OR Wz
  let Cz;
  if (has (zcam.Cz))
    Cz = zcam.Cz;
  else if (has (zcam.Sz))
    Cz = Qz * zcam.Sz * zcam.Sz / (100 * Qzw * FL**1.2);
  else if (has (zcam.Wz))
    Cz = Math.sqrt ((100 - zcam.Wz)**2 - (100 - Jz)**2);
  else
    zcam_missing ("Cz OR Sz OR Wz");
  // TODO: Vz Kz
  // TODO: Hz
  if (has (zcam.hz))
    hz = zcam.hz;
  else
    zcam_missing ("hz");
  const Mz = Cz * Qzw / 100;
  const h1 = 33.44, h_ = hz < h1 ? hz + 360 : hz;
  const ez = 1.015 + Math.cos (89.038 + h_);
  const Cz_ = (Mz * Izw**0.78 * Fb**0.1 / (100 * ez**0.068 * FL**0.2))**1.3514;
  const hzrad = hz * Math.PI / 180;
  // xyz65
  const az = Cz_ * Math.cos (hzrad);
  const bz = Cz_ * Math.sin (hzrad);
  const xyz65 = xyz_from_Izazbz ([Iz, az, bz]);
  // xyz @ [Xw,Yw,Zw]
  const F = viewing.Fs >= ZCAM_AVERAGE ? 1.0 : viewing.Fs >= ZCAM_DIM ? 0.9 : 0.8; // The CIECAM02 color appearance model
  const D = F * (1.0 - 1/3.6 * Math.exp ((viewing.La + 42.0) / -92.0));	// https://en.wikipedia.org/wiki/CIECAM02#CAT02
  const XYZd65 = [95.047, 100, 108.883];	// standardized D65 white point
  const xyz = xyz_chromatic_adaptation_invert (xyz65, XYZd65, { x: viewing.Xw, y: viewing.Yw, z: viewing.Zw }, D);
  return xyz;
}
