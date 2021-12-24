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

/// Parse hex string into sRGB array, elements are within 0…1.
export function srgb_from (hex) {
  const offset = hex.substr (0, 1) == '#' ? 1 : 0;
  if (hex.length - offset == 3)
    {
      const r = parseInt (hex.substr (offset + 0, 1), 16);
      const g = parseInt (hex.substr (offset + 1, 1), 16);
      const b = parseInt (hex.substr (offset + 2, 1), 16);
      return [ ((r << 4) + r) / 255.0, ((g << 4) + g) / 255.0, ((b << 4) + b) / 255.0 ];
    }
  else if (hex.length - offset == 6)
    {
      const r = parseInt (hex.substr (offset + 0, 2), 16);
      const g = parseInt (hex.substr (offset + 2, 2), 16);
      const b = parseInt (hex.substr (offset + 4, 2), 16);
      return [ r / 255.0, g / 255.0, b / 255.0 ];
    }
  return [ 0, 0, 0 ];
}
