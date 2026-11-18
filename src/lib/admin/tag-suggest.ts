/**
 * Suggestions for a comma-separated tags box: the tags posts and drafts already use that match the
 * one being typed, in a list under the box. ↑/↓ choose one, Enter or Tab takes it, Esc closes the
 * list; a tap or click takes it too. Taking one fills in the tag, a comma and a space, ready for
 * the next. The matching is in src/lib/suggest.mjs.
 */
import { matchTags, putTag, tagAt } from '~/lib/suggest.mjs';

/** @param tags The tags to suggest, most used first */
export function tagSuggest(input: HTMLInputElement, tags: () => string[]) {
  const list = document.createElement('ul');
  list.id = `${input.id}-suggest`;
  list.className = 'admin-suggest';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Tags you’ve used');
  list.hidden = true;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', list.id);
  input.parentElement?.classList.add('admin-has-suggest');
  input.parentNode?.insertBefore(list, input.nextSibling);

  let options: string[] = [];
  let active = -1;
  const cursor = () => input.selectionStart ?? input.value.length;

  const close = () => {
    list.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const render = () => {
    const { typed, others } = tagAt(input.value, cursor());
    options = matchTags(tags(), typed, others);
    if (!options.length || document.activeElement !== input) return close();
    list.replaceChildren(
      ...options.map((tag, i) => {
        const li = document.createElement('li');
        li.id = `${list.id}-${i}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === active));
        li.textContent = tag;
        // Before the box loses focus to the list
        li.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          choose(i);
        });
        return li;
      }),
    );
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  };

  const choose = (i: number) => {
    const { value, cursor: at } = putTag(input.value, cursor(), options[i]);
    input.value = value;
    input.setSelectionRange(at, at);
    // The editor saves on input, as when typing
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  input.addEventListener('input', () => {
    active = -1;
    render();
  });
  input.addEventListener('focus', render);
  input.addEventListener('click', render);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (list.hidden) {
      if (event.key === 'ArrowDown') {
        render();
        if (!list.hidden) event.preventDefault();
      }
      return;
    }
    const n = options.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      active = event.key === 'ArrowDown' ? (active + 1) % n : (active - 1 + n) % n;
      render();
    } else if ((event.key === 'Enter' || event.key === 'Tab') && active >= 0) {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  });
}
