/**
 * Drag to reorder: a list's items move by dragging their handle, with a mouse, a pen or a finger
 * (pointer events, so it works on a phone too, unlike HTML drag and drop). The ↑/↓ buttons the
 * editors keep next to it do the same from the keyboard.
 *
 * The item moves in the page as it's dragged; `onDrop` runs once it's let go, if it moved, for the
 * caller to read the new order from the page.
 */

export interface SortableOptions {
  /** The items that move, e.g. ':scope > li' or ':scope > li[data-planned]' */
  items: string;
  /** Where an item is picked up, inside it */
  handle: string;
  onDrop: () => void;
}

export function sortable(list: HTMLElement, options: SortableOptions) {
  // A handle inside a <summary> mustn't fold or unfold its item
  list.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest(options.handle)) event.preventDefault();
  });
  list.addEventListener('pointerdown', (event) => {
    const handle = (event.target as HTMLElement).closest<HTMLElement>(options.handle);
    if (!handle || event.button !== 0) return;
    const item = handle.closest<HTMLElement>(options.items.replace(':scope > ', ''));
    if (!item || item.parentElement !== list) return;
    event.preventDefault();
    const start = [...list.children].indexOf(item);
    const pointer = event.pointerId;
    item.classList.add('admin-dragging');

    // On the window, not the handle: moving the item in the page loses a pointer capture
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      // The first item whose middle is below the pointer is the one to go before
      const others = [...list.querySelectorAll<HTMLElement>(options.items)].filter((o) => o !== item);
      const before = others.find((o) => {
        const r = o.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      if (before) {
        if (item.nextElementSibling !== before) list.insertBefore(item, before);
      } else {
        const last = others.at(-1);
        if (last && last.nextElementSibling !== item) list.insertBefore(item, last.nextSibling);
      }
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      item.classList.remove('admin-dragging');
      if ([...list.children].indexOf(item) !== start) options.onDrop();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });
}

/** A drag handle: shown to pointers, hidden from screen readers (the ↑/↓ buttons are for them) */
export function dragHandle(label: string) {
  const h = document.createElement('span');
  h.className = 'admin-drag';
  h.textContent = '⠿';
  h.title = label;
  h.setAttribute('aria-hidden', 'true');
  return h;
}
