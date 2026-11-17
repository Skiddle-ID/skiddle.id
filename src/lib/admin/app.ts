/**
 * The admin app (/admin/), in the browser. Signs in with Jeff's Bluesky account over AT Protocol
 * OAuth (src/lib/admin/oauth.ts), then reads and writes records in his repo through his PDS:
 *   - the status (id.skiddle.status, key `self`), which /api/status.json and the home page read
 *   - the status lexicon (com.atproto.lexicon.schema, key `id.skiddle.status`)
 * and lists the site's other collections, read-only.
 */
import { BrowserOAuthClient, OAuthCallbackError, type OAuthSession } from '@atproto/oauth-client-browser';
import { DID } from '~/lib/standard-site.mjs';
import { STATE_INFO, isState, stateOf, toneColour, type StatusState } from '~/lib/status-states.mjs';
import { clientMetadata, isLoopback, loopbackClientId } from './oauth';
import statusLexicon from '../../../lexicons/id/skiddle/status.json';

const STATUS = 'id.skiddle.status';
const LEXICON = 'com.atproto.lexicon.schema';
const MAX = 64;
const DEFAULTS = { location: 'Bangkok', timeZone: 'Asia/Bangkok' };
/** Resolves handles during sign-in. Bluesky's server, which signs Jeff in anyway */
const HANDLE_RESOLVER = 'https://bsky.social';

interface StatusRecord {
  $type: typeof STATUS;
  state: StatusState;
  /** True only for 'available': kept for readers that don't know `state` */
  available: boolean;
  text: string;
  location?: string;
  timeZone?: string;
  updatedAt: string;
}
interface RepoRecord<T> {
  uri: string;
  cid: string;
  value: T;
}

class XrpcError extends Error {
  constructor(
    readonly status: number,
    readonly error: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

const el = <T = HTMLElement>(id: string) => document.getElementById(id) as unknown as T;
const views = ['loading', 'signedOut', 'wrongAccount', 'signedIn'] as const;
type View = (typeof views)[number];

function show(view: View) {
  for (const v of views) el(v).hidden = v !== view;
  el('account').hidden = view !== 'signedIn' && view !== 'wrongAccount';
}

function notice(text: string | null) {
  const n = el('notice');
  n.textContent = text ?? '';
  n.hidden = !text;
}

function message(id: string, text: string, kind: 'ok' | 'error' | 'info' = 'info') {
  const m = el(id);
  m.textContent = text;
  m.dataset.kind = kind;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = (s: string) => [...segmenter.segment(s)].length;

function validTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ---- XRPC through the signed-in session (DPoP-bound tokens, refreshed by the client) ----

async function xrpc<T>(session: OAuthSession, method: string, params?: Record<string, string>, body?: unknown): Promise<T> {
  const query = params ? `?${new URLSearchParams(params)}` : '';
  const init: RequestInit | undefined =
    body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const res = await session.fetchHandler(`/xrpc/${method}${query}`, init);
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new XrpcError(res.status, data.error, data.message || data.error || `${method} failed (${res.status})`);
  return data as T;
}

async function getRecord<T>(session: OAuthSession, collection: string, rkey: string): Promise<RepoRecord<T> | null> {
  try {
    return await xrpc<RepoRecord<T>>(session, 'com.atproto.repo.getRecord', { repo: DID, collection, rkey });
  } catch (err) {
    if (err instanceof XrpcError && (err.error === 'RecordNotFound' || err.status === 404)) return null;
    throw err;
  }
}

function putRecord(session: OAuthSession, collection: string, rkey: string, record: object, swapRecord?: string) {
  return xrpc<{ uri: string; cid: string }>(session, 'com.atproto.repo.putRecord', undefined, {
    repo: DID,
    collection,
    rkey,
    record,
    ...(swapRecord ? { swapRecord } : {}),
  });
}

// ---- Status ----

let statusCid: string | undefined;

function formValues() {
  const form = el<HTMLFormElement>('statusForm');
  const data = new FormData(form);
  const state = data.get('state');
  return {
    state: isState(state) ? state : 'available',
    text: String(data.get('text') ?? '').trim(),
    location: String(data.get('location') ?? '').trim() || DEFAULTS.location,
    timeZone: String(data.get('timeZone') ?? '').trim() || DEFAULTS.timeZone,
  };
}

function renderPreview() {
  const v = formValues();
  const count = graphemes(v.text);
  const counter = el('statusCount');
  counter.textContent = `${count}/${MAX}`;
  counter.toggleAttribute('data-over', count > MAX);
  const time = validTimeZone(v.timeZone)
    ? new Intl.DateTimeFormat('en-GB', { timeZone: v.timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date())
    : '??:??';
  const info = STATE_INFO[v.state];
  el('previewDot').style.background = toneColour(info.tone);
  el('previewText').textContent = `${info.label}: ${v.text || '…'} · ${v.location}, ${time}`;
  const device = el<HTMLButtonElement>('useDeviceZone');
  // Only when the device's clock differs (Asia/Phnom_Penh and Asia/Bangkok are both UTC+7)
  device.hidden = !DEVICE_ZONE || !validTimeZone(v.timeZone) || zoneOffset(v.timeZone) === zoneOffset(DEVICE_ZONE);
  device.textContent = `Use this device’s time zone (${DEVICE_ZONE})`;
}

// ---- Time zones: a select grouped by region, e.g. Asia → "Bangkok (UTC+7)" ----

const DEVICE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function zoneOffset(tz: string): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value;
  return name ? name.replace('GMT', 'UTC') : 'UTC';
}

function zoneOption(tz: string): HTMLOptionElement {
  const slash = tz.indexOf('/');
  const place = (slash > 0 ? tz.slice(slash + 1) : tz).replaceAll('_', ' ');
  return new Option(`${place} (${zoneOffset(tz)})`, tz);
}

function fillZones() {
  const select = el<HTMLSelectElement>('statusTimeZone');
  const zones = new Set(Intl.supportedValuesOf('timeZone'));
  zones.add('UTC');
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const tz of [...zones].sort()) {
    const slash = tz.indexOf('/');
    const region = slash > 0 ? tz.slice(0, slash) : 'Other';
    let group = groups.get(region);
    if (!group) {
      group = document.createElement('optgroup');
      group.label = region;
      groups.set(region, group);
    }
    group.appendChild(zoneOption(tz));
  }
  while (select.firstChild) select.firstChild.remove();
  const order = [...groups.keys()].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));
  for (const region of order) select.appendChild(groups.get(region)!);
}

/** Select `tz`, adding it to the list if it's a valid zone the list doesn't have (an old alias) */
function selectZone(tz: string) {
  const select = el<HTMLSelectElement>('statusTimeZone');
  if (![...select.options].some((o) => o.value === tz) && validTimeZone(tz)) select.insertBefore(zoneOption(tz), select.firstChild);
  select.value = tz;
}

function fillStatus(record: RepoRecord<Partial<StatusRecord>> | null) {
  const form = el<HTMLFormElement>('statusForm');
  const value = record?.value ?? {};
  statusCid = record?.cid;
  (form.elements.namedItem('state') as RadioNodeList).value = stateOf(value);
  el<HTMLInputElement>('statusText').value = value.text ?? '';
  el<HTMLInputElement>('statusLocation').value = value.location ?? DEFAULTS.location;
  selectZone(value.timeZone ?? DEFAULTS.timeZone);
  el('statusUpdated').textContent = record
    ? `Last changed ${value.updatedAt ? new Date(value.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'at an unknown time'}.`
    : 'No status record yet, so the site shows its built-in status (src/data/status.ts).';
  renderPreview();
}

async function loadStatus(session: OAuthSession) {
  fillStatus(await getRecord<Partial<StatusRecord>>(session, STATUS, 'self'));
}

function setupStatus(session: OAuthSession) {
  const form = el<HTMLFormElement>('statusForm');
  fillZones();
  el('useDeviceZone').addEventListener('click', () => {
    selectZone(DEVICE_ZONE);
    form.dispatchEvent(new Event('input'));
  });
  form.addEventListener('input', () => {
    renderPreview();
    message('statusMessage', '');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const v = formValues();
    if (!v.text) return message('statusMessage', 'Say what your status is.', 'error');
    if (graphemes(v.text) > MAX) return message('statusMessage', `Keep it to ${MAX} characters.`, 'error');
    if (graphemes(v.location) > MAX) return message('statusMessage', `Keep the location to ${MAX} characters.`, 'error');
    if (!validTimeZone(v.timeZone)) return message('statusMessage', `Unknown time zone: ${v.timeZone}. Pick one from the list.`, 'error');

    const record: StatusRecord = { $type: STATUS, ...v, available: v.state === 'available', updatedAt: new Date().toISOString() };
    const button = el<HTMLButtonElement>('statusSave');
    button.disabled = true;
    message('statusMessage', 'Saving…');
    try {
      const res = await putRecord(session, STATUS, 'self', record, statusCid);
      fillStatus({ uri: res.uri, cid: res.cid, value: record });
      message('statusMessage', 'Saved. skiddle.id shows it within a minute.', 'ok');
    } catch (err) {
      if (err instanceof XrpcError && err.error === 'InvalidSwap') {
        await loadStatus(session).catch(() => {});
        message('statusMessage', 'Your status changed somewhere else since this page loaded. This is the latest: check it and save again.', 'error');
      } else {
        message('statusMessage', `Couldn't save: ${errorText(err)}`, 'error');
      }
    } finally {
      button.disabled = false;
    }
  });
}

// ---- Lexicon ----

/** JSON with object keys sorted, to compare records whatever order the PDS returns keys in */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((k) => k !== '$type')
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function loadLexicon(session: OAuthSession) {
  const state = el('lexiconState');
  const button = el<HTMLButtonElement>('lexiconPublish');
  const record = await getRecord<object>(session, LEXICON, statusLexicon.id);
  if (!record) {
    state.textContent = 'Not published yet.';
    button.textContent = 'Publish lexicon';
    button.hidden = false;
  } else if (canonical(record.value) === canonical(statusLexicon)) {
    state.textContent = 'Published, and the same as the site’s copy.';
    button.hidden = true;
  } else {
    state.textContent = 'Published, but the site’s copy (lexicons/id/skiddle/status.json) has changed since.';
    button.textContent = 'Publish the new version';
    button.hidden = false;
  }
  checkLexiconDns();
}

/** Whether _lexicon.skiddle.id points at the DID, so other apps can find the lexicon */
async function checkLexiconDns() {
  const out = el('lexiconDns');
  const want = `did=${DID}`;
  try {
    const res = await fetch('https://cloudflare-dns.com/dns-query?name=_lexicon.skiddle.id&type=TXT', {
      headers: { Accept: 'application/dns-json' },
    });
    const data = (await res.json()) as { Answer?: { data: string }[] };
    const found = data.Answer?.some((a) => a.data.replace(/"/g, '') === want);
    out.textContent = found
      ? 'DNS: _lexicon.skiddle.id points at your account.'
      : `DNS: add a TXT record _lexicon.skiddle.id with "${want}" so other apps can find it.`;
  } catch {
    out.textContent = `DNS: other apps find the lexicon through a TXT record _lexicon.skiddle.id with "${want}".`;
  }
}

function setupLexicon(session: OAuthSession) {
  const button = el<HTMLButtonElement>('lexiconPublish');
  button.addEventListener('click', async () => {
    button.disabled = true;
    message('lexiconMessage', 'Publishing…');
    try {
      await putRecord(session, LEXICON, statusLexicon.id, { $type: LEXICON, ...statusLexicon });
      message('lexiconMessage', 'Published.', 'ok');
      await loadLexicon(session);
    } catch (err) {
      message('lexiconMessage', `Couldn't publish: ${errorText(err)}`, 'error');
    } finally {
      button.disabled = false;
    }
  });
}

// ---- Records overview ----

const SITE_COLLECTION = /^(id\.skiddle\.|site\.standard\.|com\.atproto\.lexicon\.)/;

async function loadRecords(session: OAuthSession) {
  const list = el('records');
  const repo = await xrpc<{ handle: string; collections: string[] }>(session, 'com.atproto.repo.describeRepo', { repo: DID });
  el('accountHandle').textContent = `@${repo.handle}`;
  const collections = repo.collections.filter((c) => SITE_COLLECTION.test(c)).sort();
  const rows = await Promise.all(
    collections.map(async (collection) => {
      const page = await xrpc<{ records: unknown[]; cursor?: string }>(session, 'com.atproto.repo.listRecords', {
        repo: DID,
        collection,
        limit: '100',
      }).catch(() => null);
      const count = page ? `${page.records.length}${page.cursor && page.records.length === 100 ? '+' : ''}` : '?';
      return { collection, count };
    }),
  );
  list.replaceChildren(
    ...rows.map(({ collection, count }) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `https://pdsls.dev/at://${DID}/${collection}`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = collection;
      const n = document.createElement('span');
      n.className = 'admin-muted';
      n.textContent = `${count} ${count === '1' ? 'record' : 'records'}`;
      li.appendChild(a);
      li.appendChild(n);
      return li;
    }),
  );
  if (!rows.length) list.innerHTML = '<li class="admin-muted">No site records yet.</li>';
}

// ---- Start ----

async function signedIn(session: OAuthSession) {
  show('signedIn');
  el('accountHandle').textContent = session.sub;
  setupStatus(session);
  setupLexicon(session);
  const results = await Promise.allSettled([loadStatus(session), loadLexicon(session), loadRecords(session)]);
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) notice(`Couldn't load everything from your PDS: ${errorText(failed.reason)}`);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {});
}

async function main() {
  // The loopback client only accepts 127.0.0.1, not localhost
  if (location.hostname === 'localhost') {
    location.replace(`${location.protocol}//127.0.0.1${location.port ? `:${location.port}` : ''}${location.pathname}`);
    return;
  }
  registerServiceWorker();

  let session: OAuthSession | undefined;
  let ready = false;
  const options = {
    handleResolver: HANDLE_RESOLVER,
    // Only for the session in use, once the app has started: while a sign-in finishes, the client
    // clears any older session for the account and reports that as a deletion too
    onSessionDeleted: (sub: string) => {
      if (!ready || !session || sub !== session.sub) return;
      session = undefined;
      show('signedOut');
      notice('You were signed out (the sign-in expired or was revoked). Sign in again to keep going.');
    },
  };
  const client = isLoopback(location.hostname)
    ? await BrowserOAuthClient.load({ clientId: loopbackClientId(location.port), ...options })
    : new BrowserOAuthClient({ clientMetadata: clientMetadata(location.origin), ...options });

  try {
    session = (await client.init())?.session;
  } catch (err) {
    const cancelled = err instanceof OAuthCallbackError && err.params.get('error') === 'access_denied';
    notice(cancelled ? 'Sign-in cancelled on Bluesky’s page.' : `Sign-in didn't finish: ${errorText(err)}`);
  }
  // Drop any leftover sign-in response from the address bar
  if (location.hash || location.search) history.replaceState(null, '', location.pathname);

  el('signIn').addEventListener('click', async () => {
    const button = el<HTMLButtonElement>('signIn');
    button.disabled = true;
    button.textContent = 'Opening Bluesky…';
    try {
      await client.signInRedirect(DID);
    } catch (err) {
      // Back from Bluesky's page without signing in, or it couldn't start
      notice(`Sign-in didn't start: ${errorText(err)}`);
      button.disabled = false;
      button.textContent = 'Sign in with Bluesky';
    }
  });

  const signOut = async () => {
    const current = session;
    session = undefined;
    try {
      await current?.signOut();
    } catch {
      // Already gone on the server; forget it here anyway
    }
    location.reload();
  };
  el('signOut').addEventListener('click', signOut);
  for (const b of document.querySelectorAll('[data-sign-out]')) b.addEventListener('click', signOut);

  ready = true;
  if (!session) return show('signedOut');
  if (session.sub !== DID) {
    el('wrongDid').textContent = session.sub;
    el('accountHandle').textContent = session.sub;
    return show('wrongAccount');
  }
  await signedIn(session);
}

main().catch((err) => {
  show('signedOut');
  notice(`The admin app couldn't start: ${errorText(err)}`);
});
