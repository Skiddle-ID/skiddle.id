/**
 * The pages that list posts and are rendered on request (from the PDS): their title and
 * description. The pages use them, and so do their share cards (src/integrations/share-cards.ts),
 * which can't read built HTML for these pages.
 */
export const LIST_PAGES = {
  posts: { title: 'Posts', description: "Everything I've written: infra, open protocols, homelab notes and life." },
  series: { title: 'Series', description: 'Multi-part posts on skiddle.id, in reading order.' },
  topics: { title: 'Topics', description: 'Browse posts by topic and tag.' },
} as const;
