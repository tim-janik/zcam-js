// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

import * as assert from 'assert';
import * as M from './math.js';
import * as S from './srgb.js';
import * as J from './jzazbz.js';
import * as A from './adaptation.js';

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

// == Jzazbz tests ==
function test_jzazbz () {
  // Luo, Ming; Safdar, Muhammad; Cui, Guihua; Kim, Youn Jin; osa, figshare admin (2017): JzAzBz.m. Optica Publishing Group. Software. https://doi.org/10.6084/m9.figshare.5016299.v1
  assert.deepEqual (Object.values (J.xyz_from_Jzazbz (J.Jzazbz_from_xyz ({ x: 0.1, y: 0.2, z: 0.3 }))).map (rnd7), [0.1,0.2,0.3]);
  assert.deepEqual (Object.values (J.Jzazbz_from_xyz ({x:1, y:1, z:1})).map (rnd7), [0.0177797, 0.0023111, 0.0018745]);
  assert.deepEqual (Object.values (J.xyz_from_Jzazbz ({j:1, a:0.1, b:0.1})).map (rnd7), [11746.8716779, 9137.2585481, 5280.241668]);
  assert.deepEqual ('#ff00ff', S.srgb_hex (J.srgb_from_Jzazbz (J.Jzazbz_from_srgb ('#ff00ff'))));
  assert.deepEqual ('#ffff00', S.srgb_hex (J.srgb_from_Jzazbz (J.Jzazbz_from_srgb ('#ffff00'))));
  assert.deepEqual ('#00ffff', S.srgb_hex (J.srgb_from_Jzazbz (J.Jzazbz_from_srgb ('#00ffff'))));
  // test results from JzAzBz.m
  const xyz_red   = { x: 41.23865632529917,  y: 21.263682167732384, z:  1.9330620152483986 };
  const xyz_green = { x: 35.759149092062536, y: 71.51829818412507,  z: 11.919716364020845 };
  const xyz_blue  = { x: 18.045049120356367, y:  7.218019648142547, z: 95.03725870054353 };
  assert.deepEqual (Object.values (J.Jzazbz_from_xyz (xyz_red)).map (rnd7),   [ 0.0989666,  0.0996457,  0.0912348 ]);
  assert.deepEqual (Object.values (J.Jzazbz_from_xyz (xyz_green)).map (rnd7), [ 0.1318698, -0.0928627,  0.1005678 ]);
  assert.deepEqual (Object.values (J.Jzazbz_from_xyz (xyz_blue)).map (rnd7),  [ 0.0692379, -0.0309179, -0.1563231 ]);
  // Izazbz
  assert.deepEqual (Object.values (J.xyz_from_Izazbz (J.Izazbz_from_xyz ({ x: 0.1, y: 0.2, z: 0.3 }))).map (rnd7), [0.1, 0.2, 0.3]);
  assert.deepEqual (Object.values (J.Izazbz_from_xyz ({ x: 1, y: 1, z: 1 })).map (rnd7), [0.0390851, 0.0023111, 0.0018745]);
}

// == adaptation.js tests ==
function test_chromatic_adaptation () {
  const xyz_ref = { x: 95.0429, y: 100, z: 108.89 };
  const xyz_100 = { x: 100, y: 100, z: 100 };
  let xyz_dest = A.xyz_chromatic_adaptation (xyz_100, xyz_100, xyz_ref);
  assert.deepEqual (Object.values (xyz_dest).map (rnd7), Object.values (xyz_ref));
  xyz_dest = A.xyz_chromatic_adaptation_invert (xyz_ref, xyz_ref, xyz_100);
  assert.deepEqual (Object.values (xyz_dest).map (rnd7), Object.values (xyz_100));
  const xyz_918 = { x: 96.42, y: 100, z: 82.49 }, D = 0.98765;
  xyz_dest = A.xyz_chromatic_adaptation ({ x: 50, y: 70, z: 60 }, xyz_918, xyz_ref, D);
  xyz_dest = A.xyz_chromatic_adaptation_invert (xyz_dest, xyz_ref, xyz_918, D);
  assert.deepEqual (Object.values (xyz_dest).map (rnd7), Object.values ({ x: 50, y: 70, z: 60 }));
}


// Run unit tests
test_math();
test_srgb();
test_jzazbz();
test_chromatic_adaptation();
console.log ("OK:", process.argv[1]);
