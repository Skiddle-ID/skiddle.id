// The top-of-the-week music card (src/lib/music-week-card.ts): a valid SVG with the week's plays,
// the top artists and tracks ranked with their counts, names fitted to their column in any script,
// and a card that points to /listening/ when the week is empty or the plays can't be read.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import { renderMusicWeekCard } from '../src/lib/music-week-card.ts';
import { textColumns } from '../src/lib/embed-card.ts';

const week = {
  plays: 42,
  artists: [
    { name: 'Hindia', count: 12 },
    { name: 'Phum Viphurit', count: 8 },
    { name: 'NewJeans', count: 5 },
  ],
  tracks: [
    { name: 'Evaluasi', artist: 'Hindia', count: 6 },
    { name: 'Lover Boy', artist: 'Phum Viphurit', count: 4 },
    { name: 'Ditto', artist: 'NewJeans', count: 3 },
  ],
};

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
/** The text nodes inside a <text> element, around its <tspan>s, joined */
const textNodes = (inner) => [...`>${inner}<`.matchAll(/>([^<]*)</g)].map((m) => m[1]).join('');
/** The text of each <text> element with `cls`, unescaped */
const texts = (svg, cls) => [...svg.matchAll(new RegExp(`<text [^>]*class="${cls}"[^>]*>(.*?)</text>`, 'g'))].map((m) => unescape(textNodes(m[1])));
/** The ranked rows of a column ("1 Hindia"), left to right, and their counts */
const rows = (svg) => texts(svg, 's');
const counts = (svg) => texts(svg, 's mute');
const summary = (svg) => texts(svg, 'k')[0];
const body = (svg) => [...texts(svg, 'b fg'), ...texts(svg, 's mute')];

/** Parses the SVG as XML (resvg's parser is strict) and fails the test if it isn't valid */
const parse = (svg) => assert.doesNotThrow(() => new Resvg(svg), svg);

// A row and its one-digit count (a space apart) fit the column: 196px (artists) or 288px (tracks)
// wide, where a column of 12.5px monospace is ~7.6px
const ARTIST_COLS = 196 / (12.5 * 0.61);
const TRACK_COLS = 288 / (12.5 * 0.61);

describe('renderMusicWeekCard', () => {
  it('shows the plays, then the top artists and tracks ranked with their counts', () => {
    const svg = renderMusicWeekCard(week);
    parse(svg);
    assert.equal(summary(svg), '42 plays this week');
    assert.deepEqual(rows(svg), [
      '1 Hindia',
      '2 Phum Viphurit',
      '3 NewJeans',
      '1 Evaluasi · Hindia',
      '2 Lover Boy · Phum Viphurit',
      '3 Ditto · NewJeans',
    ]);
    assert.deepEqual(counts(svg), ['12', '8', '5', '6', '4', '3']);
    assert.deepEqual(texts(svg, 'k mute'), ['last 7 days', 'top artists', 'plays', 'top tracks', 'plays']);
    assert.match(svg, /teal top --week/);
  });

  it('says "1 play"', () => {
    const svg = renderMusicWeekCard({ plays: 1, artists: [{ name: 'Hindia', count: 1 }], tracks: [{ name: 'Evaluasi', artist: 'Hindia', count: 1 }] });
    parse(svg);
    assert.equal(summary(svg), '1 play this week');
    assert.deepEqual(rows(svg), ['1 Hindia', '1 Evaluasi · Hindia']);
    assert.match(svg, /<title [^>]*>[^<]*Evaluasi by Hindia \(1 play\)/);
  });

  it('fits long names in their column, ending them with an ellipsis', () => {
    const long = 'The Longest Artist Name Anyone Has Ever Put On A Record';
    const svg = renderMusicWeekCard({ plays: 3, artists: [{ name: long, count: 3 }], tracks: [{ name: `${long}, Part Two (Extended Mix)`, artist: long, count: 3 }] });
    parse(svg);
    const [artist, track] = rows(svg);
    assert.match(artist, /^1 The Longest .*…$/);
    assert.match(track, /^1 The Longest .*… · The Longest.*…$/);
    assert.ok(textColumns(artist) + 2 <= ARTIST_COLS, artist);
    assert.ok(textColumns(track) + 2 <= TRACK_COLS, track);
  });

  it('fits CJK and Thai names in their column', () => {
    const svg = renderMusicWeekCard({
      plays: 9,
      artists: [{ name: '宇多田ヒカル宇多田ヒカル宇多田ヒカル', count: 5 }, { name: 'ภูมิ วิภูริศ ศิริทิพย์ ภูมิ วิภูริศ', count: 4 }],
      tracks: [{ name: '初恋初恋初恋初恋初恋初恋初恋初恋初恋初恋', artist: '宇多田ヒカル', count: 5 }],
    });
    parse(svg);
    const [cjk, thai, track] = rows(svg);
    for (const row of [cjk, thai]) assert.ok(textColumns(row) + 2 <= ARTIST_COLS, row);
    assert.ok(textColumns(track) + 2 <= TRACK_COLS, track);
    assert.match(cjk, /…$/);
    assert.match(track, /^1 初恋.*… · 宇多田ヒカル$/);
  });

  it('escapes names with <, & and >', () => {
    const svg = renderMusicWeekCard({ plays: 2, artists: [{ name: 'Simon & <Garfunkel>', count: 2 }], tracks: [{ name: 'A < B', artist: '"Q" & \'R\'', count: 2 }] });
    parse(svg);
    assert.deepEqual(rows(svg), ['1 Simon & <Garfunkel>', '1 A < B · "Q" & \'R\'']);
  });

  it('with an empty week, says so and points to /listening/', () => {
    const svg = renderMusicWeekCard({ plays: 0, artists: [], tracks: [] });
    parse(svg);
    assert.equal(summary(svg), '0 plays this week');
    assert.deepEqual(body(svg), ['Nothing played this week', 'Older plays are at skiddle.id/listening/']);
    assert.doesNotMatch(svg, /top artists/);
  });

  it('when the plays can\'t be read, says so and points to /listening/', () => {
    const svg = renderMusicWeekCard(null);
    parse(svg);
    assert.equal(summary(svg), 'offline');
    assert.deepEqual(body(svg), ['No plays to show right now', 'See them at skiddle.id/listening/']);
  });

  it('takes a theme and an accent', () => {
    const svg = renderMusicWeekCard(week, { theme: 'light', accent: 'teal' });
    parse(svg);
    assert.match(svg, /--bg:#ffffff/);
    assert.match(svg, /--acc:#007d79/);
    assert.doesNotMatch(svg, /prefers-color-scheme/);
  });
it('keeps two versions of a song apart when their titles differ only at the end', () => {
    const svg = renderMusicWeekCard({
      plays: 20,
      artists: [{ name: 'LBI', count: 16 }],
      tracks: [
        { name: 'Jumping Machine (跳楼机)', artist: 'LBI & WUKONG', count: 10 },
        { name: 'Jumping Machine (跳楼机) (伴奏)', artist: 'LBI & WUKONG', count: 6 },
      ],
    });
    parse(svg);
    const versions = rows(svg).filter((r) => r.includes('Jumping Machine'));
    assert.equal(versions.length, 2, rows(svg).join(' | '));
    assert.notEqual(versions[0], versions[1]);
    assert.ok(versions[1].includes('(伴奏)'), versions[1]);
  });
});
