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

/// Create sRGB from color string, integer or vector `[ 0…1, 0…1, 0…1 ]`
export function srgb_from (srgb) {
  if (Array.isArray (srgb))
    return srgb;
  if ('number' === typeof srgb) {
    const r = ((srgb | 0) & 0xff0000) >> 16;
    const g = ((srgb | 0) & 0xff00) >> 8;
    const b = (srgb | 0) & 0xff;
    return [r / 255.0, g / 255.0, b / 255.0];
  }
  const offset = srgb.substr (0, 1) == '#' ? 1 : 0;
  if (srgb.length - offset >= 6)
    {
      const r = parseInt (srgb.substr (offset + 0, 2), 16);
      const g = parseInt (srgb.substr (offset + 2, 2), 16);
      const b = parseInt (srgb.substr (offset + 4, 2), 16);
      const c = [ r / 255.0, g / 255.0, b / 255.0 ];
      if (srgb.length - offset >= 8) {
        const a = parseInt (srgb.substr (offset + 6, 2), 16);
        c.push (a / 255.0);
      }
      return c;
    }
  if (srgb.length - offset >= 3)
    {
      const r = parseInt (srgb.substr (offset + 0, 1), 16);
      const g = parseInt (srgb.substr (offset + 1, 1), 16);
      const b = parseInt (srgb.substr (offset + 2, 1), 16);
      const c = [ ((r << 4) + r) / 255.0, ((g << 4) + g) / 255.0, ((b << 4) + b) / 255.0 ];
      if (srgb.length - offset >= 4) {
        const a = parseInt (srgb.substr (offset + 3, 1), 16);
        c.push (((a << 4) + a) / 255.0);
      }
      return c;
    }
  return [ 0, 0, 0 ];
}
