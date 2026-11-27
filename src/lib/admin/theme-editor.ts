/**
 * The Theme editor's design fields (src/lib/admin/page-editor.ts, id.skiddle.theme, src/lib/site-theme.mjs):
 *   - the colours, a picker for each in dark and in light, marked when a text colour falls under
 *     WCAG AA against its background (themeProblems blocks Save then)
 *   - the fonts, each picked from the site's catalogue
 *   - the text size, the line heights, the corners and the spacing, as rows of choices
 *   - the terminal touches, each a switch that hides one
 * and a preview of a sample page in dark and light that follows the form as it's edited, with a
 * button that goes back to today's look. Each field writes only what differs from today's look.
 */
import {
  ACCENTS,
  COLORS,
  DECORATIONS,
  DEFAULT_COLORS,
  DEFAULT_SITE_THEME,
  FONTS,
  FONT_SLOTS,
  LINE_HEIGHTS,
  RADII,
  SCHEMES,
  SPACINGS,
  TEXT_SIZES,
  contrastProblems,
  fontOf,
  rgbOf,
  rowOf,
  siteThemeOf,
  type ColorName,
  type Scheme,
  type SiteTheme,
} from '~/lib/site-theme.mjs';
import type { Field } from './lexicon-form';
import { choiceField } from './design-field';

type Value = Record<string, unknown>;

const SCHEME_LABEL: Record<Scheme, string> = { dark: 'Dark', light: 'Light' };
const colorLabel = (id: ColorName) => COLORS.find((c) => c.id === id)?.label ?? id;

/** What's wrong with a theme the form holds: its text colours under WCAG AA, in words */
export function themeProblems(value: Value): string[] {
  return contrastProblems(siteThemeOf(value)).map(
    (p) => `${SCHEME_LABEL[p.scheme]}: ${colorLabel(p.fg).toLowerCase()} on ${colorLabel(p.bg).toLowerCase()} is ${p.ratio.toFixed(2)}:1; text needs at least ${p.needs}:1.`,
  );
}

/** A heading and a line of help for a group of fields */
function group(legendText: string, help: string) {
  const wrap = document.createElement('fieldset');
  wrap.className = 'admin-field admin-designs';
  const legend = document.createElement('legend');
  legend.className = 'admin-label-row';
  legend.textContent = legendText;
  wrap.appendChild(legend);
  const p = document.createElement('p');
  p.className = 'admin-small';
  p.textContent = help;
  wrap.appendChild(p);
  return wrap;
}

/** The colours: a picker for each, in dark and in light; the record gets only those that differ from today's */
function colorsField(initial: unknown): Field {
  const start = siteThemeOf({ colors: initial }).colors;
  const wrap = group('Colours', 'Each mode’s colours. A text colour that’s hard to read on its background is marked, and the theme can’t be saved until it’s fixed.');
  const table = document.createElement('table');
  table.className = 'admin-colors';
  const head = table.createTHead().insertRow();
  for (const text of ['', ...SCHEMES.map((s) => SCHEME_LABEL[s])]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    head.appendChild(th);
  }
  const inputs: { scheme: Scheme; id: ColorName; input: HTMLInputElement }[] = [];
  const body = table.createTBody();
  for (const { id, label } of COLORS) {
    const row = body.insertRow();
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    row.appendChild(th);
    for (const scheme of SCHEMES) {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = start[scheme][id];
      input.setAttribute('aria-label', `${SCHEME_LABEL[scheme]}: ${label}`);
      inputs.push({ scheme, id, input });
      row.insertCell().appendChild(input);
    }
  }
  wrap.appendChild(table);
  const read = () => {
    const colors: Value = {};
    for (const scheme of SCHEMES) {
      const changed = Object.fromEntries(
        inputs.filter((x) => x.scheme === scheme && x.input.value !== DEFAULT_COLORS[scheme][x.id]).map((x) => [x.id, rgbOf(x.input.value)]),
      );
      if (Object.keys(changed).length) colors[scheme] = changed;
    }
    return colors;
  };
  // Marks the colours of each pair under WCAG AA
  const mark = () => {
    const bad = new Set(contrastProblems(siteThemeOf({ colors: read() })).flatMap((p) => [`${p.scheme}.${p.fg}`, `${p.scheme}.${p.bg}`]));
    for (const { scheme, id, input } of inputs) input.setAttribute('aria-invalid', String(bad.has(`${scheme}.${id}`)));
  };
  wrap.addEventListener('input', mark);
  mark();
  return { el: wrap, read };
}

/** The fonts: a list of the catalogue's for each place; the record gets only those that differ from today's */
function fontsField(initial: unknown): Field {
  const start = siteThemeOf({ fonts: initial }).fonts;
  const wrap = group('Fonts', 'Bundled with the site, so visitors download only the fonts the theme uses.');
  const selects = FONT_SLOTS.map(({ id, label }) => {
    const field = document.createElement('label');
    field.className = 'admin-field';
    field.appendChild(document.createTextNode(label));
    const select = document.createElement('select');
    for (const f of FONTS) select.add(new Option(f.id === DEFAULT_SITE_THEME.fonts[id] ? `${f.label} (today’s)` : f.label, f.id, false, f.id === start[id]));
    field.appendChild(select);
    wrap.appendChild(field);
    return [id, select] as const;
  });
  return {
    el: wrap,
    read: () => Object.fromEntries(selects.filter(([id, s]) => s.value !== DEFAULT_SITE_THEME.fonts[id]).map(([id, s]) => [id, s.value])),
  };
}

/** A switch for one of the terminal touches: ticked hides it, unticked leaves it out of the record */
function switchField(label: string, help: string) {
  return (initial: unknown): Field => {
    const wrap = document.createElement('div');
    wrap.className = 'admin-field';
    const check = document.createElement('label');
    check.className = 'admin-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = initial === true;
    check.appendChild(input);
    check.appendChild(document.createTextNode(` ${label}`));
    const p = document.createElement('p');
    p.className = 'admin-small';
    p.textContent = help;
    wrap.appendChild(check);
    wrap.appendChild(p);
    return { el: wrap, read: () => (input.checked ? true : undefined) };
  };
}

/** The Theme editor's design fields, by property */
export function designFields(onChange: () => void): Record<string, (value: unknown) => Field> {
  const choices = (name: keyof SiteTheme, legend: string, help: string, table: readonly { id: string; label: string }[]) =>
    choiceField(name, legend, help, table.map((r) => ({ value: r.id, label: r.label })), String(DEFAULT_SITE_THEME[name]), onChange);
  return {
    colors: colorsField,
    fonts: fontsField,
    textSize: choices('textSize', 'Text size', 'Every size and the spacing follow it. Normal is today’s.', TEXT_SIZES),
    textLineHeight: choices('textLineHeight', 'Line height', 'For the site’s text. Normal is today’s.', LINE_HEIGHTS),
    postLineHeight: choices('postLineHeight', 'Line height in posts', 'For a post’s text. Normal is today’s.', LINE_HEIGHTS),
    radius: choices('radius', 'Corners', 'Of cards, buttons and images. Small is today’s.', RADII),
    spacing: choices('spacing', 'Spacing', 'Around and between things. Normal is today’s.', SPACINGS),
    ...Object.fromEntries(DECORATIONS.map((d) => [d.id, switchField(d.label, d.help)])),
  };
}

/** The fields Reset keeps: the mode, the accent and the cards' design, which aren't the page's design */
export const KEPT_ON_RESET = ['mode', 'accent', 'cardDesign'];

/**
 * A sample page in dark and in light, drawn with the theme the form holds
 * @param onReset Goes back to today's look
 */
export function themePreview(onReset: () => void) {
  const wrap = document.createElement('section');
  wrap.className = 'admin-theme-preview';
  wrap.setAttribute('aria-label', 'Preview');
  const bar = document.createElement('div');
  bar.className = 'admin-label-row';
  const title = document.createElement('h3');
  title.textContent = 'Preview';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'admin-btn admin-btn-ghost';
  reset.textContent = 'Reset to today’s look';
  reset.addEventListener('click', onReset);
  bar.appendChild(title);
  bar.appendChild(reset);
  const help = document.createElement('p');
  help.className = 'admin-small';
  help.textContent = 'A sample page with the theme as it is in the form, before it’s saved. The accent is the default one.';
  wrap.appendChild(bar);
  wrap.appendChild(help);

  const panes = SCHEMES.map((scheme) => {
    const pane = document.createElement('div');
    pane.className = 'tp';
    pane.setAttribute('role', 'img');
    pane.setAttribute('aria-label', `The sample page in ${scheme}`);
    pane.innerHTML = `
      <p class="tp-label">${SCHEME_LABEL[scheme]}</p>
      <p class="tp-prompt"><span class="tp-accent">skiddle@web</span>:~$ cat sample.md</p>
      <h4 class="tp-heading"><span class="tp-mark">## </span>A heading</h4>
      <p class="tp-text">The site’s text, with <span class="tp-link">a link</span> and <span class="tp-muted">muted text</span>.</p>
      <p class="tp-post">A post’s text reads like this, a little larger, for long reading.</p>
      <div class="tp-card"><code class="tp-code">npm run build</code> in a card</div>
      <p class="tp-accents">${ACCENTS.map((a) => `<span data-accent="${a}">${a}</span>`).join(' ')}</p>
      <p class="tp-brand">skiddle@web ~<span class="tp-cursor"></span></p>`;
    wrap.appendChild(pane);
    return [scheme, pane] as const;
  });

  /** Draws the theme the form holds */
  const update = (value: Value) => {
    const theme = siteThemeOf(value);
    const scale = rowOf(TEXT_SIZES, theme.textSize).scale;
    const radius = rowOf(RADII, theme.radius).sizes;
    const vars: Record<string, string> = {
      '--tp-font-heading': fontOf(theme.fonts.heading).stack,
      '--tp-font-text': fontOf(theme.fonts.text).stack,
      '--tp-font-post': fontOf(theme.fonts.post).stack,
      '--tp-font-code': fontOf(theme.fonts.code).stack,
      '--tp-size': `${(15 * scale).toFixed(2)}px`,
      '--tp-leading': rowOf(LINE_HEIGHTS, theme.textLineHeight).text,
      '--tp-leading-post': rowOf(LINE_HEIGHTS, theme.postLineHeight).post,
      '--tp-radius': radius.md,
      '--tp-radius-sm': radius.sm,
      '--tp-space': rowOf(SPACINGS, theme.spacing).unit,
    };
    for (const [scheme, pane] of panes) {
      const p = theme.colors[scheme];
      Object.entries({
        ...vars,
        '--tp-bg': p.bg,
        '--tp-bg-alt': p.bgAlt,
        '--tp-border': p.border,
        '--tp-text': p.text,
        '--tp-muted': p.muted,
        '--tp-primary': p[theme.accent],
        ...Object.fromEntries(ACCENTS.map((a) => [`--tp-${a}`, p[a]])),
      }).forEach(([k, v]) => pane.style.setProperty(k, v));
      for (const d of DECORATIONS) pane.toggleAttribute(d.attr, theme[d.id]);
    }
  };
  return { el: wrap, update };
}
