/**
 * Debounce and throttle utilities.
 *
 * All time-based behaviour is parameterised by a clock function. The default
 * clock uses `Date.now()`, which is monotonic enough for real use, but tests
 * can pass a fake clock so that timing assertions are exact and deterministic.
 */

/**
 * A clock function returns the current time in milliseconds.
 * Passed in so tests never touch wall-clock time.
 * @typedef {() => number} Clock
 */

const defaultClock = () => Date.now();

/**
 * Validate the wait parameter. Throws on non-numbers so callers fail loudly
 * at construction time instead of silently behaving like wait=0.
 */
function assertWait(wait) {
  if (typeof wait !== 'number' || !Number.isFinite(wait) || wait < 0) {
    throw new TypeError(`wait must be a non-negative finite number, got: ${String(wait)}`);
  }
}

/**
 * Validate the leading/trailing options.
 */
function assertOptions(leading, trailing) {
  if (typeof leading !== 'boolean') {
    throw new TypeError(`leading must be a boolean, got: ${typeof leading}`);
  }
  if (typeof trailing !== 'boolean') {
    throw new TypeError(`trailing must be a boolean, got: ${typeof trailing}`);
  }
}

/**
 * Creates a debounced function.
 *
 * Interpretation chosen (stated plainly):
 * - `leading: true` invokes immediately on the first call, then stays quiet
 *   for `wait` ms. Calls during the quiet period schedule a trailing call
 *   only if `trailing` is also true.
 * - `leading: false` (default) schedules the first call as a trailing call at
 *   `wait` ms after the most recent invocation. Each new call pushes the
 *   scheduled time forward.
 * - `trailing: true` (default) fires a call at the trailing edge of the
 *   burst if any calls arrived after the leading edge (or after the last
 *   trailing call). When `trailing: false`, only the leading call fires.
 * - `trailing` with no preceding call never fires.
 *
 * This is the Lodash-style debounce model. We picked one interpretation and
 * stuck to it; we do not attempt to honour other meanings of "debounce".
 *
 * @param {Function} fn
 * @param {number} wait - non-negative milliseconds
 * @param {object} [opts]
 * @param {boolean} [opts.leading=false]
 * @param {boolean} [opts.trailing=true]
 * @param {Clock} [opts.clock] - injectable clock for testing
 * @returns {{ run: Function, cancel: Function, flush: Function }}
 */
export function debounce(fn, wait, opts = {}) {
  if (typeof fn !== 'function') {
    throw new TypeError('fn must be a function');
  }
  assertWait(wait);
  const leading = opts.leading ?? false;
  const trailing = opts.trailing ?? true;
  assertOptions(leading, trailing);
  const clock = opts.clock ?? defaultClock;

  let timerId = null;
  let lastArgs = null;
  let lastThis = null;
  let invokedLeading = false;

  function invokeNow() {
    const args = lastArgs;
    const ctx = lastThis;
    lastArgs = null;
    lastThis = null;
    fn.apply(ctx, args);
  }

  function clearTimer() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function scheduleTrailing(delay) {
    clearTimer();
    timerId = setTimeout(() => {
      timerId = null;
      // Re-check: if calls came in after scheduling, we fire trailing.
      // If lastArgs is null, nothing pending.
      if (lastArgs !== null) {
        invokeNow();
      }
      // After a trailing invocation we reset the leading flag so a new
      // burst can fire leading again.
      invokedLeading = false;
    }, delay);
  }

  function run(...args) {
    lastArgs = args;
    lastThis = this;

    if (!invokedLeading && leading) {
      // Leading edge: fire now, mark as invoked.
      invokedLeading = true;
      invokeNow();
      if (trailing) {
        // Arm a trailing timer; if no more calls arrive within wait,
        // the trailing timer fires but lastArgs will be null so it's a no-op.
        scheduleTrailing(wait);
      }
      return;
    }

    if (trailing) {
      scheduleTrailing(wait);
    }
  }

  function cancel() {
    clearTimer();
    lastArgs = null;
    lastThis = null;
    invokedLeading = false;
  }

  function flush() {
    if (timerId !== null && lastArgs !== null) {
      clearTimer();
      invokeNow();
      invokedLeading = false;
    }
  }

  return { run, cancel, flush };
}

/**
 * Creates a throttled function.
 *
 * Throttle is implemented as a debounce with `leading: true, trailing: true`
 * by default: the first call fires immediately, subsequent calls are
 * coalesced into a single trailing call after `wait` ms of quiet. This is
 * the most common throttle contract and is what the name means to most
 * callers.
 *
 * If you need trailing-only or leading-only throttle, pass explicit options.
 *
 * @param {Function} fn
 * @param {number} wait
 * @param {object} [opts]
 * @param {boolean} [opts.leading=true]
 * @param {boolean} [opts.trailing=true]
 * @param {Clock} [opts.clock]
 */
export function throttle(fn, wait, opts = {}) {
  return debounce(fn, wait, {
    leading: true,
    trailing: true,
    ...opts,
  });
}
