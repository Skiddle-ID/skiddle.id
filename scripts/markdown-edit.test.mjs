// Markdown editing for the admin app's text boxes (src/lib/markdown-edit.mjs). `npm run test:unit`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyEdit, code, continueList, isUrl, link, pasteLink, toggleLines, wordStats, wrap } from '../src/lib/markdown-edit.mjs';

/**
 * A state from text with the cursor marked by one |, or else the selection by the first [ and the
 * first ] after it (other brackets are the text's own, like a task's [x])
 */
function at(marked) {
  const cut = (s, i) => s.slice(0, i) + s.slice(i + 1);
  const bar = marked.indexOf('|');
  if (bar !== -1) return { text: cut(marked, bar), start: bar, end: bar };
  const open = marked.indexOf('[');
  const close = marked.indexOf(']', open);
  return { text: cut(cut(marked, close), open), start: open, end: close - 1 };
}

/** The edit's result with its selection marked the same way */
function show(s, edit) {
  const r = applyEdit(s.text, edit);
  return r.start === r.end ? `${r.text.slice(0, r.start)}|${r.text.slice(r.start)}` : `${r.text.slice(0, r.start)}[${r.text.slice(r.start, r.end)}]${r.text.slice(r.end)}`;
}

const run = (marked, fn) => {
  const s = at(marked);
  const e = fn(s);
  return e && show(s, e);
};

describe('bold, italic and inline code', () => {
  it('wraps the selection, keeping spaces outside', () => {
    assert.equal(run('a [word] b', (s) => wrap(s, '**', 'bold')), 'a **[word]** b');
    assert.equal(run('a [word ]b', (s) => wrap(s, '**', 'bold')), 'a **[word]** b');
  });
  it('inserts a placeholder with nothing selected', () => {
    assert.equal(run('a | b', (s) => wrap(s, '_', 'italic')), 'a _[italic]_ b');
  });
  it('unwraps what is already wrapped, from outside or inside the markers', () => {
    assert.equal(run('a **[word]** b', (s) => wrap(s, '**', 'bold')), 'a [word] b');
    assert.equal(run('a [**word**] b', (s) => wrap(s, '**', 'bold')), 'a [word] b');
  });
});

describe('links', () => {
  it('makes the selection the link text and selects "url" to type over', () => {
    assert.equal(run('see [the docs] here', (s) => link(s)), 'see [the docs]([url]) here');
  });
  it('with nothing selected, inserts a link and selects its text', () => {
    assert.equal(run('see | here', (s) => link(s)), 'see [[link text]](url) here');
  });
  it('a selected address becomes the link, with its text to type', () => {
    assert.equal(run('[https://skiddle.id]', (s) => link(s)), '[[link text]](https://skiddle.id)');
  });
  it('pasting an address over selected text makes a link; anything else pastes as usual', () => {
    assert.equal(run('read [this post] now', (s) => pasteLink(s, 'https://skiddle.id/posts/x/')), 'read [this post](https://skiddle.id/posts/x/)| now');
    assert.equal(run('read | now', (s) => pasteLink(s, 'https://skiddle.id')), null);
    assert.equal(run('read [this] now', (s) => pasteLink(s, 'not a link')), null);
    assert.equal(run('read [this] now', (s) => pasteLink(s, 'https://a.b and more')), null);
    assert.equal(run('[https://old.example]', (s) => pasteLink(s, 'https://new.example')), null);
    assert.ok(isUrl('https://skiddle.id/posts/x/') && !isUrl('skiddle.id') && !isUrl('javascript:alert(1)'));
  });
});

describe('lines: quotes, lists and headings', () => {
  it('adds a marker to each selected line, numbering a numbered list', () => {
    assert.equal(run('[one\ntwo]', (s) => toggleLines(s, 'bullet')), '[- one\n- two]');
    assert.equal(run('[one\n\ntwo]', (s) => toggleLines(s, 'number')), '[1. one\n\n2. two]');
    assert.equal(run('[a\nb]', (s) => toggleLines(s, 'quote')), '[> a\n> b]');
  });
  it('takes it off again when every line has it', () => {
    assert.equal(run('[- one\n- two]', (s) => toggleLines(s, 'bullet')), '[one\ntwo]');
    assert.equal(run('## Ti|tle', (s) => toggleLines(s, 'heading')), 'Ti|tle');
  });
  it('changes a bullet list to a numbered one and back, keeping indents', () => {
    assert.equal(run('[- one\n  - two]', (s) => toggleLines(s, 'number')), '[1. one\n  2. two]');
    assert.equal(run('[1. one\n2. two]', (s) => toggleLines(s, 'bullet')), '[- one\n- two]');
  });
  it('a quote keeps a list inside it; a heading drops the list marker', () => {
    assert.equal(run('[- one]', (s) => toggleLines(s, 'quote')), '[> - one]');
    assert.equal(run('- Ti|tle', (s) => toggleLines(s, 'heading')), '## Ti|tle');
  });
  it('works from the cursor alone, on its line', () => {
    assert.equal(run('first\nsec|ond\nthird', (s) => toggleLines(s, 'heading')), 'first\n## sec|ond\nthird');
  });
});

describe('code', () => {
  it('is inline within a line, and a fenced block across lines', () => {
    assert.equal(run('run [npm test] now', code), 'run `[npm test]` now');
    assert.equal(run('[a = 1\nb = 2]', code), '```\n[a = 1\nb = 2]\n```');
  });
});

describe('Enter in a list', () => {
  it('starts the next item: bullets, numbers and tasks', () => {
    assert.equal(run('- one|', continueList), '- one\n- |');
    assert.equal(run('  * one|', continueList), '  * one\n  * |');
    assert.equal(run('9. nine|', continueList), '9. nine\n10. |');
    assert.equal(run('- [x] done|', continueList), '- [x] done\n- [ ] |');
  });
  it('splits an item at the cursor', () => {
    assert.equal(run('- one| two', continueList), '- one\n- | two');
  });
  it('ends the list on an empty item', () => {
    assert.equal(run('- one\n- |', continueList), '- one\n|');
  });
  it('leaves other lines, the marker itself, and selections to the browser', () => {
    assert.equal(run('just text|', continueList), null);
    assert.equal(run('|- one', continueList), null);
    assert.equal(run('- [one]', continueList), null);
  });
});

describe('word count', () => {
  it('counts as the post page does: 220 words a minute, at least one', () => {
    assert.deepEqual(wordStats(''), { words: 0, minutes: 1 });
    assert.deepEqual(wordStats('one two\nthree'), { words: 3, minutes: 1 });
    assert.deepEqual(wordStats('word '.repeat(660)), { words: 660, minutes: 3 });
  });
});
