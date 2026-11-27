import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { Lexicons, jsonToLex } from '@atproto/lexicon';
import {
  DEFAULT_SITE_THEME,
  FONTS,
  cardColors,
  contrastProblems,
  contrastRatio,
  decorationAttributes,
  fontOf,
  fontsToPreload,
  siteThemeOf,
  themeCss,
} from '../src/lib/site-theme.mjs';

const ROOT = join(import.meta.dirname, '..');

describe('site theme', () => {
  it('takes the mode and accent the record asks for, field by field', () => {
    assert.equal(siteThemeOf({ mode: 'light', accent: 'purple' }).mode, 'light');
    assert.equal(siteThemeOf({ mode: 'light', accent: 'purple' }).accent, 'purple');
    assert.equal(siteThemeOf({ mode: 'sepia', accent: 'green' }).mode, 'device');
    assert.equal(siteThemeOf({ mode: 'sepia', accent: 'green' }).accent, 'green');
  });

  it('is today’s look for an empty record, no record, or a record of another shape', () => {
    for (const record of [{}, null, undefined, { cardDesign: 'logo' }, 'dark', [1, 2]]) assert.deepEqual(siteThemeOf(record), DEFAULT_SITE_THEME);
  });

  it('keeps a colour given as three whole numbers from 0 to 255, as #rrggbb', () => {
    const theme = siteThemeOf({ colors: { dark: { bg: { r: 0, g: 16, b: 255 } }, light: { muted: { r: 82, g: 82, b: 82 } } } });
    assert.equal(theme.colors.dark.bg, '#0010ff');
    assert.equal(theme.colors.light.muted, '#525252');
    assert.equal(theme.colors.dark.text, '#f2f4f8');
  });

  it('falls back to today’s colour for one that isn’t three whole numbers from 0 to 255', () => {
    const bad = [{ r: 256, g: 0, b: 0 }, { r: -1, g: 0, b: 0 }, { r: 1.5, g: 0, b: 0 }, { r: '1', g: 0, b: 0 }, { r: 0, g: 0 }, '#000000', null, [0, 0, 0]];
    for (const bg of bad) assert.equal(siteThemeOf({ colors: { dark: { bg } } }).colors.dark.bg, '#161616', JSON.stringify(bg));
  });

  it('falls back per field for fonts, sizes, shape and switches the site doesn’t know', () => {
    const theme = siteThemeOf({
      fonts: { heading: 'inter', text: 'comic-sans', post: 42 },
      textSize: 'huge',
      textLineHeight: 'loose',
      radius: 'round',
      spacing: 'cosy',
      noPrompt: 'yes',
      noCursor: true,
    });
    assert.deepEqual(theme.fonts, { heading: 'inter', text: 'geist-mono', post: 'geist', code: 'geist-mono' });
    assert.equal(theme.textSize, 'normal');
    assert.equal(theme.textLineHeight, 'loose');
    assert.equal(theme.radius, 'round');
    assert.equal(theme.spacing, 'normal');
    assert.equal(theme.noPrompt, false);
    assert.equal(theme.noCursor, true);
  });
});

describe('the theme’s CSS', () => {
  it('is empty for today’s look, however the record spells it', () => {
    assert.equal(themeCss(siteThemeOf({})), '');
    const spelledOut = {
      colors: { dark: { bg: { r: 22, g: 22, b: 22 } }, light: { bg: { r: 255, g: 255, b: 255 } } },
      fonts: { heading: 'geist-mono', text: 'geist-mono', post: 'geist', code: 'geist-mono' },
      textSize: 'normal',
      textLineHeight: 'normal',
      postLineHeight: 'normal',
      radius: 'small',
      spacing: 'normal',
      noPrompt: false,
    };
    assert.equal(themeCss(siteThemeOf(spelledOut)), '');
  });

  it('sets the variable of each thing the theme changes, and only those', () => {
    const css = themeCss(siteThemeOf({ colors: { light: { blue: { r: 0, g: 0, b: 128 } } }, fonts: { post: 'source-serif-4' }, radius: 'none', spacing: 'roomy' }));
    assert.match(css, /^:root\{[^{}]*\}$/);
    assert.match(css, /--theme-light-blue:#000080/);
    assert.match(css, /--theme-font-post:'Source Serif 4', ui-serif/);
    assert.match(css, /--radius-md:0[;}]/);
    assert.match(css, /--spacing:0\.3rem/);
    assert.doesNotMatch(css, /--theme-dark-|--theme-font-text|--theme-text-scale|--theme-leading/);
  });

  it('carries nothing from the record’s text into the page', () => {
    const css = themeCss(
      siteThemeOf({
        colors: { dark: { bg: { r: '0;}body{display:none}', g: 0, b: 0 }, text: { r: 1, g: 2, b: 3, x: '}' } } },
        fonts: { text: "x'}body{display:none}" },
        textSize: '1;}',
        radius: '</style><script>',
      }),
    );
    assert.equal(css, ':root{--theme-dark-text:#010203}');
  });

  it('turns the switches into attributes on <html>, none for today’s look', () => {
    assert.deepEqual(decorationAttributes(siteThemeOf({})), {});
    assert.deepEqual(decorationAttributes(siteThemeOf({ noPrompt: true, noHeadingMarks: true })), { 'data-no-prompt': '', 'data-no-heading-marks': '' });
  });
});

describe('contrast', () => {
  it('measures the WCAG ratio', () => {
    assert.equal(contrastRatio('#000000', '#ffffff'), 21);
    assert.equal(contrastRatio('#ffffff', '#000000'), 21);
    assert.equal(contrastRatio('#777777', '#777777'), 1);
    // #767676 on white is the classic lightest grey that passes AA
    assert.ok(contrastRatio('#767676', '#ffffff') >= 4.5);
    assert.ok(contrastRatio('#777777', '#ffffff') < 4.5);
  });

  it('finds no problem in today’s colours', () => {
    assert.deepEqual(contrastProblems(siteThemeOf({})), []);
  });

  it('finds a text colour under 4.5:1 against its backgrounds, in its own mode', () => {
    const problems = contrastProblems(siteThemeOf({ colors: { light: { muted: { r: 170, g: 170, b: 170 } } } }));
    assert.deepEqual(
      problems.map(({ scheme, fg, bg }) => `${scheme} ${fg} ${bg}`),
      ['light muted bg', 'light muted bgAlt'],
    );
    assert.ok(problems.every((p) => p.ratio < 4.5 && p.needs === 4.5));
  });

  it('finds an accent that a background change makes unreadable', () => {
    const problems = contrastProblems(siteThemeOf({ colors: { dark: { bg: { r: 130, g: 207, b: 255 } } } }));
    assert.ok(problems.some((p) => p.scheme === 'dark' && p.fg === 'blue' && p.bg === 'bg'));
  });
});

describe('fonts', () => {
  it('preloads today’s fonts for today’s look: Geist Mono, and Geist on posts', () => {
    assert.deepEqual(fontsToPreload(siteThemeOf({}), false), ['geist-mono']);
    assert.deepEqual(fontsToPreload(siteThemeOf({}), true), ['geist-mono', 'geist']);
  });

  it('preloads the text’s and the headings’ fonts, and the post text’s on posts, each once', () => {
    const theme = siteThemeOf({ fonts: { text: 'inter', heading: 'ibm-plex-mono', post: 'inter', code: 'jetbrains-mono' } });
    assert.deepEqual(fontsToPreload(theme, false), ['inter', 'ibm-plex-mono']);
    assert.deepEqual(fontsToPreload(theme, true), ['inter', 'ibm-plex-mono']);
  });

  it('bundles every font in the catalogue: the page’s woff2 and the cards’ woff', () => {
    for (const { id } of FONTS) {
      for (const file of [`${id}-latin-400-normal.woff2`, `${id}-latin-600-normal.woff2`, `${id}-latin-400-normal.woff`, `${id}-latin-700-normal.woff`]) {
        assert.ok(existsSync(join(ROOT, 'node_modules/@fontsource', id, 'files', file)), `${id}: ${file}`);
      }
    }
  });

  it('names each font in its CSS as @fontsource declares it', () => {
    for (const { id } of FONTS) {
      const css = readFileSync(join(ROOT, 'node_modules/@fontsource', id, 'latin-400.css'), 'utf8');
      assert.ok(css.includes(`font-family: '${fontOf(id).family}'`), id);
      assert.ok(fontOf(id).stack.startsWith(`'${fontOf(id).family}'`), id);
    }
  });
});

describe('share cards’ colours', () => {
  it('are today’s for today’s look', () => {
    assert.deepEqual(cardColors(siteThemeOf({})), {
      dark: { bg: '#161616', line: '#393939', fg: '#f2f4f8', mute: '#a8a8a8', accent: '#82cfff' },
      light: { bg: '#ffffff', line: '#e0e0e0', fg: '#161616', mute: '#525252', accent: '#0f62fe' },
    });
  });

  it('follow the theme’s colours and its default accent', () => {
    const colors = cardColors(siteThemeOf({ accent: 'teal', colors: { dark: { bg: { r: 0, g: 0, b: 0 } } } }));
    assert.equal(colors.dark.bg, '#000000');
    assert.equal(colors.dark.accent, '#3ddbd9');
    assert.equal(colors.light.accent, '#007d79');
  });
});

describe('the theme lexicon', () => {
  it('accepts every field the site reads, and rejects a colour out of range', () => {
    const lexicon = JSON.parse(readFileSync(join(ROOT, 'lexicons/id/skiddle/theme.json'), 'utf8'));
    const lex = new Lexicons([lexicon]);
    const record = {
      $type: 'id.skiddle.theme',
      mode: 'dark',
      accent: 'pink',
      colors: { dark: { bg: { r: 0, g: 0, b: 0 }, green: { r: 1, g: 2, b: 3 } }, light: { text: { r: 10, g: 10, b: 10 } } },
      fonts: { heading: 'inter', text: 'ibm-plex-sans', post: 'source-serif-4', code: 'jetbrains-mono' },
      textSize: 'large',
      textLineHeight: 'tight',
      postLineHeight: 'loose',
      radius: 'none',
      spacing: 'compact',
      noPrompt: true,
      noCursor: true,
      noHeadingMarks: true,
      cardDesign: 'logo',
      updatedAt: '2026-11-28T00:00:00.000Z',
    };
    lex.assertValidRecord('id.skiddle.theme', jsonToLex(record));
    const read = siteThemeOf(record);
    assert.equal(read.colors.dark.green, '#010203');
    assert.equal(read.fonts.post, 'source-serif-4');
    assert.throws(() => lex.assertValidRecord('id.skiddle.theme', jsonToLex({ ...record, colors: { dark: { bg: { r: 300, g: 0, b: 0 } } } })));
  });
});
