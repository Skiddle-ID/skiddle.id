/**
 * Post categories: the sections of the site, with their labels. Plain JavaScript so the admin
 * app's editor can use it in the browser; src/lib/posts.ts re-exports the labels.
 */

/** @typedef {'infra' | 'atproto' | 'homelab' | 'life'} Category */

/** @type {Record<Category, string>} */
export const categoryLabels = {
  infra: 'Infra & delivery',
  atproto: 'ATProto & the open web',
  homelab: 'Homelab',
  life: 'Life',
};
