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
