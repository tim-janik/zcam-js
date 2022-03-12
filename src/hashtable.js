// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';

const runtime_seed32 = (Math.random() * 2**32) >>> 0; // 0x61c97bfd;
const phi32 = (1 | 0.61803398874989484820458683436563811772030917980575 * 2**32) >>> 0;

/** Hashtable for large amounts of floats
 * Keeping 100k or more floats in a Javascript Map() puts a lot of pressure on the
 * GC. This can be avoided with Float64Table if the keys and values are strictly typed.
 */
export class Float64Table {
  constructor (size = 128, maxsize = (1 << 31) >>> 0) {
    this.maxsize = Math.max (maxsize, 32);
    this.clear (size);
  }
  clear (size = 128) {
    this.slots = this.vals = undefined;
    this.rehash (size);
  }
  rehash (size, purge) {
    this.ushift = Math.clz32 (Math.max (2, size) - 1) >>> 0;
    const lshift = 32 - this.ushift;
    this.tablesize = (1 << lshift) >>> 0;
    this.mask = (this.tablesize - 1) >>> 0;
    const threasholds = { sz: 16 * 1024, l: 0.83 };	// resize above 83% for tables >= 16k entries
    const loadfactor = 1 - (1 - threasholds.l) * Math.min (this.tablesize / threasholds.sz, 1);
    this.highmark = Math.min (this.tablesize - 1, this.tablesize * loadfactor) >>> 0;
    this.length = 0;
    const oslots = this.slots, ovals = this.vals;
    // create array for size * (key,value) slots + tombstone (FLAG,value)
    this.slots = new Uint32Array (this.tablesize + 1); // 0-filled
    this.vals = new Float64Array (this.tablesize + 1); // 0-filled
    // this.slots.fill (0); // tombstone
    if (oslots) {
      let accu = 0; // randomize eviction
      if (!purge) {
	for (let i = 0; i < oslots.length - 1; i++)
	  if (oslots[i])
	    this.set (oslots[i], ovals[i]);
      } else {
	for (let i = 0; i < oslots.length - 1; i++)
	  if (oslots[i]) {
	    accu = oslots[i] + accu * 1664525;
	    if (accu & 1) // evict 50%
	      this.set (oslots[i], ovals[i]);
	  }
      }
      if (oslots[oslots.length - 1])    // rehash tombstone value
	this.set (0, ovals[ovals.length - 1]);
    }
  }
  resize_or_purge() {
    if (2 * this.tablesize <= this.maxsize)
      this.rehash (2 * this.tablesize);
    else
      this.rehash (this.tablesize, true);
  }
  hash_bucket (key) {
    // https://probablydance.com/2018/06/16/fibonacci-hashing-the-optimization-that-the-world-forgot-or-a-better-alternative-to-integer-modulo
    let h = key;
    h = h * phi32;              // evenly distribute entropy across available bits
    h = h + runtime_seed32;     // reseed each runtime
    return h >>> this.ushift;   // includes &= this.mask
  }
  get size() {
    return this.length;
  }
  find_slot (key) {
    const slots = this.slots;
    let i = this.hash_bucket (key);
    // search until key or tombstone is found
    while (slots[i] && slots[i] != key)
      i = (i + 1) & this.mask;
    return i;
  }
  get (key) {
    // tombstone handling
    if (!key)
      return this.slots[this.slots.length - 1] ? this.vals[this.vals.length - 1] : undefined;
    // find value
    const i = this.find_slot (key);
    if (this.slots[i])          // key exists
      return this.vals[i];      // value
    return undefined;           // NaN;
  }
  set (key, value) {
    // tombstone handling
    if (!key)
      return (this.slots[this.slots.length - 1] = 1, this.vals[this.vals.length - 1] = value);
    // find key or empty slot
    let i = this.find_slot (key);
    if (!this.slots[i]) {
      // first, resize
      if (this.length >= this.highmark) {
	this.resize_or_purge();
	i = this.find_slot (key); // find empty after resize
      }
      // insert *last*, to avoid purging
      this.length++;
      this.slots[i] = key;
    }
    return this.vals[i] = value;
  }
  delete (key) {
    // tombstone handling
    if (!key)
      return (this.slots[this.slots.length - 1] = 0, undefined);
    const slots = this.slots;
    // find value
    let n, g = this.find_slot (key);
    if (!slots[g])              // key not present
      return;
    this.length--;
    slots[g] = 0;               // set tombstone at g (= gap)
    // move up successors
    n = (g + 1) & this.mask;    // n = next
    while (slots[n]) {          // next is not tombstone
      const h = this.hash_bucket (slots[n]);
      /* Here, we know [g+1…n] is a consecutive cluster, if h does not originate
       * within it, it must move/wrap to g from another origin within [n+1…g].
       *   originates = n < g                   // n wrapped around
       *                ? h <= n || h > g       // (g… | h …n] OR (g… h | …n]
       *                : h > g && h <= n;      // (g… h …n]
       * Does h belong *inside* consecutive cluster ending at g, outside [g+1…n]?
       *   incluster_gn = (h <= g) ^ (h > n);   // g < n, !(h > g && h <= n)
       *   incluster_ng = (h <= g) ^ (h <= n);  // n < g, !(h > g || h <= n)
       * Note: (h <= n) == !(h > n);      // where g < n determines which term is needed
       *   incluster = (h <= g) ^ (h <= n) ^ (g < n);  // == !originates
       */
      const move_n2g = (h <= g) ^ (h <= n) ^ (g < n);
      if (move_n2g) {		// next belongs to cluster at g
	slots[g] = slots[n];	// collapse next into empty slot
	this.vals[g] = this.vals[n];
	g = n;
	slots[g] = 0;           // new tombstone at g (= gap)
      }
      n = (n + 1) & this.mask;  // n = next
    }
  }
  // .keys() and .values() cannot be provided in insertion order
  *[Symbol.iterator]() {
    // tombstone handling
    if (this.slots[this.slots.length - 1])
      yield [0, this.vals[this.vals.length - 1]];
    // handle items, beware of changes to this
    for (let i = 0; i < this.slots.length - 1; i++)
      if (this.slots[i])
        yield [this.slots[i], this.vals[i]];
  }
  /// Produce all `[key,value]` pairs in no particular order.
  entries() {
    return this[Symbol.iterator]();
  }
  /// Invoke callback() for all entries in no particular order.
  forEach (callback, thisArg = undefined) {
    for (const entry of this)
      callback.call (thisArg, entry[1], entry[0], this);
  }
};

async function test() {
  const assert = await import ('assert');
  const N = 999999;;
  // performance
  const { PerformanceObserver, performance: PF } = await import ('perf_hooks');
  const PO = new PerformanceObserver (items => {
    for (const item of items.getEntries())
      console.log (item.name, item.duration);
  });
  PO.observe ({ type: 'measure' });
  let ft = new Float64Table(), m = new Map();
  PF.mark ("m0");
  for (let i = 0; i < N; i++)
    ft.set (i, 3+i*2);
  PF.mark ("m1");
  for (let i = 0; i < N; i++)
    m.set (i, 3+i*2);
  PF.mark ("m2");
  PF.measure ("Float64Table inserts", "m0", "m1");
  PF.measure ("Nodejs Map() inserts", "m1", "m2");
  PF.mark ("l0");
  for (let i = 0; i < N; i++)
    assert.deepEqual (ft.get (i), 3+i*2);
  PF.mark ("l1");
  for (let i = 0; i < N; i++)
    assert.deepEqual (m.get (i), 3+i*2);
  PF.mark ("l2");
  PF.measure ("Float64Table lookups", "l0", "l1");
  PF.measure ("Nodejs Map() lookups", "l1", "l2");
  function array_from (map) {
    const arr = Array.from (map);
    return arr.sort ((p,n) => p[0] - n[0]);
  }
  assert.deepEqual (array_from (m), array_from (ft));
  assert.deepEqual (array_from (m.entries()), array_from (ft.entries()));
  // test behaviour
  let cond = i => (i%7 <3) || (i%47 >= 42) || (i > 100 && i < 330);
  for (let i = -(N/2 | 0); i < 1.5 * N; i++)
    assert.deepEqual (ft.get (i), i<0 || i>=N ? undefined : 3+i*2);
  for (let i = 0; i < N; i++)
    if (cond (i))
      ft.delete (i);
  for (let i = -N; i < 2*N; i++) {
    if (cond (i))
      assert.deepEqual (ft.get (i), undefined); // deleted
    else
      assert.deepEqual (ft.get (i), i<0 || i>=N ? undefined : 3+i*2); // never inserted
  }
  const mix = i => (1664525 * i + 1013904223) >>> 0;
  ft = new Float64Table();
  for (let i = 0; i < N; i++)
    ft.set (mix (i), i + 1);
  for (let i = N; i < 3*N; i++)
    ft.set (mix (i), i * 2);
  for (let i = 0; i < 3*N; i++)
    if (cond (i))
      ft.delete (mix (i));
  for (let i = 0; i < 3*N; i++) {
    if (cond (i))
      assert.deepEqual (ft.get (mix (i)), undefined); // deleted
    else
      assert.deepEqual (ft.get (mix (i)), i < N ? i + 1 : i >= N ? i * 2 : undefined);
  }
  // randomized testing
  const R = 19999;
  ft.clear();
  m.clear();
  for (let i = 0; i < R; i++) { // insert with random keys
    const k = (1664525 * i + 1013904223) >>> 0;
    const r = Math.random() * 100;
    ft.set (k, r);
    m.set (k, r);
  }
  assert.deepEqual (ft.size, m.size);
  assert.deepEqual (array_from (m), array_from (ft));
  for (let i = 0; i < N; i++) { // delete random places
    const k = (1664525 * i + 1013904223) >>> 0;
    if ((i ^ k) & 0x010) // 50% chance
      continue;
    ft.delete (k);
    m.delete (k);
  }
  assert.deepEqual (ft.size, m.size);
  assert.deepEqual (array_from (m), array_from (ft));
}
if (process.argv[1] == import.meta.url.replace (/^file:\/\//, ''))
  await test();
