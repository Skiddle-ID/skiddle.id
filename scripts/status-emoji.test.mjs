// The status's emoji (src/lib/status-states.mjs): one emoji, as people see it, or nothing.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMOJI_PICKS, isEmoji } from '../src/lib/status-states.mjs';

describe('status emoji', () => {
  it('one emoji counts, whatever it’s made of', () => {
    for (const e of ['☕', '✈️', '🧑‍💻', '🇹🇭', '1️⃣', '👍🏽', ...EMOJI_PICKS]) assert.equal(isEmoji(e), true, e);
  });
  it('text, two emoji or nothing doesn’t', () => {
    for (const e of ['', 'a', ':)', '✈️✈️', '😀x', ' ', 42, null, undefined]) assert.equal(isEmoji(e), false, String(e));
  });
});
