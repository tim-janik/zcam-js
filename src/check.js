// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

import * as assert from 'assert';
import * as M from './math.js';
import * as S from './srgb.js';
import * as J from './jzazbz.js';
import * as A from './adaptation.js';
import * as Z from './zcam.js';

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

// == zcam.js tests ==
function test_zcam () {
  // ZCAM
  const E = [ -7, -7, -7,  -7,   -7,   -7,   -3,   -7,   -7,   -4,   -4,   -4,   -4,   -4,   -4,   -7,   -4,   -4,   -4,   -4,   -4,   -4,    0,   -4 ];
  const tests = [
    /*T*/ [ "X", "Y", "Z", "Xw", "Yw", "Zw", "Fs", "La", "Yb", "FL", "Fb", "Iz", "az", "bz", "hz", "Hz", "Qz", "Jz", "Mz", "Cz", "Sz", "Vz", "Kz", "Wz" ],
    /*1*/ [ 185, 206, 163, 256, 264, 202, Z.ZCAM_AVERAGE, 264, 100, 1.0970, 0.6155, 0.3947, -0.0165, -0.0048, 196.3524, 237.6401, 321.3464, 92.2520, 10.5252, 3.0216, 19.1314, 34.7022, 25.2994, 91.6837 ],
    /*2*/ [ 89, 96, 120, 256, 264, 202, Z.ZCAM_AVERAGE, 264, 100, 1.0970, 0.6155, 0.3163, -0.0166, -0.0472, 250.6422, 307.0595, 248.0394, 71.2071, 23.8744, 6.8539, 32.7963, 18.2796, 40.4621, 70.4026 ],
    /*3*/ [ 79, 81, 62, 256, 264, 202, Z.ZCAM_DIM, 150*0 + 264, 60*0 + 100, 1.0970, 0.6155, 0.2913, 0.0018, 0.0029, 58.7532, 43.8258, 196.7686, 68.8890, 2.7918, 0.9774, 12.5916, 11.0371, 44.4143, 68.8737 ],
    /*4*/ [ 910, 1114, 500, 2103, 2259, 1401, Z.ZCAM_DARK, 359, 16, 1.2153, 0.0842, 0.6190, -0.0320, 0.0475, 123.9464, 178.6422, 114.7431, 82.6445, 18.1655, 13.0838, 44.7277, 34.4874, 26.8778, 78.2653 ],
    /*5*/ [ 96, 67, 28, 2103, 2259, 1401, Z.ZCAM_DARK, 359, 16, 1.2153, 0.0842, 0.2749, 0.0765, 0.0437, 389.7720 -360, 397.3301, 45.8363, 33.0139, 26.9446, 19.4070, 86.1882, 43.6447, 47.9942, 30.2593 ],
    // Test values (1)-(5) are from "Supplementary document for ZCAM": https://doi.org/10.6084/m9.figshare.13640927.v2
    // About Kz) given ZCAM paper formula (18) for Kz and ZCAM supplement test values for Jz and Cz, the fractional digits of Kz are not plausible
    // About 3) La & Yb are reset to coefficients from tests (1) and (2) for the results to make sense
    // About 5) hz is adjusted to stay within 0…360
  ];
  const T = tests[0], results = [];
  const pad = (s,n = 8) => (s + "").padEnd (n), num = (v,n = 17) => pad (v.toPrecision (12), n);
  const wsign = s => s[0] == "-" ? s : " " + s, dfmt = n => wsign (n.toFixed (9));
  // zcam_from_xyz
  for (let i = 1; i < tests.length; i++) {
    // prepare conditions
    const row = tests[i], diffs = [];
    const zcond = { Xw: row[3], Yw: row[4], Zw: row[5], Fs: row[6], La: row[7], Yb: row[8], strict: true };
    // calc test
    const xyz = { x: row[0], y: row[1], z: row[2] }, zcam = results[i] = Z.zcam_from_xyz (xyz, zcond);
    // calc diffs
    const zval = i => { const v = zcam[T[i]] === undefined ? zcond[T[i]] : zcam[T[i]]; return v === undefined ? NaN : v; };
    let bad = 0;
    for (let j = 0; j < row.length; j++) {
      diffs[j] = row[j] - zval (j);
      bad += !(Math.abs (diffs[j]) < 10**E[j]);
    }
    if (!bad) continue;
    // print
    console.log ('**FAIL**: zcam_from_xyz test case broken');
    console.log (i + ") XYZ:", [row[0], row[1], row[2]], "     [-Diffs-]");
    for (let j = 9; j < row.length; j++) {
      const bad = Math.abs (diffs[j]) < 10**E[j] ? '' : " **BAD** (" + row[j] + ")";
      console.log ("  ", pad (T[j] + ":", 4), num (zval (j)), "  " + dfmt (diffs[j]) + bad);
    }
    assert.deepEqual (bad, false);
  }
  // xyz_from_zcam
  for (let i = 1; i < tests.length; i++) {
    // prepare conditions
    const row = tests[i], zcam = results[i], eps = 0.02;
    const zval = i => { const v = zcam[T[i]] === undefined ? zcam.zcond[T[i]] : zcam[T[i]]; return v === undefined ? NaN : v; };
    const verify = (zinput, xyz) => {
      const diff = [ xyz[0] - zcam.X, xyz[1] - zcam.Y, xyz[2] - zcam.Z ];
      const bad = !(Math.abs (diff[0]) < eps) || !(Math.abs (diff[1]) < eps) || !(Math.abs (diff[2]) < eps);
      if (!bad) return;
      console.log ('**FAIL**: xyz_from_zcam test case broken');
      console.log ('xyz=', xyz, '\ndiff=', diff, '\nzinput', zinput, '\nzcam=', zcam);
      assert.deepEqual (bad, false);
    };
    let zinput, xyz;
    for (const lightness of ['Jz', 'Qz']) { // Qz OR Jz
      for (const chroma of ['Kz', 'Wz', 'Sz']) {
	zinput = { hz: zcam.hz, viewing: zcam.viewing };
	zinput[lightness] = zcam[lightness];
	zinput[chroma] = zcam[chroma];
	verify (zinput, Z.xyz_from_zcam (zinput));
      }
    }
  }
}

// Run unit tests
test_math();
test_srgb();
test_jzazbz();
test_chromatic_adaptation();
test_zcam();
console.log ("OK:", process.argv[1]);
