/**
 * The profile block's status line, kept current from the id.skiddle.status record
 * (src/lib/at-status.ts): the page renders the status it read, and this reads it again from
 * /api/status.json, which a cached page may be older than. Does nothing on a page without one.
 */
import { STATE_INFO, stateOf, toneColour } from '~/lib/status-states.mjs';

(async () => {
  const text = document.getElementById('statusText');
  const label = document.getElementById('statusState');
  const dot = document.getElementById('statusDot');
  const emoji = document.getElementById('statusEmoji');
  if (!text || !label || !dot || !emoji) return;
  try {
    const res = await fetch('/api/status.json');
    if (!res.ok) return;
    const s = (await res.json()) as { state?: string; available?: boolean; text?: string; emoji?: string | null };
    if (typeof s.text !== 'string' || !s.text) return;
    const info = STATE_INFO[stateOf(s)];
    text.textContent = s.text.charAt(0).toUpperCase() + s.text.slice(1);
    label.textContent = `${info.label}: `;
    dot.style.background = toneColour(info.tone);
    // An emoji takes the dot's place
    emoji.textContent = s.emoji ?? '';
    emoji.classList.toggle('hidden', !s.emoji);
    dot.classList.toggle('hidden', !!s.emoji);
  } catch {
    // keep the status the page rendered
  }
})();
