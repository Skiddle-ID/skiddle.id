import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STATUS_LOG_COLLECTION, logEntryOf, statusHistory } from '../src/lib/status-log.mjs';

const uri = (rkey) => `at://did:plc:x/${STATUS_LOG_COLLECTION}/${rkey}`;

describe('status history', () => {
  it('a history entry is the status with its updatedAt as createdAt', () => {
    const status = { $type: 'id.skiddle.status', state: 'busy', available: false, text: 'flying', emoji: '✈️', location: 'Bangkok', timeZone: 'Asia/Bangkok', updatedAt: '2026-11-27T08:00:00.000Z' };
    assert.deepEqual(logEntryOf(status), {
      $type: STATUS_LOG_COLLECTION,
      state: 'busy',
      available: false,
      text: 'flying',
      emoji: '✈️',
      location: 'Bangkok',
      timeZone: 'Asia/Bangkok',
      createdAt: '2026-11-27T08:00:00.000Z',
    });
  });

  it('lists the current status first, then the past ones newest first, without listing the current one twice', () => {
    const current = { state: 'available', available: true, text: 'open to consulting', updatedAt: '2026-11-27T09:00:00.000Z' };
    const log = [
      { uri: uri('a'), value: { state: 'busy', available: false, text: 'flying', createdAt: '2026-11-20T09:00:00.000Z' } },
      { uri: uri('c'), value: { ...current, createdAt: current.updatedAt } },
      { uri: uri('b'), value: { state: 'away', available: false, text: 'on holiday', emoji: '🏖️', createdAt: '2026-11-25T09:00:00.000Z' } },
    ];
    const history = statusHistory(current, log);
    assert.deepEqual(
      history.map((h) => [h.text, h.current, h.rkey]),
      [
        ['open to consulting', true, undefined],
        ['on holiday', false, 'b'],
        ['flying', false, 'a'],
      ],
    );
    assert.equal(history[1].emoji, '🏖️');
  });

  it('shows the current status even before it has a copy, and leaves out records it can’t show', () => {
    const current = { available: true, text: 'open', updatedAt: '2026-11-27T09:00:00.000Z' };
    const log = [
      { uri: uri('x'), value: { available: true, text: '', createdAt: '2026-11-20T09:00:00.000Z' } },
      { uri: uri('y'), value: { available: true, text: 'no date' } },
      { uri: uri('z'), value: { text: 'no state', createdAt: '2026-11-21T09:00:00.000Z' } },
      { uri: uri('w'), value: { state: 'dnd', available: false, text: 'focus', emoji: 'not one', createdAt: '2026-11-22T09:00:00.000Z' } },
    ];
    const history = statusHistory(current, log);
    assert.deepEqual(history.map((h) => h.text), ['open', 'focus']);
    assert.equal(history[0].state, 'available');
    assert.equal(history[1].emoji, undefined);
    assert.deepEqual(statusHistory(null, []), []);
  });
});
