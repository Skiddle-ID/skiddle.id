#!/usr/bin/env node
/**
 * Sets Jeff's status: writes the `id.skiddle.status` record (key `self`) to his AT Protocol repo,
 * then adds a copy to the history, `id.skiddle.statusLog` (src/lib/status-log.mjs), which /status/ lists.
 * /status.svg, /api/status.json and the home page read it (src/lib/at-status.ts). Everything in an
 * AT Protocol repo is public.
 *
 *   npm run status -- --available --text "open to consulting"
 *   npm run status -- --busy --text "booked until March" --location Singapore --time-zone Asia/Singapore
 *   npm run status -- --state away --text "on holiday" --emoji 🏖️
 *
 * --state is available, busy, dnd (do not disturb) or away; --available and --busy are short for
 * the first two.
 *   npm run status -- --show               print the current record
 *   npm run status -- --publish-lexicon    publish lexicons/id/skiddle/status.json as a
 *                                          com.atproto.lexicon.schema record, so other apps can find it
 *
 * --location and --time-zone default to the current record's, else Bangkok / Asia/Bangkok.
 * --emoji sets one emoji shown instead of the dot; --no-emoji goes back to the dot; without either,
 * the current record's emoji stays.
 * --dry-run shows the record without writing it.
 *
 * Environment:
 *   BLUESKY_APP_PASSWORD  an app password for the account (not needed for --show or --dry-run)
 *   BLUESKY_IDENTIFIER    handle or DID, default skiddle.blue
 * Also run by .github/workflows/set-status.yml. No dependencies.
 */
import { readFileSync } from 'node:fs';
import { DID } from '../src/lib/standard-site.mjs';
import { STATUS_LOG_COLLECTION, logEntryOf } from '../src/lib/status-log.mjs';
import { MAX_CHARS as MAX, STATES, countChars, isEmoji, isState } from '../src/lib/status-states.mjs';

const COLLECTION = 'id.skiddle.status';
const LEXICON_FILE = 'lexicons/id/skiddle/status.json';
const DEFAULTS = { location: 'Bangkok', timeZone: 'Asia/Bangkok' };

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};

async function main() {
  const pds = await resolvePds(DID);

  if (flag('show')) {
    console.log(JSON.stringify((await getRecord(pds, COLLECTION, 'self')) ?? 'No status record yet.', null, 2));
    return;
  }

  if (flag('publish-lexicon')) {
    const lexicon = JSON.parse(readFileSync(LEXICON_FILE, 'utf8'));
    const record = { $type: 'com.atproto.lexicon.schema', ...lexicon };
    if (flag('dry-run')) return console.log(`DRY RUN: would write com.atproto.lexicon.schema/${lexicon.id}:\n${JSON.stringify(record, null, 2)}`);
    await putRecord(pds, 'com.atproto.lexicon.schema', lexicon.id, record);
    console.log(`Published the ${lexicon.id} lexicon.`);
    console.log(`For other apps to find it, add a DNS TXT record: _lexicon.skiddle.id  "did=${DID}"`);
    return;
  }

  const chosen = [flag('available') && 'available', flag('busy') && 'busy', option('state')].filter(Boolean);
  if (chosen.length !== 1) throw new Error(`Say one of --available, --busy or --state <${STATES.join('|')}>`);
  const state = chosen[0];
  if (!isState(state)) throw new Error(`Unknown state: ${state} (use ${STATES.join(', ')})`);
  const text = option('text')?.trim();
  if (!text) throw new Error('Say what the status is: --text "open to consulting"');
  const current = (await getRecord(pds, COLLECTION, 'self'))?.value ?? {};
  const given = option('emoji')?.trim();
  if (given !== undefined && !isEmoji(given)) throw new Error(`--emoji takes one emoji, like ✈️ (got "${given}")`);
  const emoji = flag('no-emoji') ? undefined : (given ?? (isEmoji(current.emoji) ? current.emoji : undefined));
  const record = {
    $type: COLLECTION,
    state,
    available: state === 'available',
    text,
    ...(emoji ? { emoji } : {}),
    location: (option('location') ?? current.location ?? DEFAULTS.location).trim(),
    timeZone: (option('time-zone') ?? current.timeZone ?? DEFAULTS.timeZone).trim(),
    updatedAt: new Date().toISOString(),
  };
  if (countChars(record.text) > MAX) throw new Error(`--text is longer than ${MAX} characters`);
  if (countChars(record.location) > MAX) throw new Error(`--location is longer than ${MAX} characters`);
  try {
    new Intl.DateTimeFormat('en', { timeZone: record.timeZone });
  } catch {
    throw new Error(`Unknown time zone: ${record.timeZone} (use an IANA name like Asia/Bangkok)`);
  }

  if (flag('dry-run')) return console.log(`DRY RUN: would write ${COLLECTION}/self, and a copy in ${STATUS_LOG_COLLECTION}:\n${JSON.stringify(record, null, 2)}`);
  await putRecord(pds, COLLECTION, 'self', record);
  // The copy in the history; if it fails, the status is still set, and /status/ still shows it
  await createRecord(pds, STATUS_LOG_COLLECTION, logEntryOf(record)).catch((err) => console.warn(`The status is set, but adding it to the history failed: ${err.message}`));
  console.log(`Status set: ${record.state} · ${record.emoji ? `${record.emoji} ` : ''}${record.text} · ${record.location} (${record.timeZone})`);
  console.log('skiddle.id shows it within a minute.');
}

async function resolvePds(did) {
  const doc = await (await fetch(`https://plc.directory/${did}`)).json();
  const pds = doc.service?.find((s) => s.id === '#atproto_pds' || s.id === `${did}#atproto_pds`)?.serviceEndpoint;
  if (!pds) throw new Error(`No PDS in the DID document for ${did}`);
  return pds.replace(/\/+$/, '');
}

async function getRecord(pds, collection, rkey) {
  const res = await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?repo=${DID}&collection=${collection}&rkey=${rkey}`);
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new Error(`getRecord ${collection}/${rkey} failed (${res.status})`);
  return res.json();
}

let session;
async function putRecord(pds, collection, rkey, record) {
  session ??= await createSession(pds);
  const res = await fetch(`${pds}/xrpc/com.atproto.repo.putRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({ repo: DID, collection, rkey, record }),
  });
  if (!res.ok) throw new Error(`putRecord ${collection}/${rkey} failed (${res.status}): ${await res.text()}`);
}

/** A new record, under a key the PDS picks (a TID) */
async function createRecord(pds, collection, record) {
  session ??= await createSession(pds);
  const res = await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({ repo: DID, collection, record }),
  });
  if (!res.ok) throw new Error(`createRecord ${collection} failed (${res.status}): ${await res.text()}`);
}

async function createSession(pds) {
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!password) throw new Error('BLUESKY_APP_PASSWORD is not set');
  const identifier = process.env.BLUESKY_IDENTIFIER || 'skiddle.blue';
  const res = await fetch(`${pds}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
  const data = await res.json();
  if (data.did !== DID) throw new Error(`Logged in as ${data.did}, expected ${DID}`);
  return data;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
