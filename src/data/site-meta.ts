/**
 * The site's built-in metadata and frame (src/data/frame.ts): what every page uses for each field
 * the id.skiddle.site record leaves out, or for all of them until there's a record
 * (src/lib/site-meta.mjs), and what the admin app's Site editor starts from.
 */
import type { SiteMeta } from '~/lib/site-meta.mjs';
import { FALLBACK_FOOTER_LINKS, FALLBACK_MENU } from './frame';

export const FALLBACK_SITE: SiteMeta = {
  name: 'Skiddle',
  description: 'Jeff (Skiddle) — protocol engineer in Bangkok, writing about infra, open protocols, homelab and life.',
  keywords: [],
  author: {
    name: 'Laurensius Jeffrey',
    alternateName: 'Skiddle',
    jobTitles: ['Founder', 'Protocol Engineer'],
    worksFor: 'Skiddle Labs Pte. Ltd.',
    location: 'Bangkok, Thailand',
    knowsAbout: ['Protocol engineering', 'DevOps', 'Platform engineering', 'CI/CD', 'Cloudflare Workers', 'Kubernetes', 'Self-hosting', 'ATProto'],
  },
  profiles: ['https://bsky.app/profile/skiddle.blue', 'https://github.com/arcestia'],
  pages: [],
  menu: FALLBACK_MENU,
  footerLinks: FALLBACK_FOOTER_LINKS,
  hideMusic: false,
  hideThemeButtons: false,
};
