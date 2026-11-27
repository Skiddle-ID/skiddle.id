/**
 * The reviews block's slider, chips and "Read more" (src/components/blocks/reviews.astro), and the
 * services block's review counts, which show a service's reviews. Does nothing on a page without
 * the reviews block.
 */
import { slider } from '~/lib/slider';

const root = document.querySelector<HTMLElement>('[data-testimonials]');
if (root) {
  const cards = [...root.querySelectorAll<HTMLElement>('[data-slide]')];
  const filters = root.querySelector<HTMLElement>('[data-filters]');
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];

  // Cut long quotes at 7 lines, with "Read more" on the ones that were cut
  for (const card of cards) {
    const quote = card.querySelector<HTMLElement>('[data-quote]');
    const more = card.querySelector<HTMLButtonElement>('[data-read-more]');
    if (!quote || !more) continue;
    quote.classList.add('is-clamped');
    if (quote.scrollHeight <= quote.clientHeight + 1) {
      quote.classList.remove('is-clamped');
      continue;
    }
    more.hidden = false;
    more.addEventListener('click', () => {
      const open = quote.classList.toggle('is-clamped') === false;
      more.textContent = open ? 'Show less' : 'Read more';
      more.setAttribute('aria-expanded', String(open));
    });
  }

  const row = slider(root);
  const choose = (key: string) => {
    for (const c of cards) c.hidden = !!key && c.dataset.service !== key;
    for (const b of buttons) b.setAttribute('aria-pressed', String((b.dataset.filter ?? '') === key));
    row.refresh();
  };
  if (filters) filters.hidden = false;
  for (const b of buttons) b.addEventListener('click', () => choose(b.dataset.filter ?? ''));
  // A service card's "★ 5.0 · 1 review" shows just that service's
  for (const a of document.querySelectorAll<HTMLElement>('[data-show-reviews]')) a.addEventListener('click', () => choose(a.dataset.showReviews ?? ''));
}
