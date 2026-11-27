/**
 * The Theme editor's card design (src/lib/admin/page-editor.ts, id.skiddle.theme): each design the
 * site has (src/lib/card-theme.mjs) as a choice with a preview, a sample post's card drawn in it with
 * the publication's logo, as the admin app and the build would draw it (src/lib/admin/card.ts, loaded
 * when the editor opens: about 3 MB). The previews are drawn on canvases.
 */
import { CARD_DESIGNS, cardDesignOf } from '~/lib/card-theme.mjs';
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
