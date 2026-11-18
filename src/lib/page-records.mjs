/**
 * The pages' content as AT Protocol records (docs/v4/pages-on-atproto.md): projects, the CV,
 * services, uses and About, from today's data files in src/data/ to the shapes in
 * lexicons/id/skiddle/{project,cv,services,uses,about}.json, and back.
 *
 * To records: scripts/check-lexicons.mjs checks that today's data fits the lexicons, and the admin
 * app's import (src/lib/admin/pages.ts) writes them. Every field is either mapped or refused, so
 * nothing is dropped without anyone noticing.
 *
 * From records (…FromRecord): the pages read them (src/lib/page-content.ts) in the same shapes as
 * the data files, so the templates don't change. A record from the PDS is checked as it's read: a
 * missing required field throws, and a field of the wrong type is left out. Going there and back
 * gives the data files exactly (scripts/page-records.test.mjs).
 */
import { DID } from './standard-site.mjs';

export const PROJECT_COLLECTION = 'id.skiddle.project';
export const CV_COLLECTION = 'id.skiddle.cv';
export const SERVICES_COLLECTION = 'id.skiddle.services';
export const USES_COLLECTION = 'id.skiddle.uses';
export const ABOUT_COLLECTION = 'id.skiddle.about';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const empty = (/** @type {unknown} */ v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * The listed fields of `from` that have a value, under the same names. Any other field is an error:
 * the lexicon has no place for it.
 * @param {string} where
 * @param {Record<string, unknown>} from
 * @param {string[]} allowed
 */
function fields(where, from, allowed) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(from)) {
    if (!allowed.includes(key)) throw new Error(`${where}: "${key}" has no place in the record`);
    if (!empty(value)) out[key] = value;
  }
  return out;
}

/** A project's record's at:// address */
export const projectUri = (/** @type {string} */ rkey) => `at://${DID}/${PROJECT_COLLECTION}/${rkey}`;

/**
 * One id.skiddle.project record per project, keyed by its id
 * @param {any[]} projects src/data/projects.ts
 * @param {string} at createdAt, an ISO date
 * @returns {Map<string, Record<string, unknown>>}
 */
export function projectRecords(projects, at) {
  const out = new Map();
  for (const project of projects) {
    const { id, github, tech, ...rest } = project;
    const where = `project ${id}`;
    if (out.has(id)) throw new Error(`${where}: two projects have this id`);
    out.set(id, {
      $type: PROJECT_COLLECTION,
      ...fields(where, rest, ['name', 'description', 'impact', 'highlights', 'tags', 'year', 'status', 'category', 'featured', 'homepage', 'writeup']),
      ...(tech ? { tech: fields(`${where}, tech`, tech, ['languages', 'frameworks', 'tools', 'platforms', 'databases']) } : {}),
      ...(github ? { source: github } : {}),
      createdAt: at,
    });
  }
  return out;
}

/**
 * The CV: id.skiddle.cv, with the highlights it shares with /services/
 * @param {any} works src/data/works.ts
 * @param {any[]} highlights src/data/highlights.ts
 * @param {string} at updatedAt
 */
export function cvRecord(works, highlights, at) {
  const { header, summary, experience, education, skills, selectedProjects, projects, certifications, ...other } = works;
  fields('the CV', other, []);
  const { links, ...person } = header;
  return {
    $type: CV_COLLECTION,
    ...fields('the CV header', person, ['name', 'title', 'location', 'email']),
    ...(links ? { links: fields('the CV links', links, ['github', 'bluesky']) } : {}),
    summary,
    highlights: highlights.map((h, i) => fields(`highlight ${i + 1}`, h, ['value', 'label', 'href'])),
    experience: experience.map((/** @type {any} */ company) => {
      const { positions, ...rest } = company;
      return {
        ...fields(company.company, rest, ['company', 'description']),
        positions: positions.map((/** @type {any} */ p) => {
          const { end, ...position } = p;
          return {
            ...fields(`${company.company}, ${p.role}`, position, ['role', 'employment', 'client', 'start', 'highlights']),
            // No end: still the role
            ...(end && end !== 'Present' ? { end } : {}),
          };
        }),
      };
    }),
    education: education.map((/** @type {any} */ e) => fields(e.school, e, ['degree', 'school', 'start', 'end', 'description'])),
    skills: skills.map((/** @type {any} */ g) => fields(`skills ${g.title}`, g, ['title', 'items'])),
    selectedProjects: selectedProjects.map(projectUri),
    projects: projects.map((/** @type {any} */ p) => {
      const { github, ...rest } = p;
      return { ...fields(p.title, rest, ['title', 'description', 'labels', 'live', 'status']), ...(github ? { source: github } : {}) };
    }),
    certifications: certifications.map((/** @type {any} */ c) => {
      const { yearOrStatus, ...rest } = c;
      return { ...fields(c.title, rest, ['title']), when: yearOrStatus };
    }),
    updatedAt: at,
  };
}

/**
 * Services and testimonials: id.skiddle.services
 * @param {any} data src/data/services.ts
 * @param {string} at updatedAt
 */
export function servicesRecord(data, at) {
  const { services, testimonials, ...other } = data;
  fields('services', other, []);
  return {
    $type: SERVICES_COLLECTION,
    services: services.map((/** @type {any} */ s) => fields(s.name, s, ['name', 'description', 'features', 'category'])),
    testimonials: testimonials.map((/** @type {any} */ t) => {
      const { serviceName, ...rest } = t;
      return { ...fields(`${t.author}'s testimonial`, rest, ['quote', 'author', 'role', 'rating']), ...(serviceName ? { service: serviceName } : {}) };
    }),
    updatedAt: at,
  };
}

/**
 * The uses page: id.skiddle.uses
 * @param {any[]} sections src/data/uses.ts
 * @param {string} updated When it was last updated, e.g. "September 2025"
 */
export function usesRecord(sections, updated) {
  const m = /^([A-Z][a-z]+) (\d{4})$/.exec(updated);
  const month = m ? MONTHS.indexOf(m[1]) : -1;
  if (!m || month < 0) throw new Error(`uses: "${updated}" isn't a month and year, like "September 2025"`);
  return {
    $type: USES_COLLECTION,
    sections: sections.map((/** @type {any} */ section) => {
      const { groups, ...rest } = section;
      return {
        ...fields(`uses ${section.id}`, rest, ['id', 'title', 'blurb']),
        groups: groups.map((/** @type {any} */ g) => {
          const { items, ...group } = g;
          return {
            ...fields(`uses ${section.id}, ${g.title}`, group, ['title']),
            items: items.map((/** @type {any} */ item) => fields(`uses ${item.name}`, item, ['name', 'note', 'href'])),
          };
        }),
      };
    }),
    updatedAt: new Date(Date.UTC(Number(m[2]), month, 1)).toISOString(),
  };
}

/**
 * The About page: id.skiddle.about
 * @param {any} about src/data/about.ts
 * @param {string} at updatedAt
 */
export function aboutRecord(about, at) {
  const { profile, principles, timeline, contact, ...rest } = about;
  return {
    $type: ABOUT_COLLECTION,
    ...fields('about', rest, ['intro', 'current', 'outside']),
    profile: profile.map((/** @type {any} */ f) => fields(`about ${f.label}`, f, ['label', 'value'])),
    principles: principles.map((/** @type {any} */ p) => fields(`about ${p.title}`, p, ['title', 'body'])),
    timeline: timeline.map((/** @type {any} */ t) => fields(`about ${t.year}`, t, ['year', 'text', 'href', 'link'])),
    contact: {
      ...fields('about contact', { blurb: contact.blurb }, ['blurb']),
      links: contact.links.map((/** @type {any} */ l) => fields(`about ${l.label}`, l, ['label', 'url'])),
    },
    updatedAt: at,
  };
}

// ---- From records, for the pages ----

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
 * The same object without its undefined fields, so it has the same keys as the data file
 * @template {Record<string, unknown>} T
 * @param {T} o
 * @returns {T}
 */
function defined(o) {
  return /** @type {T} */ (Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));
}

/**
 * A project as src/data/projects.ts has it
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
 * Every project, in the order they were added (createdAt, then record key). The import writes them
 * in the data file's order, and the pages sort them from there, as they do today.
 * @param {{ uri: string, value: Record<string, any> }[]} records
 */
export function projectsFromRecords(records) {
  return records
    .map((r) => ({ rkey: r.uri.split('/').pop() ?? '', value: r.value }))
    .sort((a, b) => String(a.value.createdAt ?? '').localeCompare(String(b.value.createdAt ?? '')) || a.rkey.localeCompare(b.rkey))
    .map((r) => projectFromRecord(r.rkey, r.value));
}

/**
 * The CV and its highlights, as src/data/works.ts and highlights.ts have them
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
 * Services and testimonials, as src/data/services.ts has them
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
 * The uses page, as src/data/uses.ts has it: its sections, and when it was last updated as a month
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
 * The About page, as src/data/about.ts has it
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
