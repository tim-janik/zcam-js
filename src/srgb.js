// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

/// Create hex string from sRGB array.
export function srgb_hex (rgb) {
  const r = (255 * rgb[0] + 0.5 |0).toString (16);
  const g = (255 * rgb[1] + 0.5 |0).toString (16);
  const b = (255 * rgb[2] + 0.5 |0).toString (16);
  const r0 = r.length > 1 ? r : '0' + r;
  const g0 = g.length > 1 ? g : '0' + g;
  const b0 = b.length > 1 ? b : '0' + b;
  let hex = '#' + r0 + g0 + b0;
  if (rgb.length > 3) {
    const a = (255 * rgb[3] + 0.5 |0).toString (16);
    const a0 = a.length > 1 ? a : '0' + a;
    hex += a;
  }
  return hex;
}

/// Create sRGB array from color string, integer or vector `[ 0…1, 0…1, 0…1 ]`
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

// == Linear sRGB ==
/// Convert sRGB channel value to linear RGB channel value (inverse companding)
export function srgb_eotf (v) {
  // https://en.wikipedia.org/wiki/SRGB#Transfer_function_(%22gamma%22)
  return v <= 0.04045 ? v * (1.0 / 12.92) : ((v + 0.055) * (1.0 / 1.055)) ** 2.4;
}

/// Convert linear RGB channel value to sRGB channel value (inverse EOTF)
export function srgb_companding (v) {
  // http://www.brucelindbloom.com/Eqn_XYZ_to_RGB.html#Companding
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1.0 / 2.4) - 0.055;
}

/// Convert sRGB array to linear RGB object via srgb_eotf()
export function srgb_to_linear (srgb) {
  const [r, g, b] = srgb_from (srgb);
  return { r: srgb_eotf (r), g: srgb_eotf (g), b: srgb_eotf (b) };
}

/// Convert linear RGB object to companded sRGB array via srgb_companding()
export function srgb_from_linear ({r, g, b}) {
  return [srgb_companding (r), srgb_companding (g), srgb_companding (b)];
}
