/**
 * The pages' content (docs/v4/pages-on-atproto.md) from its AT Protocol records: projects, the CV,
 * services, uses, About, Now and the home page, from the shapes in lexicons/id/skiddle/{project,cv,services,uses,about,now,home}.json
 * to the shapes the pages use (src/types/). The pages read them through src/lib/page-content.ts;
 * the admin app edits them (src/lib/admin/page-editor.ts).
 *
 * A record from the PDS is checked as it's read: a missing required field throws, and a field of
 * the wrong type, or a value the page doesn't know, is left out (scripts/page-records.test.mjs).
 * Until the v4 launch this module also turned the data files in src/data/ into records, for the
 * one-time import.
 */
import { DID } from './standard-site.mjs';

export const PROJECT_COLLECTION = 'id.skiddle.project';
export const CV_COLLECTION = 'id.skiddle.cv';
export const SERVICES_COLLECTION = 'id.skiddle.services';
export const USES_COLLECTION = 'id.skiddle.uses';
export const ABOUT_COLLECTION = 'id.skiddle.about';
export const NOW_COLLECTION = 'id.skiddle.now';
export const HOME_COLLECTION = 'id.skiddle.home';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
 * The CV and its highlights, as the pages use them (src/types/works.ts, src/types/highlights.ts)
 * @param {Record<string, any>} v The id.skiddle.cv record
 */
export function cvFromRecord(v) {
  const where = 'the CV';
  const links = v.links && typeof v.links === 'object' ? v.links : {};
  const projectPrefix = `at://${DID}/${PROJECT_COLLECTION}/`;
  const works = {
    header: {
      name: need(where, v, 'name'),
      title: need(where, v, 'title'),
      location: str(v.location) ?? '',
      email: str(v.email) ?? '',
      links: defined({ github: str(links.github), bluesky: str(links.bluesky) }),
    },
    summary: strs(v.summary) ?? [],
    experience: objects(v.experience).map((c) =>
      defined({
        company: need(where, c, 'company'),
        description: str(c.description),
        positions: objects(c.positions).map((p) =>
          defined({
            role: need(`${c.company}`, p, 'role'),
            start: need(`${c.company}, ${p.role}`, p, 'start'),
            // No end: still the role
            end: str(p.end) ?? 'Present',
            highlights: strs(p.highlights) ?? [],
            employment: str(p.employment),
            client: str(p.client),
          }),
        ),
      }),
    ),
    education: objects(v.education).map((e) =>
      defined({ degree: need(where, e, 'degree'), school: need(where, e, 'school'), start: str(e.start), end: str(e.end), description: str(e.description) }),
    ),
    skills: objects(v.skills).map((g) => ({ title: need(where, g, 'title'), items: strs(g.items) ?? [] })),
    // Only this repo's projects, by their ids
    selectedProjects: (strs(v.selectedProjects) ?? []).filter((uri) => uri.startsWith(projectPrefix)).map((uri) => uri.slice(projectPrefix.length)),
    projects: objects(v.projects).map((p) =>
      defined({
        title: need(where, p, 'title'),
        description: need(where, p, 'description'),
        labels: strs(p.labels) ?? [],
        live: str(p.live),
        github: str(p.source),
        status: str(p.status),
      }),
    ),
    certifications: objects(v.certifications).map((c) => ({ title: need(where, c, 'title'), yearOrStatus: need(`${where}, ${c.title}`, c, 'when') })),
  };
  const highlights = objects(v.highlights).map((h) => defined({ value: need(where, h, 'value'), label: need(where, h, 'label'), href: str(h.href) }));
  return { works, highlights };
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
 * The uses page, as it uses it (src/types/uses.ts): its sections, and when it was last updated as a month
 * and year ("September 2025"), from the record's updatedAt
 * @param {Record<string, any>} v The id.skiddle.uses record
 */
export function usesFromRecord(v) {
  const where = 'uses';
  const updated = new Date(need(where, v, 'updatedAt'));
  if (Number.isNaN(updated.valueOf())) throw new Error(`${where}: updatedAt "${v.updatedAt}" isn't a date`);
  return {
    uses: objects(v.sections).map((s) =>
      defined({
        id: need(where, s, 'id'),
        title: need(where, s, 'title'),
        blurb: str(s.blurb),
        groups: objects(s.groups).map((g) => ({
          title: need(`${where} ${s.id}`, g, 'title'),
          items: objects(g.items).map((i) => defined({ name: need(`${where} ${s.id}`, i, 'name'), note: str(i.note), href: str(i.href) })),
        })),
      }),
    ),
    usesUpdated: `${MONTHS[updated.getUTCMonth()]} ${updated.getUTCFullYear()}`,
  };
}

/**
 * The About page, as it uses it (src/types/about.ts)
 * @param {Record<string, any>} v The id.skiddle.about record
 */
export function aboutFromRecord(v) {
  const where = 'about';
  const contact = v.contact && typeof v.contact === 'object' ? v.contact : {};
  return {
    profile: objects(v.profile).map((f) => ({ label: need(where, f, 'label'), value: need(where, f, 'value') })),
    intro: need(where, v, 'intro'),
    principles: objects(v.principles).map((p) => ({ title: need(where, p, 'title'), body: need(where, p, 'body') })),
    timeline: objects(v.timeline).map((t) => defined({ year: need(where, t, 'year'), text: need(where, t, 'text'), href: str(t.href), link: str(t.link) })),
    current: str(v.current) ?? '',
    outside: str(v.outside) ?? '',
    contact: {
      blurb: str(contact.blurb) ?? '',
      links: objects(contact.links).map((l) => ({ label: need(where, l, 'label'), url: need(where, l, 'url') })),
    },
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

/** A link the home page may show: a path on the site, or an https:, http: or mailto: URL */
const SAFE_HREF = /^(\/(?![/\\])|https?:\/\/|mailto:)/i;

/**
 * The home page's own text, from its record: only the fields it has, each checked, so the page
 * fills in the rest from src/data/home.ts. Unlike the other pages' records, nothing here is
 * required, and nothing throws: a field of the wrong type is left out. A selected project is kept
 * only if it's one of this repo's (its id), and a link only if its address is safe to link to.
 * @param {Record<string, any>} v The record
 */
export function homeFromRecord(v) {
  const projectPrefix = projectUri('');
  const hire = v.hire && typeof v.hire === 'object' ? defined({ title: str(v.hire.title) || undefined, blurb: str(v.hire.blurb) || undefined }) : {};
  const selected = (strs(v.selectedProjects) ?? []).filter((uri) => uri.startsWith(projectPrefix)).map((uri) => uri.slice(projectPrefix.length));
  const elsewhere = objects(v.elsewhere)
    .map((l) => defined({ label: str(l.label), href: str(l.href), me: l.me === true ? true : undefined }))
    .filter((l) => l.label && l.href && SAFE_HREF.test(l.href));
  return defined({
    title: str(v.title) || undefined,
    description: str(v.description) || undefined,
    greeting: str(v.greeting) || undefined,
    tagline: str(v.tagline) || undefined,
    intro: str(v.intro) || undefined,
    selectedProjects: selected.length ? selected : undefined,
    hire: Object.keys(hire).length ? hire : undefined,
    elsewhere: elsewhere.length ? elsewhere : undefined,
  });
}

/**
 * The home page's text: the id.skiddle.home record's fields over the built-in text, which fills in
 * any field the record leaves out, or all of them when there's no record
 * @param {Record<string, any> | null | undefined} record
 * @param {import('../types/home').Home} fallback src/data/home.ts
 * @returns {import('../types/home').Home}
 */
export function homeOf(record, fallback) {
  const mine = /** @type {Partial<import('../types/home').Home>} */ (record ? homeFromRecord(record) : {});
  return { ...fallback, ...mine, hire: { ...fallback.hire, ...mine.hire } };
}
