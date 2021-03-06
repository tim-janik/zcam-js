// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

/// Create hex string from sRGB array.
export function srgb_hex (rgb) {
  if (Array.isArray (rgb))
    rgb = { r: rgb[0], g: rgb[1], b: rgb[2], a: rgb[3] };
  const r = (255 * rgb.r + 0.5 |0).toString (16);
  const g = (255 * rgb.g + 0.5 |0).toString (16);
  const b = (255 * rgb.b + 0.5 |0).toString (16);
  const r0 = r.length > 1 ? r : '0' + r;
  const g0 = g.length > 1 ? g : '0' + g;
  const b0 = b.length > 1 ? b : '0' + b;
  let hex = '#' + r0 + g0 + b0;
  if (!isNaN (rgb.a)) {
    const a = (255 * rgb.a + 0.5 |0).toString (16);
    const a0 = a.length > 1 ? a : '0' + a;
    hex += a0;
  }
  return hex;
}

/// Create sRGB array from color string, integer or vector `[ 0…1, 0…1, 0…1 ]`
export function srgb_from (srgb) {
  // array
  if (Array.isArray (srgb)) {
    if (srgb.length > 3)
      return { r: srgb[0], g: srgb[1], b: srgb[2], a: srgb[3] };
    return { r: srgb[0], g: srgb[1], b: srgb[2] };
  }
  // number
  const otype = typeof srgb;
  if ('number' === otype) {
    const r = ((srgb | 0) & 0xff0000) >> 16;
    const g = ((srgb | 0) & 0xff00) >> 8;
    const b = (srgb | 0) & 0xff;
    return { r: r / 255.0, g: g / 255.0, b: b / 255.0 };
  }
  // object {r, g, b}
  if ('object' == otype) {
    return { r: srgb.r, g: srgb.g, b: srgb.b };
  }
  // string
  const offset = srgb.substr (0, 1) == '#' ? 1 : 0;
  if (srgb.length - offset >= 6)
    {
      const r = parseInt (srgb.substr (offset + 0, 2), 16);
      const g = parseInt (srgb.substr (offset + 2, 2), 16);
      const b = parseInt (srgb.substr (offset + 4, 2), 16);
      const c = { r: r / 255.0, g: g / 255.0, b: b / 255.0 };
      if (srgb.length - offset >= 8) {
        const a = parseInt (srgb.substr (offset + 6, 2), 16);
        c.a = a / 255.0;
      }
      return c;
    }
  if (srgb.length - offset >= 3)
    {
      const r = parseInt (srgb.substr (offset + 0, 1), 16);
      const g = parseInt (srgb.substr (offset + 1, 1), 16);
      const b = parseInt (srgb.substr (offset + 2, 1), 16);
      const c = { r: ((r << 4) + r) / 255.0, g: ((g << 4) + g) / 255.0, b: ((b << 4) + b) / 255.0 };
      if (srgb.length - offset >= 4) {
        const a = parseInt (srgb.substr (offset + 3, 1), 16);
        c.a = ((a << 4) + a) / 255.0;
      }
      return c;
    }
  return { r: 0, g: 0, b: 0 };
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
  const { r, g, b } = srgb_from (srgb);
  return { r: srgb_eotf (r), g: srgb_eotf (g), b: srgb_eotf (b) };
}

/// Convert linear RGB object to companded sRGB array via srgb_companding()
export function srgb_from_linear ({r, g, b}) {
  return { r: srgb_companding (r), g: srgb_companding (g), b: srgb_companding (b) };
}

/// Check if RGB object is exactly with `[0…1]` range per channel.
export function rgb_inside_gamut ({r, g, b}) {
  return r >= 0.0 && r <= 1.0 && g >= 0.0 && g <= 1.0 && b >= 0.0 && b <= 1.0;
}

const zero_srgb = - 1 / 255 / 2;
const one_srgb = 1 + 1 / 255 / 2;

/// Check if rounded sRGB object is within sRGB gamut with 8bit channel width.
export function srgb_inside_8bit_gamut ({r, g, b}) {
  return r > zero_srgb && r < one_srgb && g > zero_srgb && g < one_srgb && b > zero_srgb && b < one_srgb;
}

const zero_lrgb = srgb_eotf (zero_srgb);
const one_lrgb = srgb_eotf (one_srgb);

/// Check if rounded linear RGB object is within sRGB gamut with 8bit channel width.
export function linear_rgb_inside_8bit_gamut ({r, g, b}) {
  return r > zero_lrgb && r < one_lrgb && g > zero_lrgb && g < one_lrgb && b > zero_lrgb && b < one_lrgb;
}

// == tests ==
async function main (args) {
  const assert = await import ('assert');
  const rnd = (v, d = 0) => Math.round (v * 10**d) / 10**d, rnd3 = v => rnd (v, 3);
  assert.deepEqual (srgb_hex ([1, 1, 1]), '#ffffff');
  assert.deepEqual (srgb_hex ([0, 0, 0, 1]), '#000000ff');

  assert.deepEqual (srgb_from ('#fff'), {r: 1, g: 1, b: 1});
  assert.deepEqual (srgb_from ('#ffffff'), {r: 1, g: 1, b: 1});
  assert.deepEqual (srgb_from (0xfffffff), {r: 1, g: 1, b: 1});
  assert.deepEqual (srgb_from ([0.5, 0.5, 0.5]), {r: 0.5, g: 0.5, b: 0.5});
  assert.deepEqual (srgb_from (0x0000000), {r: 0, g: 0, b: 0});
  assert.deepEqual (srgb_from ('#000000'), {r: 0, g: 0, b: 0});
  assert.deepEqual (srgb_from ('#000'), {r: 0, g: 0, b: 0});

  assert.deepEqual (srgb_to_linear (srgb_from_linear ({ r: 0, g: 0, b: 0 })), { r: 0, g: 0, b: 0 });
  assert.deepEqual (srgb_to_linear (srgb_from_linear ({ r: 1, g: 1, b: 1 })), { r: 1, g: 1, b: 1 });
  assert.deepEqual (srgb_from_linear (srgb_to_linear ([0, 0, 0])), {r: 0, g: 0, b: 0});
  assert.deepEqual (Object.values (srgb_from_linear (srgb_to_linear ([1, 1, 1]))).map (v => rnd (v, 7)), [1, 1, 1]);
  assert.deepEqual (Object.values (srgb_from_linear ({ r: 0.051, g: 0.214, b: 0.523 })).map (rnd3), [0.25, 0.5, 0.75]);
}
if (!process.ROLLUP && process.argv[1] == import.meta.url.replace (/^file:\/\//, ''))
  process.exit (await main (process.argv.splice (2)));
