// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

import * as M from './math.js';
import * as S from './srgb.js';
import * as Z from './zcam.js';

export class Gamut {
  constructor (zcamviewingconditions = {}) {
    this.viewing = Z.zcam_setup (zcamviewingconditions);
  }
  /// Retrieve sRGB coordinates and assign `inside` to true if within 8bit sRGB gamut.
  contains (zcam) {
    const {r, g, b} = Z.linear_rgb_from_zcam (zcam, this.viewing);
    const inside = S.linear_rgb_inside_8bit_gamut ({r, g, b});
    return { r: S.srgb_companding (r), g: S.srgb_companding (g), b: S.srgb_companding (b), inside };
  }
  zcam (srgb) {
    return Z.zcam_from_srgb (srgb);
  }
}

async function test () {
  const rnd = (v, digits = 0) => Math.round (v * 10**digits) / 10**digits;
  const rnd2 = v => rnd (v, 2), rnd3 = v => rnd (v, 3);
  const assert = await import ('assert');
  const g = new Gamut();
  let c = g.contains ({ Jz: 99, Sz: 43, hz: 258 });
  assert.deepEqual (c.inside, false); // not inside
  assert.deepEqual (c.b > c.g && c.b > c.r, true); // is blue
  c = g.contains ({ Jz: 50, Sz: 20, hz: 258 });
  assert.deepEqual (c.inside, true); // is inside
  assert.deepEqual (c.b > c.g && c.b > c.r, true); // is blue
  assert.deepEqual (rnd2 (g.zcam ('#ff0000').hz), 42.48); // is red
}

if (process.argv[1] == import.meta.url.replace (/^file:\/\//, ''))
  await test();
