// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

import * as assert from 'assert';
import * as M from './math.js';
import * as S from './srgb.js';

/// Round to a given number of digits.
const rnd = (v, digits = 0) => Math.round (v * 10**digits) / 10**digits;
const rnd2 = v => rnd (v, 2), rnd3 = v => rnd (v, 3);
const rnd5 = v => rnd (v, 5), rnd7 = v => rnd (v, 7);

// === math.js tests ==
function test_math () {
  assert.deepEqual (rnd5 (M.bsearch_max (x => x <= 1, -5, +5)), 1.0);
  let o = M.gss_min (x => (x + 1)**2 + 2, -5, +5, 5e-6);
  assert.deepEqual ([o.a, o.b].map (rnd5), [-1, -1]);
  o = M.gss_max (x => 7 - (x - 1)**2, -5, +5, 5e-6);
  assert.deepEqual ([o.a, o.b].map (rnd5), [+1, +1]);
}

// == srgb.js tests ==
function test_srgb () {
  assert.deepEqual (S.srgb_hex ([1, 1, 1]), '#ffffff');
  assert.deepEqual (S.srgb_hex ([0, 0, 0, 1]), '#000000ff');

  assert.deepEqual (S.srgb_from ('#fff'), [1, 1, 1]);
  assert.deepEqual (S.srgb_from ('#ffffff'), [1, 1, 1]);
  assert.deepEqual (S.srgb_from (0xfffffff), [1, 1, 1]);
  assert.deepEqual (S.srgb_from ([0.5, 0.5, 0.5]), [0.5, 0.5, 0.5]);
  assert.deepEqual (S.srgb_from (0x0000000), [0, 0, 0]);
  assert.deepEqual (S.srgb_from ('#000000'), [0, 0, 0]);
  assert.deepEqual (S.srgb_from ('#000'), [0, 0, 0]);

  assert.deepEqual (S.srgb_to_linear (S.srgb_from_linear ({ r: 0, g: 0, b: 0 })), { r: 0, g: 0, b: 0 });
  assert.deepEqual (S.srgb_to_linear (S.srgb_from_linear ({ r: 1, g: 1, b: 1 })), { r: 1, g: 1, b: 1 });
  assert.deepEqual (S.srgb_from_linear (S.srgb_to_linear ([0, 0, 0])), [0, 0, 0]);
  assert.deepEqual (S.srgb_from_linear (S.srgb_to_linear ([1, 1, 1])).map (v => rnd (v, 7)), [1, 1, 1]);
  assert.deepEqual (S.srgb_from_linear ({ r: 0.051, g: 0.214, b: 0.523 }).map (rnd3), [0.25, 0.5, 0.75]);
}

// Run unit tests
test_math();
test_srgb();
console.log ("OK:", process.argv[1]);
