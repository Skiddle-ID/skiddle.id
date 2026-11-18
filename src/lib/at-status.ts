/**
 * The status from Jeff's AT Protocol repo: the `id.skiddle.status` record with key `self`
 * (lexicons/id/skiddle/status.json), set with scripts/status.mjs or the "Set status" workflow.
 *
 * The record is read through src/lib/pds.ts, which finds the PDS from the DID (so a move to another
 * PDS just works) and caches the record for 60 seconds. If the PDS can't be reached, or there's no
 * valid record yet, the status falls back to src/data/status.ts, so the badge never breaks.
 */
import { status as fallback, type Status } from '~/data/status';
import { getRecord } from '~/lib/pds';
import { isEmoji, isState, stateOf, trimChars } from '~/lib/status-states.mjs';

export const STATUS_COLLECTION = 'id.skiddle.status';

export interface LiveStatus extends Status {
  /** When the record was last changed (absent for the fallback) */
  updatedAt?: string;
  /** Where the status came from */
  source: 'pds' | 'fallback';
}

/**
 * The status: from the PDS when possible, otherwise from src/data/status.ts
 * @param _origin The site's origin (unused since the records cache moved to src/lib/pds.ts)
 */
export async function getStatus(_origin?: string, fetcher: typeof fetch = fetch): Promise<LiveStatus> {
  try {
    const record = await getRecord<unknown>(STATUS_COLLECTION, 'self', { fetcher });
    const status = parseStatus(record);
    if (status) return status;
  } catch (err) {
    console.error('status:', err);
  }
  return { ...fallback, source: 'fallback' };
}

/** A valid status from a record value, or null */
export function parseStatus(value: unknown): LiveStatus | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if ((typeof v.available !== 'boolean' && !isState(v.state)) || typeof v.text !== 'string' || !v.text.trim()) return null;
  // Trimmed by characters as people see them, so an emoji near the end is never cut in half
  const text = trimChars(v.text.trim());
  const location = typeof v.location === 'string' && v.location.trim() ? trimChars(v.location.trim()) : fallback.city;
  const timeZone = typeof v.timeZone === 'string' && validTimeZone(v.timeZone) ? v.timeZone : fallback.timeZone;
  const updatedAt = typeof v.updatedAt === 'string' ? v.updatedAt : undefined;
  // One emoji, shown instead of the dot; anything else is left out
  const emoji = isEmoji(v.emoji) ? v.emoji : undefined;
  return { state: stateOf(v), ...(emoji ? { emoji } : {}), label: text, city: location, timeZone, updatedAt, source: 'pds' };
}

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
