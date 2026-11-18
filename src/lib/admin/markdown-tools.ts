/**
 * Markdown tools for a text box: a toolbar (bold, italic, link, heading, quote, lists, code), the
 * shortcuts Ctrl+B, Ctrl+I and Ctrl+K (⌘B, ⌘I and ⌘K on a Mac), Enter continuing a list, and pasting an
 * address over selected text to make a link. Optionally, an image pasted or dropped into the box is
 * handed to `onImage`. Used by the post editor and the pages' Markdown fields.
 *
 * The edits come from src/lib/markdown-edit.mjs. Each is applied as one step the browser can undo
 * (⌘Z), and fires the box's input event, so the editors notice it like typing.
 */
import { code, continueList, link, pasteLink, toggleLines, wrap, type Edit, type State } from '~/lib/markdown-edit.mjs';
import { isMacPlatform, platformName, shortcutKey, shortcutLabel } from '~/lib/shortcuts.mjs';

export interface ToolsOptions {
  /** An image pasted or dropped into the box; without it, images paste as the browser would */
  onImage?: (file: File) => void;
}

/** ⌘ on a Mac, an iPad or an iPhone; Ctrl on Windows, Linux and ChromeOS (src/lib/shortcuts.mjs) */
const mac = isMacPlatform(platformName());
/** "Ctrl+B" on Windows and Linux, "⌘B" on a Mac */
export const shortcut = (key: string) => shortcutLabel(key, mac);
/** For aria-keyshortcuts: "Control+B", or "Meta+B" on a Mac */
export const ariaShortcut = (key: string) => `${mac ? 'Meta' : 'Control'}+${key.toUpperCase()}`;
/** The letter of a shortcut being pressed with this computer's modifier, lower case, or '' */
export const pressedShortcut = (event: KeyboardEvent) => shortcutKey(event, mac);

interface Tool {
  label: string;
  /** What the button says */
  text: string;
  key?: string;
  edit: (s: State) => Edit;
}

const TOOLS: Tool[] = [
  { label: 'Bold', text: 'B', key: 'B', edit: (s) => wrap(s, '**', 'bold') },
  { label: 'Italic', text: 'I', key: 'I', edit: (s) => wrap(s, '_', 'italic') },
  { label: 'Link', text: 'Link', key: 'K', edit: (s) => link(s) },
  { label: 'Heading', text: 'H', edit: (s) => toggleLines(s, 'heading') },
  { label: 'Quote', text: '❝', edit: (s) => toggleLines(s, 'quote') },
  { label: 'Bulleted list', text: '•', edit: (s) => toggleLines(s, 'bullet') },
  { label: 'Numbered list', text: '1.', edit: (s) => toggleLines(s, 'number') },
  { label: 'Code', text: '</>', edit: code },
];

const stateOf = (area: HTMLTextAreaElement): State => ({ text: area.value, start: area.selectionStart, end: area.selectionEnd });

/**
 * Applies an edit as one undoable step where the browser can (insertText), or by setting the text
 * and firing an input event where it can't
 */
export function applyEdit(area: HTMLTextAreaElement, e: Edit) {
  area.focus();
  area.setSelectionRange(e.from, e.to);
  const done = e.insert ? document.execCommand('insertText', false, e.insert) : e.from === e.to || document.execCommand('delete');
  if (!done || area.value.slice(e.from, e.from + e.insert.length) !== e.insert) {
    area.setRangeText(e.insert, e.from, e.to, 'end');
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }
  area.setSelectionRange(e.start, e.end);
}

/** Inserts text at the cursor (over any selection), as one undoable step */
export function insertText(area: HTMLTextAreaElement, text: string) {
  const start = area.selectionStart ?? area.value.length;
  const end = area.selectionEnd ?? start;
  applyEdit(area, { from: start, to: end, insert: text, start: start + text.length, end: start + text.length });
}

const imageOf = (files: FileList | null | undefined) => [...(files ?? [])].find((f) => /^image\/(png|jpeg|webp|gif)$/.test(f.type));

/**
 * Adds the tools to a text box
 * @returns the toolbar, for the caller to place
 */
export function markdownTools(area: HTMLTextAreaElement, options: ToolsOptions = {}): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'admin-md-tools';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Formatting');
  if (area.id) bar.setAttribute('aria-controls', area.id);
  for (const tool of TOOLS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'admin-md-tool';
    b.textContent = tool.text;
    const name = tool.key ? `${tool.label} (${shortcut(tool.key)})` : tool.label;
    b.title = name;
    b.setAttribute('aria-label', name);
    if (tool.key) b.setAttribute('aria-keyshortcuts', ariaShortcut(tool.key));
    // Keeps the selection in the box when the button is pressed
    b.addEventListener('mousedown', (event) => event.preventDefault());
    b.addEventListener('click', () => applyEdit(area, tool.edit(stateOf(area))));
    bar.appendChild(b);
  }

  area.addEventListener('keydown', (event) => {
    // Not while an input method is composing (Chinese, Japanese, Korean)
    if (event.isComposing) return;
    const key = pressedShortcut(event);
    if (key) {
      const tool = TOOLS.find((t) => t.key?.toLowerCase() === key);
      if (tool) {
        event.preventDefault();
        applyEdit(area, tool.edit(stateOf(area)));
      }
      // Anything else (Ctrl+S, Ctrl+Z) goes on to the editor and the browser
      return;
    }
    if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      const e = continueList(stateOf(area));
      if (e) {
        event.preventDefault();
        applyEdit(area, e);
      }
    }
  });

  area.addEventListener('paste', (event) => {
    const image = options.onImage && imageOf(event.clipboardData?.files);
    if (image) {
      event.preventDefault();
      options.onImage!(image);
      return;
    }
    const e = pasteLink(stateOf(area), event.clipboardData?.getData('text/plain') ?? '');
    if (e) {
      event.preventDefault();
      applyEdit(area, e);
    }
  });

  if (options.onImage) {
    const dragging = (on: boolean) => area.classList.toggle('admin-drop-target', on);
    area.addEventListener('dragover', (event) => {
      if (![...(event.dataTransfer?.items ?? [])].some((i) => i.kind === 'file')) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      dragging(true);
    });
    area.addEventListener('dragleave', () => dragging(false));
    area.addEventListener('drop', (event) => {
      dragging(false);
      const image = imageOf(event.dataTransfer?.files);
      if (!image) return;
      event.preventDefault();
      options.onImage!(image);
    });
  }
  return bar;
}
