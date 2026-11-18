/**
 * The pages' content as AT Protocol records (docs/v4/pages-on-atproto.md): projects, the CV,
 * services, uses and About, from today's data files in src/data/ to the shapes in
 * lexicons/id/skiddle/{project,cv,services,uses,about}.json.
 *
 * scripts/check-lexicons.mjs uses it to check that today's data fits the lexicons. The import that
 * writes the records will use it too. Every field is either mapped or refused, so nothing is
 * dropped without anyone noticing.
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
