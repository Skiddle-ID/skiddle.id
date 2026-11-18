/**
 * A row of slides that scrolls sideways, for the testimonials: one quote at a time on the home page
 * (src/components/testimonial-slider.astro), and 1 to 3 cards at a time on /services/. The markup
 * does the layout (CSS scroll snap), so it scrolls without JavaScript too; this adds:
 *   - ‹ › buttons ([data-prev], [data-next]) that move a view at a time, and ← → on the row
 *   - dots ([data-dot], one per slide) or a counter ([data-count]: "2 / 5", or "1–3 of 13" when
 *     more than one fits)
 *   - optionally, moving on by itself every `autoplay` ms: paused while the pointer or focus is on
 *     it or the tab is hidden, stopped for good once someone moves it, never with reduced motion
 * Slides with the `hidden` attribute (filtered out) are skipped; call refresh() after hiding some.
 */

export interface SliderOptions {
  /** Move on by itself every this many milliseconds */
  autoplay?: number;
}

export function slider(root: HTMLElement, options: SliderOptions = {}) {
  const track = root.querySelector<HTMLElement>('[data-track]');
  const controls = root.querySelector<HTMLElement>('[data-controls]');
  if (!track) return { refresh() {} };
  const all = [...track.querySelectorAll<HTMLElement>('[data-slide]')];
  const dots = [...root.querySelectorAll<HTMLButtonElement>('[data-dot]')];
  const count = root.querySelector<HTMLElement>('[data-count]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const shown = () => all.filter((s) => !s.hidden);
  let index = 0;
  let stopped = !options.autoplay || reduce.matches;
  let paused = false;
  // Where a scroll this started is heading: while it's on its way, the scroll events are its own,
  // not someone swiping, so they don't change which slide is first
  let heading: number | undefined;
  let headingTimer: ReturnType<typeof setTimeout> | undefined;

  /** The distance from one slide to the next, gap included */
  const stride = () => {
    const s = shown();
    return s.length > 1 ? s[1].offsetLeft - s[0].offsetLeft : track.clientWidth;
  };
  /** How many slides fit in view at once */
  const perView = () => Math.max(1, Math.round((track.clientWidth + (stride() - (shown()[0]?.offsetWidth ?? 0))) / stride()));
  /** The last index the row can start at, so the end isn't left half-empty */
  const lastStart = () => Math.max(0, shown().length - perView());

  const show = () => {
    const n = shown().length;
    const view = perView();
    if (controls) controls.hidden = n <= view;
    dots.forEach((d, i) => (i === index ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
    if (count) count.textContent = view > 1 ? `${index + 1}–${Math.min(n, index + view)} of ${n}` : `${index + 1} / ${n}`;
  };

  const go = (i: number, byPerson: boolean) => {
    const last = lastStart();
    // Past either end, wrap around
    index = i > last ? 0 : i < 0 ? last : i;
    heading = index * stride();
    clearTimeout(headingTimer);
    // In case it never quite gets there (a person scrolled, or the width changed)
    headingTimer = setTimeout(() => (heading = undefined), 1500);
    track.scrollTo({ left: heading, behavior: reduce.matches ? 'auto' : 'smooth' });
    show();
    if (byPerson) {
      stopped = true;
      // Screen readers hear the change when someone moves it, not while it moves by itself
      track.setAttribute('aria-live', 'polite');
    }
  };

  // A view back, but no further than the first; from the first, around to the end
  root.querySelector('[data-prev]')?.addEventListener('click', () => go(index <= 0 ? -1 : Math.max(0, index - perView()), true));
  root.querySelector('[data-next]')?.addEventListener('click', () => go(index >= lastStart() ? lastStart() + 1 : Math.min(index + perView(), lastStart()), true));
  dots.forEach((d, i) => d.addEventListener('click', () => go(i, true)));
  track.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    go(index + (e.key === 'ArrowRight' ? 1 : -1), true);
  });

  // A swipe or sideways scroll moves it too: follow it, and stop moving by itself
  for (const type of ['pointerdown', 'wheel', 'touchstart'] as const) {
    track.addEventListener(
      type,
      () => {
        stopped = true;
        heading = undefined;
      },
      { passive: true },
    );
  }
  let settle: ReturnType<typeof setTimeout> | undefined;
  track.addEventListener('scroll', () => {
    if (heading !== undefined) {
      if (Math.abs(track.scrollLeft - heading) <= 2) heading = undefined;
      return;
    }
    clearTimeout(settle);
    settle = setTimeout(() => {
      const at = Math.min(lastStart(), Math.max(0, Math.round(track.scrollLeft / stride())));
      if (at !== index) {
        index = at;
        show();
      }
    }, 120);
  });

  // Keep the same slide first when the width changes (and how many fit with it)
  new ResizeObserver(() => {
    index = Math.min(index, lastStart());
    track.scrollTo({ left: index * stride(), behavior: 'auto' });
    show();
  }).observe(track);

  if (options.autoplay) {
    root.addEventListener('pointerenter', () => (paused = true));
    root.addEventListener('pointerleave', () => (paused = false));
    root.addEventListener('focusin', () => (paused = true));
    root.addEventListener('focusout', (e) => {
      if (!root.contains(e.relatedTarget as Node | null)) paused = false;
    });
    reduce.addEventListener('change', () => {
      if (reduce.matches) stopped = true;
    });
    setInterval(() => {
      if (!stopped && !paused && !document.hidden) go(index + 1, false);
    }, options.autoplay);
  }

  show();
  return {
    /** After slides were hidden or shown: back to the first */
    refresh() {
      index = 0;
      track.scrollTo({ left: 0, behavior: 'auto' });
      show();
    },
  };
}
