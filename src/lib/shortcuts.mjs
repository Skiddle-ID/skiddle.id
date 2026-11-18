/**
 * Keyboard shortcuts in the admin app, the same on every computer: Ctrl on Windows, Linux and
 * ChromeOS, ⌘ (Command) on a Mac, an iPad or an iPhone with a keyboard. Ctrl+B is bold on Windows
 * and ⌘B on a Mac; Ctrl+B on a Mac is left alone, as the system's own (move back a character).
 * Plain JavaScript, so the tests can use it (scripts/shortcuts.test.mjs).
 */

/**
 * Whether a platform name is Apple's, from navigator.userAgentData.platform ("macOS"),
 * navigator.platform ("MacIntel", "iPhone", "iPad") or the user agent
 * @param {string | undefined} platform
 */
export const isMacPlatform = (platform) => /mac|iphone|ipad|ipod/i.test(platform ?? '');

/** This browser's platform name, by the newest way it offers */
export function platformName() {
  if (typeof navigator === 'undefined') return '';
  const data = /** @type {{ userAgentData?: { platform?: string } }} */ (/** @type {unknown} */ (navigator)).userAgentData;
  return data?.platform || navigator.platform || navigator.userAgent || '';
}

/**
 * A shortcut as people on this computer read it: "⌘S" on a Mac, "Ctrl+S" elsewhere
 * @param {string} key
 * @param {boolean} mac
 */
export const shortcutLabel = (key, mac) => (mac ? `⌘${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`);

/**
 * The letter of a shortcut being pressed (lower case), or '' if it isn't one: the platform's own
 * modifier (⌘ on a Mac, Ctrl elsewhere) and a letter, without Alt (so AltGr, which Windows reports
 * as Ctrl+Alt, still types its characters), Shift or the other modifier
 * @param {{ key: string, metaKey: boolean, ctrlKey: boolean, altKey: boolean, shiftKey: boolean, isComposing?: boolean }} event
 * @param {boolean} mac
 */
export function shortcutKey(event, mac) {
  if (event.isComposing || event.altKey || event.shiftKey) return '';
  const mod = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return mod && /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : '';
}
