import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EVENT_COLLECTION,
  activitiesOf,
  eventInstant,
  noteLine,
  zoneLabel,
  eventFromRecord,
  eventProblems,
  eventsFromRecords,
  eventsOn,
  isoWeek,
  monthGrid,
  parsePeriod,
  roughOnly,
  todayIn,
  upcoming,
} from '../src/lib/timeline.mjs';

const uri = (rkey) => `at://did:plc:x/${EVENT_COLLECTION}/${rkey}`;
// 27 Nov 2026, 10:00 in Bangkok
const NOW = Date.parse('2026-11-27T03:00:00Z');

describe('timeline periods', () => {
  it('reads weeks, months and days from their addresses', () => {
    assert.deepEqual(parsePeriod('2026-W48'), {
      kind: 'week',
      key: '2026-W48',
      label: '23–29 Nov 2026',
      start: '2026-11-23',
      end: '2026-11-29',
      prev: '2026-W47',
      next: '2026-W49',
    });
    const month = parsePeriod('2026-11');
    assert.deepEqual([month.label, month.start, month.end, month.prev, month.next], ['November 2026', '2026-11-01', '2026-11-30', '2026-10', '2026-12']);
    assert.equal(parsePeriod('2024-02').end, '2024-02-29');
    const day = parsePeriod('2026-11-27');
    assert.deepEqual([day.label, day.prev, day.next], ['Friday 27 November 2026', '2026-11-26', '2026-11-28']);
  });

  it('refuses what isn’t a period', () => {
    for (const bad of ['2026-W54', '2025-W53', '2026-13', '2026-02-30', 'soon', '2026-11-27x']) assert.equal(parsePeriod(bad), null, bad);
    assert.equal(parsePeriod('2026-W53').start, '2026-12-28');
  });

  it('counts ISO weeks across New Year', () => {
    assert.deepEqual(isoWeek('2027-01-01'), { year: 2026, week: 53 });
    assert.deepEqual(isoWeek('2025-12-29'), { year: 2026, week: 1 });
    assert.equal(parsePeriod('2026-W01').start, '2025-12-29');
  });

  it('lays a month out in whole weeks, Monday first', () => {
    const grid = monthGrid(parsePeriod('2026-11'));
    assert.equal(grid.length % 7, 0);
    // 1 Nov 2026 is a Sunday
    assert.deepEqual(grid.slice(0, 7), [null, null, null, null, null, null, '2026-11-01']);
    assert.equal(grid.at(-1), null);
  });

  it('knows the day it is in a time zone', () => {
    assert.equal(todayIn('Asia/Bangkok', Date.parse('2026-11-27T20:00:00Z')), '2026-11-28');
    assert.equal(todayIn('Europe/Paris', Date.parse('2026-11-27T20:00:00Z')), '2026-11-27');
  });
});

describe('timeline events', () => {
  const details = { title: 'Flight home', startTime: '18:05', endTime: '11:40', timeZone: 'Europe/Paris', place: 'CDG', note: 'Window seat.', link: '/posts/x/' };

  it('an upcoming event shows only its kind, days, city and note', () => {
    const e = eventFromRecord(uri('a'), { kind: 'flight', startsOn: '2026-11-28', endsOn: '2026-11-29', city: 'Paris', ...details }, NOW);
    assert.deepEqual(e, { rkey: 'a', kind: 'flight', label: 'Flight', startsOn: '2026-11-28', endsOn: '2026-11-29', city: 'Paris', note: 'Window seat.', rough: true, over: false, timeZone: 'Asia/Bangkok' });
  });

  it('an event under way today is still rough', () => {
    assert.equal(eventFromRecord(uri('a'), { kind: 'trip', startsOn: '2026-11-26', endsOn: '2026-11-27' }, NOW).rough, true);
  });

  it('an announced event, or one that’s over, shows its details', () => {
    const announced = eventFromRecord(uri('a'), { kind: 'talk', startsOn: '2026-12-05', announced: true, ...details }, NOW);
    assert.equal(announced.title, 'Flight home');
    assert.equal(announced.rough, false);
    const past = eventFromRecord(uri('b'), { kind: 'flight', startsOn: '2026-11-20', endsOn: '2026-11-21', ...details }, NOW);
    assert.deepEqual([past.over, past.title, past.startTime, past.endTime, past.timeZone, past.link], [true, 'Flight home', '18:05', '11:40', 'Europe/Paris', '/posts/x/']);
  });

  it('leaves out what it can’t show', () => {
    assert.equal(eventFromRecord(uri('a'), { startsOn: '2026-11-20' }, NOW), null);
    assert.equal(eventFromRecord(uri('a'), { kind: 'trip', startsOn: '20 Nov' }, NOW), null);
    const e = eventFromRecord(uri('a'), { kind: 'zeppelin', startsOn: '2026-11-20', endsOn: '2026-11-19', endTime: '10:00', link: 'javascript:x', timeZone: 'Mars/Base' }, NOW);
    assert.deepEqual([e.label, e.endsOn, e.endTime, e.link, e.timeZone], ['Event', '2026-11-20', undefined, undefined, 'Asia/Bangkok']);
  });

  it('puts events on every day they cover, all-day ones first, and lists what’s coming', () => {
    const events = eventsFromRecords(
      [
        { uri: uri('c'), value: { kind: 'meeting', startsOn: '2026-11-25', startTime: '09:00' } },
        { uri: uri('a'), value: { kind: 'trip', startsOn: '2026-11-24', endsOn: '2026-11-26' } },
        { uri: uri('b'), value: { kind: 'deadline', startsOn: '2026-12-01' } },
      ],
      NOW,
    );
    const on25 = eventsOn(events, '2026-11-25');
    assert.deepEqual(on25.map((x) => [x.event.rkey, x.first, x.last]), [['a', false, false], ['c', true, true]]);
    assert.deepEqual(upcoming(events, '2026-11-27').map((e) => e.rkey), ['b']);
  });

  it('checks what the lexicon can’t, and saves only the rough fields', () => {
    assert.deepEqual(eventProblems({ startsOn: '2026-11-27', endsOn: '2026-11-26', endTime: '10:00', timeZone: 'Mars/Base', link: 'x' }), [
      'Ends on is before Starts on.',
      'An end time needs a start time.',
      'Unknown time zone: Mars/Base. Use one like Europe/Paris.',
      'Link is a path on the site, like /posts/…/, or a full URL.',
    ]);
    assert.deepEqual(eventProblems({ startsOn: '2026-11-27', startTime: '10:00', endTime: '09:00' }), ['End time is before Start time.']);
    assert.deepEqual(roughOnly({ kind: 'trip', startsOn: '2026-11-27', city: 'Paris', announced: false, ...details }), { kind: 'trip', startsOn: '2026-11-27', city: 'Paris', announced: false, note: 'Window seat.' });
  });
});

describe('timeline activity', () => {
  it('puts posts, status changes and notes on their Bangkok day, in order', () => {
    const list = activitiesOf({
      posts: [{ title: 'Lab Notes #3', href: '/posts/lab-notes-3/', publishedAt: new Date('2026-11-25T06:40:44Z'), series: 'Lab Notes' }],
      statuses: [{ text: 'Having some coffee', at: '2026-11-27T07:44:00Z', timeZone: 'Europe/Paris', location: 'Paris', emoji: '☕', state: 'away' }],
      notes: [{ text: 'Late one #note', url: 'https://bsky.app/profile/skiddle.blue/post/x', createdAt: '2026-11-26T18:00:00Z' }],
    });
    assert.deepEqual(
      list.map((a) => [a.type, a.day, a.time, a.timeZone, a.text]),
      [
        ['post', '2026-11-25', '13:40', 'Asia/Bangkok', 'Lab Notes #3'],
        // 01:00 the next day in Bangkok
        ['note', '2026-11-27', '01:00', 'Asia/Bangkok', 'Late one'],
        // shown in the zone it was set in
        ['status', '2026-11-27', '08:44', 'Europe/Paris', 'Having some coffee'],
      ],
    );
    assert.equal(list[0].meta, 'Lab Notes');
    assert.equal(list[2].emoji, '☕');
  });

  it('leaves out what has no date, and notes with nothing but the tag', () => {
    assert.deepEqual(activitiesOf({ statuses: [{ text: 'x', at: 'soon', state: 'busy' }], notes: [{ text: '#note', url: 'u', createdAt: '2026-11-26T18:00:00Z' }] }), []);
  });

  it('cuts a long note to one line', () => {
    assert.equal(noteLine('one\ntwo  #Note three'), 'one two three');
    assert.equal([...noteLine('x'.repeat(200))].length, 140);
  });

  it('orders an event by when it starts where it happens', () => {
    assert.equal(new Date(eventInstant({ startsOn: '2026-11-26', startTime: '15:00', timeZone: 'Europe/Paris' })).toISOString(), '2026-11-26T14:00:00.000Z');
    assert.equal(eventInstant({ startsOn: '2026-11-26', timeZone: 'Asia/Bangkok' }), undefined);
    assert.equal(zoneLabel('Asia/Bangkok', '2026-11-26'), '');
    assert.equal(zoneLabel('Europe/Paris', '2026-11-26'), 'CET');
  });
});
