/**
 * Testimonials, as the home page's slider and the services page show them (from the
 * id.skiddle.services record, src/lib/page-records.mjs): which service each is about, the stars,
 * and the summaries. Plain JavaScript, so the tests can use it (scripts/testimonials.test.mjs).
 */
import { seriesSlug } from './post-record.mjs';

/**
 * @typedef {{ quote: string, author: string, role?: string, serviceName: string, rating: number }} Testimonial
 * @typedef {{ name: string }} Service
 */

/**
 * A service's name for comparing: letters and digits only, lower case, so "Self‑Hosting & Homelab
 * Consultation" (with a non-breaking hyphen) and "Self-hosting & homelab consultation" are the same
 */
export const serviceKey = (/** @type {string} */ name) =>
  name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The id of a service's card on /services/, for links to it: "service-ci-cd-implementation" */
export const serviceAnchor = (/** @type {string} */ name) => `service-${seriesSlug(name.normalize('NFKC')) || 'other'}`;

/**
 * The service a testimonial is about, if it names one of the services
 * @param {Service[]} services
 * @param {string} name
 * @returns {Service | undefined}
 */
export function serviceOf(services, name) {
  const key = serviceKey(name ?? '');
  return key ? services.find((s) => serviceKey(s.name) === key) : undefined;
}

/**
 * How many testimonials there are and their average rating, to one decimal ("5.0"), or null
 * @param {Pick<Testimonial, 'rating'>[]} testimonials
 */
export function ratingSummary(testimonials) {
  const rated = testimonials.filter((t) => Number.isInteger(t.rating) && t.rating >= 1 && t.rating <= 5);
  if (!rated.length) return null;
  const average = rated.reduce((sum, t) => sum + t.rating, 0) / rated.length;
  return { count: rated.length, average: average.toFixed(1) };
}

/** "★★★★☆" for 4 */
export const stars = (/** @type {number} */ rating) => {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
};

/** "1 review", "4 reviews" */
export const reviews = (/** @type {number} */ n) => `${n} ${n === 1 ? 'review' : 'reviews'}`;

/**
 * The testimonials grouped by what they're about, for the services page's filter: one group per
 * service that has any (in the services' order, then any other names, as written), each with its
 * key, label, the service's card anchor if it's one of the services, and its rating summary
 * @param {Testimonial[]} testimonials
 * @param {Service[]} services
 */
export function testimonialGroups(testimonials, services) {
  /** @type {Map<string, { key: string, label: string, anchor?: string, items: Testimonial[], order: number }>} */
  const groups = new Map();
  for (const t of testimonials) {
    const service = serviceOf(services, t.serviceName);
    const label = service?.name ?? t.serviceName?.trim();
    if (!label) continue;
    const key = serviceKey(label);
    const group = groups.get(key) ?? {
      key,
      label,
      ...(service ? { anchor: serviceAnchor(service.name) } : {}),
      items: [],
      order: service ? services.indexOf(service) : services.length + groups.size,
    };
    group.items.push(t);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ key, label, anchor, items }) => ({ key, label, ...(anchor ? { anchor } : {}), count: items.length, summary: ratingSummary(items) }));
}
