// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0

import replace from '@rollup/plugin-replace';

const plugins = [
  replace ({
    'process.ROLLUP': JSON.stringify (true),
    preventAssignment: true
  }),
];

export default {
  input: 'index.js',
  treeshake: "safest",
  output: {
    file: 'dist.js',
    format: 'es'
  },
  external: ['fs', 'assert', 'perf_hooks'],
  plugins
};
