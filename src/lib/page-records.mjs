/**
 * What the pages' blocks read from AT Protocol records (docs/v4/pages-on-atproto.md): the projects,
 * the services and testimonials, and the Now list, from the shapes in
 * lexicons/id/skiddle/{project,services,now}.json to the shapes the pages use (src/types/). The pages
 * read them through src/lib/page-content.ts; the admin app edits them (src/lib/admin/page-editor.ts).
 *
 * A record from the PDS is checked as it's read: a missing required field throws, and a field of
 * the wrong type, or a value the page doesn't know, is left out (scripts/page-records.test.mjs).
 * Until the v4 launch this module also turned the data files in src/data/ into records, for the
 * one-time import.
 */
import { DID } from './standard-site.mjs';

export const PROJECT_COLLECTION = 'id.skiddle.project';
export const SERVICES_COLLECTION = 'id.skiddle.services';
export const NOW_COLLECTION = 'id.skiddle.now';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A date's month and year, in UTC: "September 2025" */
export const monthYear = (/** @type {Date} */ d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/** A project's record's at:// address */
export const projectUri = (/** @type {string} */ rkey) => `at://${DID}/${PROJECT_COLLECTION}/${rkey}`;

const PROJECT_STATUSES = ['planned', 'in-progress', 'in-services', 'completed', 'archived'];
const PROJECT_CATEGORIES = ['app', 'api', 'library', 'tool', 'service', 'website', 'other'];

const str = (/** @type {unknown} */ v) => (typeof v === 'string' ? v : undefined);
/** A list of strings, or undefined if there's none (an optional field) */
const strs = (/** @type {unknown} */ v) => (Array.isArray(v) && v.length ? v.filter((s) => typeof s === 'string') : undefined);
/** The objects in a list; none if it isn't one */
const objects = (/** @type {unknown} */ v) => /** @type {Record<string, any>[]} */ (Array.isArray(v) ? v.filter((o) => o && typeof o === 'object') : []);
const oneOf = (/** @type {unknown} */ v, /** @type {string[]} */ allowed) => (typeof v === 'string' && allowed.includes(v) ? v : undefined);

/**
 * A required string field
 * @param {string} where
 * @param {Record<string, any>} from
 * @param {string} key
 */
function need(where, from, key) {
  const v = from?.[key];
  if (typeof v !== 'string' || !v) throw new Error(`${where}: no ${key}`);
  return v;
}

/**
 * The same object without its undefined fields
 * @template {Record<string, unknown>} T
 * @param {T} o
 * @returns {T}
 */
function defined(o) {
  return /** @type {T} */ (Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));
}

/**
 * A project, as the pages use it (src/types/projects.ts)
 * @param {string} rkey Its record key, the project's id
 * @param {Record<string, any>} v The record
 */
export function projectFromRecord(rkey, v) {
  const where = `project ${rkey}`;
  const t = v.tech && typeof v.tech === 'object' ? v.tech : {};
  const tech = defined({ languages: strs(t.languages), frameworks: strs(t.frameworks), tools: strs(t.tools), platforms: strs(t.platforms), databases: strs(t.databases) });
  return defined({
    id: rkey,
    name: need(where, v, 'name'),
    description: need(where, v, 'description'),
    impact: str(v.impact),
    highlights: strs(v.highlights),
    tags: strs(v.tags),
    tech: Object.keys(tech).length ? tech : undefined,
    year: Number.isInteger(v.year) ? v.year : undefined,
    status: oneOf(v.status, PROJECT_STATUSES),
    category: oneOf(v.category, PROJECT_CATEGORIES),
    featured: typeof v.featured === 'boolean' ? v.featured : undefined,
    homepage: str(v.homepage),
    github: str(v.source),
    writeup: str(v.writeup),
  });
}

/**
 * Every project, in the order they were added (createdAt, then record key); the pages sort them
 * from there
 * @param {{ uri: string, value: Record<string, any> }[]} records
 */
export function projectsFromRecords(records) {
  return records
    .map((r) => ({ rkey: r.uri.split('/').pop() ?? '', value: r.value }))
    .sort((a, b) => String(a.value.createdAt ?? '').localeCompare(String(b.value.createdAt ?? '')) || a.rkey.localeCompare(b.rkey))
    .map((r) => projectFromRecord(r.rkey, r.value));
}

/**
 * Services and testimonials, as the pages use them (src/types/services.ts)
 * @param {Record<string, any>} v The id.skiddle.services record
 */
export function servicesFromRecord(v) {
  const where = 'services';
  return {
    services: objects(v.services).map((s) =>
      defined({ name: need(where, s, 'name'), description: need(where, s, 'description'), features: strs(s.features), category: str(s.category) }),
    ),
    testimonials: objects(v.testimonials)
      // A rating from 1 to 5, as the lexicon says
      .filter((t) => Number.isInteger(t.rating) && t.rating >= 1 && t.rating <= 5)
      .map((t) =>
        defined({
          quote: need(where, t, 'quote'),
          author: need(where, t, 'author'),
          role: str(t.role),
          serviceName: str(t.service) ?? '',
          rating: t.rating,
        }),
      ),
  };
}

/**
 * The Now page and the home page's Now list, as they use them (src/types/now.ts). An item that isn't
 * text is left out; the Markdown is kept as it is.
 * @param {Record<string, any>} v The id.skiddle.now record
 */
export function nowFromRecord(v) {
  const where = 'now';
  if (!Array.isArray(v.items)) throw new Error(`${where}: no items`);
  const updatedAt = need(where, v, 'updatedAt');
  if (Number.isNaN(Date.parse(updatedAt))) throw new Error(`${where}: updatedAt "${updatedAt}" isn't a date`);
  return defined({
    intro: str(v.intro) || undefined,
    items: objects(v.items)
      .map((i) => str(i.text))
      .filter((text) => !!text),
    updatedAt,
  });
}
