import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { Lexicons, jsonToLex } from '@atproto/lexicon';
import { DEFAULT_SITE_THEME, siteThemeOf } from '../src/lib/site-theme.mjs';
import { DESIGN_FIELDS, THEME_PRESET_COLLECTION, TODAYS_LOOK, designOf, presetFile, presetFromFile, presetKey, withDesign } from '../src/lib/theme-presets.mjs';

const ROOT = join(import.meta.dirname, '..');
const lexicon = (name) => JSON.parse(readFileSync(join(ROOT, `lexicons/id/skiddle/${name}.json`), 'utf8'));
const lex = () => new Lexicons([lexicon('theme'), lexicon('themePreset')]);
const AT = '2026-11-28T12:00:00.000Z';
const read = (file) => presetFromFile(typeof file === 'string' ? file : JSON.stringify(file), lex(), jsonToLex, AT);

/** A theme with every field set, nothing like today's */
const fullTheme = {
  $type: 'id.skiddle.theme',
  mode: 'light',
  accent: 'pink',
  cardDesign: 'logo',
  colors: { dark: { bg: { r: 0, g: 0, b: 0 }, text: { r: 250, g: 250, b: 250 } }, light: { muted: { r: 60, g: 60, b: 60 } } },
  fonts: { heading: 'inter', text: 'ibm-plex-sans', post: 'source-serif-4', code: 'jetbrains-mono' },
  textSize: 'large',
  textLineHeight: 'tight',
  postLineHeight: 'loose',
  radius: 'none',
  spacing: 'roomy',
  noPrompt: true,
  noCursor: true,
  noHeadingMarks: true,
  updatedAt: '2026-11-28T00:00:00.000Z',
};
const design = designOf(fullTheme);

describe('the preset lexicon', () => {
  it('holds the theme’s design fields, by the theme’s own rules, and a name and dates', () => {
    const theme = lexicon('theme').defs.main.record.properties;
    const preset = lexicon('themePreset').defs.main.record.properties;
    assert.deepEqual(Object.keys(preset), ['name', ...DESIGN_FIELDS, 'createdAt', 'updatedAt']);
    assert.deepEqual(
      Object.keys(theme).filter((k) => !['mode', 'accent', 'cardDesign', 'updatedAt'].includes(k)),
      DESIGN_FIELDS,
    );
    for (const k of DESIGN_FIELDS) {
      // A def the theme refers to is the theme's, by reference; any other field is the same as the theme's
      const ours = preset[k].type === 'ref' ? { ...preset[k], ref: preset[k].ref.replace('id.skiddle.theme', '') } : preset[k];
      assert.deepEqual(ours, theme[k], k);
    }
    assert.equal(preset.colors.ref, 'id.skiddle.theme#colors');
  });
});

describe('a preset file', () => {
  it('is read into a preset’s record: its design and name, created now, valid by the lexicon', () => {
    const result = read({ $type: THEME_PRESET_COLLECTION, name: ' Warm ', ...design, createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2021-01-01T00:00:00.000Z' });
    assert.deepEqual(result, { record: { $type: THEME_PRESET_COLLECTION, name: 'Warm', ...design, createdAt: AT } });
  });

  it('is what Export writes, so an exported preset imports as it was', () => {
    const record = { $type: THEME_PRESET_COLLECTION, name: 'Warm', ...design, createdAt: '2026-11-01T00:00:00.000Z' };
    assert.deepEqual(read(presetFile(record)), { record: { ...record, createdAt: AT } });
    assert.deepEqual(read(presetFile({ name: TODAYS_LOOK.name, ...TODAYS_LOOK.design, createdAt: AT })), { record: { $type: THEME_PRESET_COLLECTION, name: 'Today’s look', createdAt: AT } });
  });

  it('is refused when a colour isn’t three numbers from 0 to 255, so no CSS gets in', () => {
    for (const bg of [{ r: 300, g: 0, b: 0 }, '#000', 'red; background: url(//evil.example)', { r: '0', g: 0, b: 0 }, { r: 0, g: 0 }]) {
      const result = read({ name: 'Bad', colors: { dark: { bg } } });
      assert.ok('problem' in result, JSON.stringify(bg));
      assert.match(result.problem, /doesn’t fit the lexicon: colors\/dark\/bg/);
    }
  });

  it('is refused when it has a field a preset can’t have, at the top or inside', () => {
    assert.deepEqual(read({ name: 'X', css: 'body{}' }), { problem: 'The preset has fields or values a preset can’t have: css.' });
    assert.deepEqual(read({ name: 'X', mode: 'dark', colors: { dark: { bg: { r: 0, g: 0, b: 0, a: 1 }, glow: { r: 1, g: 1, b: 1 } } } }), {
      problem: 'The preset has fields or values a preset can’t have: mode, colors.dark.bg.a, colors.dark.glow.',
    });
  });

  it('is refused when a field is named like one every object inherits, so nothing rides along unchecked', () => {
    for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const result = read(`{"name": "X", "colors": {"dark": {"${k}": "</style><script>alert(1)</script>"}}}`);
      assert.deepEqual(result, { problem: `The preset has fields or values a preset can’t have: colors.dark.${k}.` }, k);
      assert.deepEqual(read(`{"name": "X", "${k}": 1}`), { problem: `The preset has fields or values a preset can’t have: ${k}.` }, k);
    }
  });

  it('is refused when a font or a size is one the site doesn’t have, instead of quietly keeping today’s', () => {
    assert.deepEqual(read({ name: 'X', fonts: { text: 'comic-sans' }, textSize: 'huge' }), {
      problem: 'The preset has fields or values a preset can’t have: fonts.text (comic-sans), textSize (huge).',
    });
    assert.ok('record' in read({ name: 'X', fonts: { text: 'inter' }, textSize: 'large' }));
  });

  it('is refused when it isn’t JSON, isn’t an object, is another record, or has no name', () => {
    assert.match(read('{"name": "Warm",').problem, /isn’t JSON/);
    assert.match(read('not json at all').problem, /isn’t JSON/);
    assert.match(read('[1, 2]').problem, /isn’t a theme preset/);
    assert.match(read('null').problem, /isn’t a theme preset/);
    assert.match(read({ $type: 'id.skiddle.theme', name: 'X' }).problem, /another kind of record \(id\.skiddle\.theme\), not a theme preset/);
    assert.match(read({ ...design }).problem, /no name/);
    assert.match(read({ name: 'x'.repeat(65) }).problem, /name/);
  });
});

describe('applying a preset', () => {
  it('replaces the theme’s whole design and keeps its mode, accent, cards’ design and unknown fields', () => {
    const applied = withDesign({ ...fullTheme, futureField: 1 }, { textSize: 'small', name: 'not design' });
    assert.deepEqual(applied, { $type: 'id.skiddle.theme', mode: 'light', accent: 'pink', cardDesign: 'logo', updatedAt: fullTheme.updatedAt, futureField: 1, textSize: 'small' });
  });

  it('with Today’s look is Reset: today’s design, with the theme’s mode and accent', () => {
    const reset = withDesign(fullTheme, TODAYS_LOOK.design);
    assert.deepEqual(siteThemeOf(reset), { ...DEFAULT_SITE_THEME, mode: 'light', accent: 'pink' });
    assert.equal(reset.cardDesign, 'logo');
    assert.notDeepEqual(siteThemeOf(fullTheme), siteThemeOf(reset));
  });
});

describe('a preset’s key', () => {
  it('comes from its name, and gets a number when it’s taken', () => {
    assert.equal(presetKey('Today’s look, warmer!', []), 'today-s-look-warmer');
    assert.equal(presetKey('Warm', ['warm', 'warm-2']), 'warm-3');
    assert.equal(presetKey('🌙', []), 'preset');
    assert.ok(presetKey('a'.repeat(64) + ' b', []).length <= 64);
    assert.match(presetKey('Crème brûlée', []), /^[a-z0-9-]+$/);
  });
});
