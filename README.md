# debounce

Small ESM debounce and throttle utilities with leading/trailing edge control.

## Usage

```js
import { debounce, throttle } from 'debounce';

const d = debounce((v) => console.log(v), 200, { leading: true, trailing: true });
d.run('hello');   // fires immediately (leading)
d.run('world');  // coalesced; fires once after 200ms (trailing)
d.cancel();      // or d.flush() to fire pending now

const t = throttle((v) => console.log(v), 200);
t.run('a');  // fires now
t.run('b');  // held; one trailing call after 200ms
```

## Why

Needed a zero-dependency debounce with explicit leading/trailing semantics and a cancel/flush surface. The trade-off: this implements the Lodash-style model only. If you want a different debounce flavour (e.g. async-cancellable promises, or requestAnimationFrame-based), this is not it.

## Edge cases

- `wait=0` schedules a trailing call on the next tick via `setTimeout(..., 0)`, not synchronously.
- With `leading: true, trailing: true`, a single call fires exactly once (leading); the trailing timer is armed but finds nothing pending. Two calls within the window produce two invocations.
- `flush()` only fires when a trailing call is actually pending; calling it on an idle debounce is a no-op.
- `cancel()` clears the pending trailing call and resets leading-edge state so the next call is treated as the start of a fresh burst.

The returned object exposes `run`, `cancel`, and `flush` — there is no default-callable form.
