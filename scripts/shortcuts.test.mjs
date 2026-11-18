// Keyboard shortcuts in the admin app, Ctrl or ⌘ by platform (src/lib/shortcuts.mjs). `npm run test:unit`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMacPlatform, shortcutKey, shortcutLabel } from '../src/lib/shortcuts.mjs';

const press = (key, mods = {}) => ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods });

describe('platform', () => {
  it('knows Apple’s platforms by any of their names', () => {
    for (const p of ['macOS', 'MacIntel', 'iPhone', 'iPad', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)']) assert.equal(isMacPlatform(p), true, p);
    for (const p of ['Windows', 'Win32', 'Linux x86_64', 'Chrome OS', 'Android', '', undefined]) assert.equal(isMacPlatform(p), false, String(p));
  });
  it('labels shortcuts as people there read them', () => {
    assert.equal(shortcutLabel('s', true), '⌘S');
    assert.equal(shortcutLabel('s', false), 'Ctrl+S');
  });
});

describe('Windows, Linux and ChromeOS: Ctrl', () => {
  it('takes Ctrl and a letter, in either case', () => {
    assert.equal(shortcutKey(press('b', { ctrlKey: true }), false), 'b');
    assert.equal(shortcutKey(press('S', { ctrlKey: true }), false), 's');
  });
  it('leaves the Windows key, AltGr (Ctrl+Alt), Shift and non-letters alone', () => {
    assert.equal(shortcutKey(press('b', { metaKey: true }), false), '');
    assert.equal(shortcutKey(press('e', { ctrlKey: true, altKey: true }), false), '');
    assert.equal(shortcutKey(press('S', { ctrlKey: true, shiftKey: true }), false), '');
    assert.equal(shortcutKey(press('Enter', { ctrlKey: true }), false), '');
    assert.equal(shortcutKey(press('b'), false), '');
  });
});

describe('Mac: ⌘', () => {
  it('takes ⌘ and a letter', () => {
    assert.equal(shortcutKey(press('k', { metaKey: true }), true), 'k');
  });
  it('leaves Ctrl to the system (Ctrl+B moves back a character), and ⌘ with Ctrl', () => {
    assert.equal(shortcutKey(press('b', { ctrlKey: true }), true), '');
    assert.equal(shortcutKey(press('b', { metaKey: true, ctrlKey: true }), true), '');
  });
  it('does nothing while an input method is composing', () => {
    assert.equal(shortcutKey(press('b', { metaKey: true, isComposing: true }), true), '');
  });
});
