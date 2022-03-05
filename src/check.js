// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

import * as assert from 'assert';
import * as M from './math.js';

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

// Run unit tests
test_math();
console.log ("OK:", process.argv[1]);
