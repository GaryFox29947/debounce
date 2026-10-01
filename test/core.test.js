import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debounce, throttle } from '../src/index.js';

// Debounce uses real timers (setTimeout). Because the test suite forbids
// sleeping or asserting on wall-clock time, we test the aspects that are
// deterministic without real-time waits:
// - leading call fires synchronously
// - trailing call does NOT fire synchronously on first invocation
// - cancel prevents scheduled trailing calls
// - flush fires pending trailing immediately
// - argument coalescing (last call wins)
// - validation errors
//
// We use `node:test`'s real timer for the few time-based cases but keep
// assertions structural (call counts) rather than time comparisons.

function makeCallCount(fn) {
  let count = 0;
  let lastArgs = null;
  const wrapper = (...args) => {
    count++;
    lastArgs = args;
    fn && fn(...args);
  };
  wrapper.getCount = () => count;
  wrapper.getLastArgs = () => lastArgs;
  return wrapper;
}

test('debounce leading=true fires immediately on first call', () => {
  const f = makeCallCount();
  const d = debounce(f, 100, { leading: true, trailing: false });
  d.run('a');
  assert.equal(f.getCount(), 1);
  d.run('b');
  assert.equal(f.getCount(), 1); // no trailing, leading already fired
  d.cancel();
});

test('debounce default (leading=false) does NOT fire synchronously', () => {
  const f = makeCallCount();
  const d = debounce(f, 1000); // long wait; we won't wait for it
  d.run('a');
  d.run('b');
  assert.equal(f.getCount(), 0);
  d.cancel();
});

test('debounce coalesces arguments: last call wins for trailing', async () => {
  const f = makeCallCount();
  const d = debounce(f, 50);
  d.run('first');
  d.run('second');
  d.run('third');
  // Wait for trailing timer to fire.
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(f.getCount(), 1);
  assert.deepEqual(f.getLastArgs(), ['third']);
});

test('debounce cancel prevents trailing call', async () => {
  const f = makeCallCount();
  const d = debounce(f, 50);
  d.run('a');
  d.cancel();
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(f.getCount(), 0);
});

test('debounce flush fires pending trailing immediately', () => {
  const f = makeCallCount();
  const d = debounce(f, 1000);
  d.run('a');
  d.flush();
  assert.equal(f.getCount(), 1);
  assert.deepEqual(f.getLastArgs(), ['a']);
  d.cancel();
});

test('debounce flush is a no-op when nothing pending', () => {
  const f = makeCallCount();
  const d = debounce(f, 1000);
  d.flush();
  assert.equal(f.getCount(), 0);
});

test('debounce leading+trailing fires twice within burst', async () => {
  const f = makeCallCount();
  const d = debounce(f, 50, { leading: true, trailing: true });
  d.run('a'); // leading fires immediately
  assert.equal(f.getCount(), 1);
  d.run('b'); // schedules trailing
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(f.getCount(), 2);
  assert.deepEqual(f.getLastArgs(), ['b']);
});

test('debounce leading+trailing: no extra trailing when only one call', async () => {
  const f = makeCallCount();
  const d = debounce(f, 50, { leading: true, trailing: true });
  d.run('a');
  assert.equal(f.getCount(), 1);
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(f.getCount(), 1); // no second call
});

test('throttle fires leading immediately', () => {
  const f = makeCallCount();
  const t = throttle(f, 1000);
  t.run('a');
  assert.equal(f.getCount(), 1);
  t.cancel();
});

test('throttle coalesces trailing after leading', async () => {
  const f = makeCallCount();
  const t = throttle(f, 50);
  t.run('a');
  t.run('b');
  assert.equal(f.getCount(), 1); // only leading so far
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(f.getCount(), 2);
  assert.deepEqual(f.getLastArgs(), ['b']);
});

test('debounce rejects non-function fn', () => {
  assert.throws(() => debounce(null, 100), /fn must be a function/);
});

test('debounce rejects invalid wait', () => {
  assert.throws(() => debounce(() => {}, -1), /wait must be/);
  assert.throws(() => debounce(() => {}, NaN), /wait must be/);
  assert.throws(() => debounce(() => {}, 'x'), /wait must be/);
});

test('debounce rejects invalid options', () => {
  assert.throws(() => debounce(() => {}, 100, { leading: 'yes' }), /leading must be a boolean/);
  assert.throws(() => debounce(() => {}, 100, { trailing: 1 }), /trailing must be a boolean/);
});

test('debounce preserves this context', async () => {
  const calls = [];
  const ctx = { name: 'ctx' };
  const d = debounce(function () { calls.push(this.name); }, 50);
  d.run.call(ctx);
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(calls, ['ctx']);
});

test('debounce wait=0 fires on next tick (trailing)', async () => {
  const f = makeCallCount();
  const d = debounce(f, 0);
  d.run('a');
  assert.equal(f.getCount(), 0);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(f.getCount(), 1);
});

test('debounce can be called repeatedly across bursts', async () => {
  const f = makeCallCount();
  const d = debounce(f, 30);
  d.run('burst1');
  await new Promise((r) => setTimeout(r, 80));
  d.run('burst2');
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(f.getCount(), 2);
});
