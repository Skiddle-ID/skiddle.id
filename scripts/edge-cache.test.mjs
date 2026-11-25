// cached() from src/lib/edge-cache.ts: one load per key while it's fresh, failures not kept, and a
// load that never settles (its request was cut off) doesn't hold the key for the rest of its TTL.
// No edge cache here (caches.default is undefined in Node), so only the in-memory side runs.
import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { cached, forget, PENDING_MS } from '../src/lib/edge-cache.ts';

let n = 0;
/** A fresh key per test, so tests don't share cache entries */
const key = () => `test/${++n}`;
const never = () => new Promise(() => {});
const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('cached', () => {
  beforeEach(() => mock.timers.reset());

  it('loads once while fresh', async () => {
    const k = key();
    let loads = 0;
    const load = async () => ++loads;
    assert.equal(await cached(k, 60, load), 1);
    assert.equal(await cached(k, 60, load), 1);
    assert.equal(loads, 1);
  });

  it('shares a load that is still running', async () => {
    const k = key();
    let loads = 0;
    let finish;
    const load = () => { loads++; return new Promise((resolve) => (finish = resolve)); };
    const a = cached(k, 60, load);
    const b = cached(k, 60, load);
    await tick();
    finish('x');
    assert.deepEqual(await Promise.all([a, b]), ['x', 'x']);
    assert.equal(loads, 1);
  });

  it('loads again after the TTL', async (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    const k = key();
    let loads = 0;
    const load = async () => ++loads;
    await cached(k, 60, load);
    t.mock.timers.tick(61_000);
    assert.equal(await cached(k, 60, load), 2);
  });

  it("doesn't keep a failed load", async () => {
    const k = key();
    await assert.rejects(cached(k, 60, async () => { throw new Error('down'); }), /down/);
    assert.equal(await cached(k, 60, async () => 'back'), 'back');
  });

  it('passes a failure on to whoever was waiting for that load', async () => {
    const k = key();
    let fail;
    const first = cached(k, 60, () => new Promise((_, reject) => (fail = reject)));
    const second = cached(k, 60, async () => 'unused');
    await tick();
    fail(new Error('down'));
    await assert.rejects(first, /down/);
    await assert.rejects(second, /down/);
  });

  it("stops waiting for a load that never settles, and loads itself", async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const k = key();
    cached(k, 3600, never); // the request that started it was cut off
    const waiting = cached(k, 3600, async () => 'fresh');
    await tick();
    t.mock.timers.tick(PENDING_MS);
    assert.equal(await waiting, 'fresh');
    // and that fresh value is what the key holds now
    assert.equal(await cached(k, 3600, async () => 'unused'), 'fresh');
  });

  it("doesn't wait at all for a load that's already past its time", async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const k = key();
    cached(k, 3600, never);
    t.mock.timers.tick(PENDING_MS + 1);
    assert.equal(await cached(k, 3600, async () => 'fresh'), 'fresh');
  });

  it('forget() drops a value and a running load', async () => {
    const k = key();
    await cached(k, 60, async () => 'old');
    await forget([k]);
    assert.equal(await cached(k, 60, async () => 'new'), 'new');
    const k2 = key();
    cached(k2, 60, never);
    await forget([k2]);
    assert.equal(await cached(k2, 60, async () => 'new'), 'new');
  });
});
