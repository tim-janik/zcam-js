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
