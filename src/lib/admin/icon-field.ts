/**
 * The site's icon, in the Site and search engines editor (src/lib/admin/page-editor.ts, id.skiddle.site):
 * pick one square image and it's drawn at the sizes pages use (32, 180, 192 and 512 px PNGs,
 * src/lib/site-meta.mjs), in the browser, since the site has no image resizing, and each is
 * uploaded. The record keeps them once it's saved; until then the PDS drops them. A non-square image
 * is cropped to its middle square. Remove goes back to the built-in icons in /public.
 *
 * Also the publication's logo (logoField), in the Publication editor.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import type { Field } from './lexicon-form';
import { errorText } from './dom';
import { SITE_COLLECTION } from '~/lib/site-meta.mjs';
import { getRecord, uploadBlob, type BlobRef } from './xrpc';

interface Icon {
  source?: BlobRef;
  png32: BlobRef;
  png180: BlobRef;
  png192: BlobRef;
  png512: BlobRef;
}

const SIZES = [32, 180, 192, 512] as const;
const MAX_SOURCE = 5_000_000;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const isIcon = (v: unknown): v is Icon => !!v && typeof v === 'object' && SIZES.every((s) => (v as Record<string, BlobRef | undefined>)[`png${s}`]?.ref?.$link);

/** A size of an image, cropped to its middle square, as a PNG */
async function drawPng(bitmap: ImageBitmap, size: number): Promise<Blob> {
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('couldn’t draw the icon'))), 'image/png'));
}

/** The field: the icon as it is, Choose an image, and Remove */
export function iconField(session: OAuthSession, onChange: () => void) {
  return (initial: unknown): Field => {
    let icon: Icon | undefined = isIcon(initial) ? initial : undefined;
    const wrap = document.createElement('div');
    wrap.className = 'admin-field';
    const label = document.createElement('div');
    label.className = 'admin-label-row';
    label.textContent = 'Icon';
    const row = document.createElement('div');
    row.className = 'admin-icon-row';
    // A canvas, so a new icon shows before it's saved (the PDS serves a blob only once a record uses it)
    const preview = document.createElement('canvas');
    preview.className = 'admin-icon-preview';
    preview.width = 128;
    preview.height = 128;
    preview.setAttribute('aria-hidden', 'true');
    const paint = (image: CanvasImageSource, w: number, h: number) => {
      const ctx = preview.getContext('2d')!;
      const side = Math.min(w, h);
      ctx.clearRect(0, 0, preview.width, preview.height);
      ctx.drawImage(image, (w - side) / 2, (h - side) / 2, side, side, 0, 0, preview.width, preview.height);
    };
    const paintUrl = (src: string) => {
      const img = new Image();
      img.onload = () => paint(img, img.naturalWidth, img.naturalHeight);
      img.src = src;
    };
    const note = document.createElement('p');
    note.className = 'admin-small';
    const pick = document.createElement('label');
    pick.className = 'admin-btn';
    pick.textContent = 'Choose an image';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = TYPES.join(',');
    input.className = 'sr-only';
    pick.appendChild(input);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-btn';
    remove.textContent = 'Use the built-in icon';
    const help = document.createElement('p');
    help.className = 'admin-small';
    help.textContent =
      'One square image, 512 px or bigger (PNG, JPEG or WebP): it’s made into the browser tab’s, phones’ home screens’ and search engines’ sizes. Browsers keep icons a while, so a new one can take time to show.';

    const show = (text = '') => {
      remove.hidden = !icon;
      note.textContent = text || (icon ? 'Your icon, from the record.' : 'The built-in icon (public/favicon.svg and the PNGs beside it).');
    };

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      if (!TYPES.includes(file.type)) return show('Pick a PNG, JPEG or WebP image.');
      if (file.size > MAX_SOURCE) return show('That image is over 5 MB.');
      pick.setAttribute('aria-disabled', 'true');
      try {
        show('Making the sizes…');
        const bitmap = await createImageBitmap(file);
        const small = Math.min(bitmap.width, bitmap.height) < 512;
        const pngs = await Promise.all(SIZES.map((s) => drawPng(bitmap, s)));
        paint(bitmap, bitmap.width, bitmap.height);
        bitmap.close();
        show('Uploading…');
        const [source, ...blobs] = await Promise.all([uploadBlob(session, file), ...pngs.map((b) => uploadBlob(session, b))]);
        icon = { source, png32: blobs[0], png180: blobs[1], png192: blobs[2], png512: blobs[3] };
        show(`Ready: save to use it.${small ? ' It’s under 512 px, so the bigger sizes will look soft.' : ''}`);
        onChange();
      } catch (err) {
        show(`Couldn’t make the icon: ${errorText(err)}`);
      } finally {
        pick.removeAttribute('aria-disabled');
      }
    });
    remove.addEventListener('click', () => {
      icon = undefined;
      paintUrl('/apple-touch-icon.png');
      show('The built-in icon: save to go back to it.');
      onChange();
    });

    row.appendChild(preview);
    row.appendChild(pick);
    row.appendChild(remove);
    wrap.appendChild(label);
    wrap.appendChild(row);
    wrap.appendChild(note);
    wrap.appendChild(help);
    // The saved icon (its 192 px size, on this site's /media/), or the built-in one
    paintUrl(icon ? `/media/${icon.png192.ref.$link}` : '/apple-touch-icon.png');
    show();
    return { el: wrap, read: () => icon };
  };
}

/** The most a publication's logo may be, as Standard.site's lexicon allows */
const MAX_LOGO = 1_000_000;

/**
 * The publication's logo (site.standard.publication's icon, in the Publication editor): one square
 * image that readers like Standard.site's apps show beside its name. Pick an image and it's cropped
 * to its middle square and drawn at 512 px as a PNG, or use the site's own icon (id.skiddle.site's
 * 512 px size, already in the repo, so nothing is uploaded).
 */
export function logoField(session: OAuthSession, onChange: () => void) {
  return (initial: unknown): Field => {
    let logo: BlobRef | undefined = (initial as BlobRef | undefined)?.ref?.$link ? (initial as BlobRef) : undefined;
    const wrap = document.createElement('div');
    wrap.className = 'admin-field';
    const label = document.createElement('div');
    label.className = 'admin-label-row';
    label.textContent = 'Logo';
    const row = document.createElement('div');
    row.className = 'admin-icon-row';
    const preview = document.createElement('canvas');
    preview.className = 'admin-icon-preview';
    preview.width = 128;
    preview.height = 128;
    preview.setAttribute('aria-hidden', 'true');
    const paint = (image?: CanvasImageSource, w = 0, h = 0) => {
      const ctx = preview.getContext('2d')!;
      ctx.clearRect(0, 0, preview.width, preview.height);
      if (!image) return;
      const side = Math.min(w, h);
      ctx.drawImage(image, (w - side) / 2, (h - side) / 2, side, side, 0, 0, preview.width, preview.height);
    };
    const paintUrl = (src: string) => {
      const img = new Image();
      img.onload = () => paint(img, img.naturalWidth, img.naturalHeight);
      img.src = src;
    };
    const note = document.createElement('p');
    note.className = 'admin-small';
    const pick = document.createElement('label');
    pick.className = 'admin-btn';
    pick.textContent = 'Choose an image';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = TYPES.join(',');
    input.className = 'sr-only';
    pick.appendChild(input);
    const fromSite = document.createElement('button');
    fromSite.type = 'button';
    fromSite.className = 'admin-btn';
    fromSite.textContent = 'Use the site’s icon';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-btn';
    remove.textContent = 'No logo';
    const help = document.createElement('p');
    help.className = 'admin-small';
    help.textContent = 'One square image, 512 px or bigger (PNG, JPEG or WebP), made into a 512 px PNG. Readers that show your publication (Standard.site’s apps) show it beside its name.';

    const show = (text = '') => {
      remove.hidden = !logo;
      note.textContent = text || (logo ? 'The logo, from the record.' : 'No logo.');
    };
    const set = (next: BlobRef | undefined, text: string) => {
      logo = next;
      show(text);
      onChange();
    };

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      if (!TYPES.includes(file.type)) return show('Pick a PNG, JPEG or WebP image.');
      if (file.size > MAX_SOURCE) return show('That image is over 5 MB.');
      try {
        show('Making the logo…');
        const bitmap = await createImageBitmap(file);
        const small = Math.min(bitmap.width, bitmap.height) < 512;
        const png = await drawPng(bitmap, 512);
        paint(bitmap, bitmap.width, bitmap.height);
        bitmap.close();
        if (png.size > MAX_LOGO) return show('Made at 512 px, it’s over 1 MB: try a simpler image.');
        show('Uploading…');
        set(await uploadBlob(session, png), `Ready: save to use it.${small ? ' It’s under 512 px, so it will look soft.' : ''}`);
      } catch (err) {
        show(`Couldn’t make the logo: ${errorText(err)}`);
      }
    });
    fromSite.addEventListener('click', async () => {
      try {
        const site = await getRecord<{ icon?: { png512?: BlobRef } }>(session, SITE_COLLECTION, 'self');
        const png = site?.value.icon?.png512;
        if (!png?.ref?.$link) return show('The site has no icon yet: add one in Site and SEO first.');
        paintUrl(`/media/${png.ref.$link}`);
        set(png, 'The site’s icon: save to use it.');
      } catch (err) {
        show(`Couldn’t read the site’s icon: ${errorText(err)}`);
      }
    });
    remove.addEventListener('click', () => {
      paint();
      set(undefined, 'No logo: save to remove it.');
    });

    row.appendChild(preview);
    row.appendChild(pick);
    row.appendChild(fromSite);
    row.appendChild(remove);
    wrap.appendChild(label);
    wrap.appendChild(row);
    wrap.appendChild(note);
    wrap.appendChild(help);
    if (logo) paintUrl(`/media/${logo.ref.$link}`);
    show();
    return { el: wrap, read: () => logo };
  };
}
