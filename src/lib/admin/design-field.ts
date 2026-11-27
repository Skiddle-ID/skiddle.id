/**
 * The Theme editor's card design (src/lib/admin/page-editor.ts, id.skiddle.theme): each design the
 * site has (src/lib/card-theme.mjs) as a choice with a preview, a sample post's card drawn in it with
 * the publication's logo, as the admin app and the build would draw it (src/lib/admin/card.ts, loaded
 * when the editor opens: about 3 MB). The previews are drawn on canvases.
 */
import { CARD_DESIGNS, cardDesignOf } from '~/lib/card-theme.mjs';
import { ACCENTS, DEFAULT_COLORS, type Accent } from '~/lib/site-theme.mjs';
import type { Field } from './lexicon-form';
import { errorText } from './dom';

const PREVIEW_W = 360;
const PREVIEW_H = 189;

export function designField(onChange: () => void) {
  return (initial: unknown): Field => {
    let design: string = cardDesignOf({ cardDesign: initial });
    const wrap = document.createElement('fieldset');
    wrap.className = 'admin-field admin-designs';
    const legend = document.createElement('legend');
    legend.className = 'admin-label-row';
    legend.textContent = 'Share cards';
    wrap.appendChild(legend);
    const help = document.createElement('p');
    help.className = 'admin-small';
    help.textContent =
      'The picture link previews show for a page. New cards use the design you save. To redraw the posts’ and series’ cards you already have, use Check share cards in Lexicons and cards; the pages’ cards change on the next deploy.';
    wrap.appendChild(help);
    const grid = document.createElement('div');
    grid.className = 'admin-design-grid';
    const status = document.createElement('p');
    status.className = 'admin-small';
    status.setAttribute('role', 'status');

    const canvases = new Map<string, HTMLCanvasElement>();
    for (const d of CARD_DESIGNS) {
      const option = document.createElement('label');
      option.className = 'admin-design';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'cardDesign';
      radio.value = d.id;
      radio.checked = d.id === design;
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        design = d.id;
        onChange();
      });
      const canvas = document.createElement('canvas');
      canvas.width = PREVIEW_W;
      canvas.height = PREVIEW_H;
      canvas.setAttribute('aria-hidden', 'true');
      canvases.set(d.id, canvas);
      const text = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = d.label;
      const desc = document.createElement('span');
      desc.className = 'admin-muted';
      desc.textContent = ` ${d.description}`;
      text.appendChild(name);
      text.appendChild(desc);
      const head = document.createElement('span');
      head.className = 'admin-design-head';
      head.appendChild(radio);
      head.appendChild(text);
      option.appendChild(canvas);
      option.appendChild(head);
      grid.appendChild(option);
    }
    wrap.appendChild(grid);
    wrap.appendChild(status);

    // Drawn one after another: each takes a moment, and they share the fonts
    void (async () => {
      status.textContent = 'Drawing the previews…';
      try {
        const { drawSampleCard } = await import('./card');
        for (const d of CARD_DESIGNS) {
          const bitmap = await createImageBitmap(await drawSampleCard(d.id));
          canvases.get(d.id)?.getContext('2d')?.drawImage(bitmap, 0, 0, PREVIEW_W, PREVIEW_H);
          bitmap.close();
        }
        status.textContent = '';
      } catch (err) {
        status.textContent = `Couldn’t draw the previews: ${errorText(err)}`;
      }
    })();

    return { el: wrap, read: () => design };
  };
}

/** An option of a choiceField: its value, label and, for a colour, its swatch's dark and light colours */
interface Choice {
  value: string;
  label: string;
  swatch?: [string, string];
}

/**
 * A row of choices (radio buttons) for one of the theme's fields: its mode, or its accent, whose
 * choices show the colour. The record keeps the value the site doesn't know as is, if it has one.
 */
export function choiceField(name: string, legendText: string, help: string, choices: Choice[], fallback: string, onChange: () => void) {
  return (initial: unknown): Field => {
    let value = typeof initial === 'string' && initial ? initial : fallback;
    const wrap = document.createElement('fieldset');
    wrap.className = 'admin-field admin-designs';
    const legend = document.createElement('legend');
    legend.className = 'admin-label-row';
    legend.textContent = legendText;
    wrap.appendChild(legend);
    const row = document.createElement('div');
    row.className = 'admin-choice-row';
    for (const c of choices) {
      const option = document.createElement('label');
      option.className = 'admin-choice';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = name;
      radio.value = c.value;
      radio.checked = c.value === value;
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        value = c.value;
        onChange();
      });
      option.appendChild(radio);
      if (c.swatch) {
        const sw = document.createElement('span');
        sw.className = 'admin-swatch';
        sw.style.setProperty('--swatch-dark', c.swatch[0]);
        sw.style.setProperty('--swatch-light', c.swatch[1]);
        option.appendChild(sw);
      }
      option.appendChild(document.createTextNode(c.label));
      row.appendChild(option);
    }
    wrap.appendChild(row);
    const p = document.createElement('p');
    p.className = 'admin-small';
    p.textContent = help;
    wrap.appendChild(p);
    return { el: wrap, read: () => value };
  };
}

/** The accents' colours, dark then light, as src/style.css has them */
export const ACCENT_COLOURS = Object.fromEntries(ACCENTS.map((a) => [a, [DEFAULT_COLORS.dark[a], DEFAULT_COLORS.light[a]]])) as Record<Accent, [string, string]>;
