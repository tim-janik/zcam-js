// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0

import replace from '@rollup/plugin-replace';

const plugins = [
  replace ({
    'process.ROLLUP': JSON.stringify (true),
    preventAssignment: true
  }),
];

const input = 'index.js';
const treeshake = 'safest';
const external = ['fs', 'assert', 'perf_hooks'];

export default [
  {
    input, treeshake, external, plugins,
    output: {file: 'zcam-js.mjs', format: 'es' },
  },
  {
    input, treeshake, external, plugins,
    output: {file: 'zcam-js.cjs', format: 'cjs' },
  },
];
