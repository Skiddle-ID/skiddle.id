/**
 * The admin app (/admin/), in the browser. Signs in with Jeff's Bluesky account over AT Protocol
 * OAuth (src/lib/admin/oauth.ts), then reads and writes records in his repo through his PDS:
 *   - the status (id.skiddle.status, key `self`), which /api/status.json and the home page read
 *   - the lexicons in lexicons/ (com.atproto.lexicon.schema, keyed by NSID), published from the app
 *   - drafts of posts (id.skiddle.draft), written in the editor (src/lib/admin/editor.ts)
 * and lists the site's other collections, read-only. One section at a time: Posts, Series, Status
 * and Site (src/lib/admin/sections.ts).
 */
import { BrowserOAuthClient, OAuthCallbackError, type OAuthSession } from '@atproto/oauth-client-browser';
import { DID } from '~/lib/standard-site.mjs';
import { MAX_CHARS as MAX, STATE_INFO, countChars, isState, stateOf, toneColour, type StatusState } from '~/lib/status-states.mjs';
import { el, errorText, message } from './dom';
import { loadPosts, route, setupPosts } from './editor';
import { clientMetadata, isLoopback, loopbackClientId } from './oauth';
import { XrpcError, getRecord, putRecord, xrpc, type RepoRecord } from './xrpc';

const STATUS = 'id.skiddle.status';
const LEXICON = 'com.atproto.lexicon.schema';
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



function validTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
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
  const count = countChars(v.text);
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
    if (countChars(v.text) > MAX) return message('statusMessage', `Keep it to ${MAX} characters.`, 'error');
    if (countChars(v.location) > MAX) return message('statusMessage', `Keep the location to ${MAX} characters.`, 'error');
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

// ---- Lexicons ----

interface LexiconDoc {
  lexicon: 1;
  id: string;
  [key: string]: unknown;
}
type LexiconState = 'new' | 'same' | 'changed';

/** Every lexicon in lexicons/, bundled at build time, by NSID */
const LEXICONS: LexiconDoc[] = Object.values(import.meta.glob<{ default: LexiconDoc }>('../../../lexicons/**/*.json', { eager: true }))
  .map((m) => m.default)
  .sort((a, b) => a.id.localeCompare(b.id));

const LEXICON_STATE_TEXT: Record<LexiconState, string> = {
  new: 'Not published yet',
  same: 'Published',
  changed: 'Published; the site’s copy has changed since',
};

/** The lexicons that are new or changed, as last loaded */
let pendingLexicons: LexiconDoc[] = [];

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

async function loadLexicons(session: OAuthSession) {
  const results = await Promise.all(
    LEXICONS.map(async (doc) => {
      const record = await getRecord<object>(session, LEXICON, doc.id);
      const state: LexiconState = !record ? 'new' : canonical(record.value) === canonical(doc) ? 'same' : 'changed';
      return { doc, state };
    }),
  );
  const list = el('lexicons');
  list.textContent = '';
  for (const { doc, state } of results) list.appendChild(lexiconRow(session, doc, state));

  pendingLexicons = results.filter((r) => r.state !== 'same').map((r) => r.doc);
  const all = el<HTMLButtonElement>('lexiconPublishAll');
  all.textContent = `Publish all ${pendingLexicons.length}`;
  all.hidden = pendingLexicons.length < 2;
  checkLexiconDns();
}

function lexiconRow(session: OAuthSession, doc: LexiconDoc, state: LexiconState) {
  const row = document.createElement('li');
  const name = document.createElement('code');
  name.textContent = doc.id;
  const text = document.createElement('span');
  text.className = state === 'same' ? 'admin-muted' : '';
  text.textContent = LEXICON_STATE_TEXT[state];
  row.appendChild(name);
  row.appendChild(text);
  if (state !== 'same') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-btn admin-btn-ghost';
    button.textContent = state === 'new' ? 'Publish' : 'Publish the new version';
    button.setAttribute('aria-label', `${button.textContent}: ${doc.id}`);
    button.addEventListener('click', () => publishLexicons(session, [doc], button));
    row.appendChild(button);
  }
  return row;
}

async function publishLexicons(session: OAuthSession, docs: LexiconDoc[], button: HTMLButtonElement) {
  button.disabled = true;
  message('lexiconMessage', 'Publishing…');
  const done: string[] = [];
  try {
    for (const doc of docs) {
      await putRecord(session, LEXICON, doc.id, { $type: LEXICON, ...doc });
      done.push(doc.id);
    }
    message('lexiconMessage', `Published ${done.join(', ')}.`, 'ok');
  } catch (err) {
    const left = docs.filter((d) => !done.includes(d.id)).map((d) => d.id);
    message('lexiconMessage', `Couldn't publish ${left.join(', ')}: ${errorText(err)}`, 'error');
  } finally {
    button.disabled = false;
  }
  await loadLexicons(session).catch(() => {});
}

/** The DNS names other apps look a lexicon up through: _lexicon.<its authority, reversed> */
const lexiconDnsNames = () =>
  [...new Set(LEXICONS.map((doc) => `_lexicon.${doc.id.split('.').slice(0, -1).reverse().join('.')}`))].sort();

/** Whether each _lexicon.<authority> TXT record points at the DID, so other apps can find the lexicons */
async function checkLexiconDns() {
  const out = el('lexiconDns');
  const want = `did=${DID}`;
  const lines = await Promise.all(
    lexiconDnsNames().map(async (name) => {
      try {
        const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${name}&type=TXT`, {
          headers: { Accept: 'application/dns-json' },
        });
        const data = (await res.json()) as { Answer?: { data: string }[] };
        const found = data.Answer?.some((a) => a.data.replace(/"/g, '') === want);
        return found ? `${name} points at your account.` : `add a TXT record ${name} with "${want}" so other apps can find them.`;
      } catch {
        return `other apps find them through a TXT record ${name} with "${want}".`;
      }
    }),
  );
  out.textContent = `DNS: ${lines.join(' ')}`;
}

function setupLexicons(session: OAuthSession) {
  const all = el<HTMLButtonElement>('lexiconPublishAll');
  all.addEventListener('click', () => publishLexicons(session, pendingLexicons, all));
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

/** @param signInAgain Starts a new sign-in, for permissions the session doesn't have yet */
async function signedIn(session: OAuthSession, signInAgain: () => void) {
  show('signedIn');
  el('accountHandle').textContent = session.sub;
  setupStatus(session);
  setupLexicons(session);
  setupPosts(session, signInAgain);
  const results = await Promise.allSettled([loadStatus(session), loadLexicons(session), loadRecords(session), loadPosts()]);
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) notice(`Couldn't load everything from your PDS: ${errorText(failed.reason)}`);
  await route();
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
    // A session from before the app asked for more permissions (on 127.0.0.1 they're part of the client ID)
    const outdated = /not issued to this client/i.test(errorText(err));
    notice(
      cancelled
        ? 'Sign-in cancelled on Bluesky’s page.'
        : outdated
          ? 'The app asks for new permissions since you last signed in here. Sign in again.'
          : `Sign-in didn't finish: ${errorText(err)}`,
    );
  }
  // Drop a leftover sign-in response from the address bar, but keep the app's own links (#draft/…)
  const isCallback = (s: string) => /(^|[?#&])(code|state|error|iss)=/.test(s);
  if (isCallback(location.hash) || isCallback(location.search)) history.replaceState(null, '', location.pathname);

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
  await signedIn(session, () => void client.signInRedirect(DID));
}

main().catch((err) => {
  show('signedOut');
  notice(`The admin app couldn't start: ${errorText(err)}`);
});
