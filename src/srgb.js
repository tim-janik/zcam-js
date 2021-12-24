// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

/// Create hex string from sRGB array.
export function srgb_hex (a) {
  const r = (255 * a[0] + 0.5 |0).toString (16);
  const g = (255 * a[1] + 0.5 |0).toString (16);
  const b = (255 * a[2] + 0.5 |0).toString (16);
  const r0 = r.length > 1 ? r : '0' + r;
  const g0 = g.length > 1 ? g : '0' + g;
  const b0 = b.length > 1 ? b : '0' + b;
  return '#' + r0 + g0 + b0;
}
