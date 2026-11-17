/**
 * The status from Jeff's AT Protocol repo: the `id.skiddle.status` record with key `self`
 * (lexicons/id/skiddle/status.json), set with scripts/status.mjs or the "Set status" workflow.
 *
 * The PDS is found from the DID on each read (cached for an hour), so a move to another PDS just
 * works. The record is cached for 60 seconds. If the PDS can't be reached, or there's no valid
 * record yet, the status falls back to src/data/status.ts, so the badge never breaks.
 */
import { status as fallback, type Status } from '~/data/status';
import { DID } from '~/lib/standard-site.mjs';
import { isState, stateOf, trimChars } from '~/lib/status-states.mjs';

export const STATUS_COLLECTION = 'id.skiddle.status';
const RECORD_TTL = 60;
const PDS_TTL = 3600;

export interface LiveStatus extends Status {
  /** When the record was last changed (absent for the fallback) */
  updatedAt?: string;
  /** Where the status came from */
  source: 'pds' | 'fallback';
}

type Fetch = typeof fetch;
const edgeCache = (): Cache | undefined => (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;

/** The status: from the PDS when possible, otherwise from src/data/status.ts */
export async function getStatus(origin: string, fetcher: Fetch = fetch): Promise<LiveStatus> {
  try {
    const record = await cached(`${origin}/__cache/status`, RECORD_TTL, async () => {
      const pds = await cached(`${origin}/__cache/pds`, PDS_TTL, () => resolvePds(DID, fetcher));
      const url = `${pds}/xrpc/com.atproto.repo.getRecord?repo=${DID}&collection=${STATUS_COLLECTION}&rkey=self`;
      const res = await fetcher(url, { signal: AbortSignal.timeout(4000) });
      if (res.status === 400 || res.status === 404) return null; // no status record yet
      if (!res.ok) throw new Error(`getRecord ${res.status}`);
      return ((await res.json()) as { value?: unknown }).value ?? null;
    });
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
  return { state: stateOf(v), label: text, city: location, timeZone, updatedAt, source: 'pds' };
}

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The PDS address from the DID document (did:plc via plc.directory, did:web via /.well-known/did.json) */
async function resolvePds(did: string, fetcher: Fetch): Promise<string> {
  const url = did.startsWith('did:web:') ? `https://${did.slice('did:web:'.length)}/.well-known/did.json` : `https://plc.directory/${did}`;
  const res = await fetcher(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`DID document ${res.status}`);
  const doc = (await res.json()) as { service?: { id: string; type?: string; serviceEndpoint?: string }[] };
  const pds = doc.service?.find((s) => s.id === '#atproto_pds' || s.id === `${did}#atproto_pds`)?.serviceEndpoint;
  if (!pds) throw new Error(`No PDS in the DID document for ${did}`);
  return pds.replace(/\/+$/, '');
}

/** `load()`'s result, cached at the edge for `ttl` seconds under `key` (a URL) */
async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const cache = edgeCache();
  const request = new Request(key);
  const hit = await cache?.match(request).catch(() => undefined);
  if (hit) return (await hit.json()) as T;
  const value = await load();
  await cache
    ?.put(request, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ttl}` } }))
    .catch(() => {});
  return value;
}
