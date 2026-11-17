/**
 * skiddle-publisher: a small Worker, separate from the site, that publishes scheduled posts. A cron
 * trigger runs it every 5 minutes (wrangler.toml); the work is in publish.mjs.
 *
 * It signs in to Jeff's PDS with a Bluesky app password, kept as this Worker's secret
 * APP_PASSWORD, which Jeff sets himself (README.md). The site's Worker never has it. It only
 * signs in when a draft is due. Set DRY_RUN to "true" to log what it would publish without
 * changing anything.
 */
import { DID, SITE_URL } from '../../src/lib/standard-site.mjs';
import { publishDue } from './publish.mjs';

/**
 * @typedef {{ APP_PASSWORD?: string, DRY_RUN?: string }} Env
 */

export default {
  /**
   * @param {unknown} _controller
   * @param {Env} env
   */
  async scheduled(_controller, env) {
    await run(env);
  },

  /** Not reachable from the web (workers_dev = false); answers if it ever is */
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};

/** @param {Env} env */
export async function run(env) {
  const dryRun = env.DRY_RUN === 'true';
  const log = (/** @type {string} */ line) => console.log(line);
  try {
    const pds = await connect(env);
    const results = await publishDue({ pds, site, dryRun, log });
    if (!results.length) return;
    const failed = results.filter((r) => r.status === 'failed').length;
    log(`${dryRun ? 'Dry run: ' : ''}${results.length} due, ${failed} failed`);
  } catch (err) {
    console.error(`Couldn't check for scheduled posts: ${err instanceof Error ? err.message : err}`);
  }
}

/** The site, at https://skiddle.id (a Custom Domain, so a plain fetch reaches its Worker) */
const site = {
  async revalidate() {
    await fetch(`${SITE_URL}/api/revalidate`, { method: 'POST' }).catch(() => undefined);
  },
  /** @param {string} path */
  async waitLive(path) {
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${SITE_URL}${path}?live=${Date.now()}`).catch(() => undefined);
      if (res?.ok) return;
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error(`${SITE_URL}${path} didn't come up within 30 seconds`);
  },
};

class XrpcError extends Error {
  /**
   * @param {number} status
   * @param {string | undefined} error
   * @param {string} message
   */
  constructor(status, error, message) {
    super(message);
    this.status = status;
    this.error = error;
  }
}

/**
 * @param {string} base The PDS
 * @param {string} method
 * @param {{ params?: Record<string, string>, body?: unknown, token?: string }} [options]
 */
async function xrpc(base, method, { params, body, token } = {}) {
  const res = await fetch(`${base}/xrpc/${method}${params ? `?${new URLSearchParams(params)}` : ''}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = /** @type {any} */ (await res.json().catch(() => ({})));
  if (!res.ok) throw new XrpcError(res.status, data.error, `${method}: ${data.message || data.error || res.status}`);
  return data;
}

/**
 * The PDS (looked up from the DID, so a move to another PDS just works), read in public and
 * written with a session from the app password
 * @param {Env} env
 * @returns {Promise<import('./publish.mjs').Pds>}
 */
async function connect(env) {
  const did = /** @type {any} */ (await (await fetch(`https://plc.directory/${DID}`)).json());
  const base = did.service?.find((/** @type {any} */ s) => s.id === '#atproto_pds')?.serviceEndpoint;
  if (!base) throw new Error(`no PDS in ${DID}'s DID document`);
  return {
    async list(collection) {
      const out = [];
      let cursor = '';
      do {
        const page = await xrpc(base, 'com.atproto.repo.listRecords', { params: { repo: DID, collection, limit: '100', ...(cursor ? { cursor } : {}) } });
        out.push(...page.records);
        cursor = page.records.length ? (page.cursor ?? '') : '';
      } while (cursor);
      return out;
    },
    async get(collection, rkey) {
      try {
        return await xrpc(base, 'com.atproto.repo.getRecord', { params: { repo: DID, collection, rkey } });
      } catch (err) {
        if (err instanceof XrpcError && (err.error === 'RecordNotFound' || err.status === 404)) return null;
        throw err;
      }
    },
    async signIn() {
      if (!env.APP_PASSWORD) throw new Error('the APP_PASSWORD secret isn’t set (README.md)');
      const { accessJwt: token } = await xrpc(base, 'com.atproto.server.createSession', { body: { identifier: DID, password: env.APP_PASSWORD } });
      return {
        create: (collection, rkey, record) => xrpc(base, 'com.atproto.repo.createRecord', { token, body: { repo: DID, collection, rkey, record } }),
        put: (collection, rkey, record, swapRecord) => xrpc(base, 'com.atproto.repo.putRecord', { token, body: { repo: DID, collection, rkey, record, swapRecord } }),
        remove: async (collection, rkey, swapRecord) => {
          await xrpc(base, 'com.atproto.repo.deleteRecord', { token, body: { repo: DID, collection, rkey, swapRecord } });
        },
      };
    },
  };
}
