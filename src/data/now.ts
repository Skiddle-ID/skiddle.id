/**
 * The built-in Now list: what /now/ and the home page show until there's an id.skiddle.now record in
 * Jeff's AT Protocol repo (src/lib/page-content.ts), and what the admin app's Now editor starts
 * from. Each item is one line of Markdown, as in the record.
 */
export const FALLBACK_NOW: string[] = [
  'Protocol engineering on contract for an undisclosed client, with my Skiddle Labs team (since Q3 2026)',
  'Advising Aerialite, the security & privacy startup I co-founded',
  "Studying for a master's in AI & machine learning at Chulalongkorn",
  'Flying as a newly licensed private pilot (PPL, early 2026). [How it started](/topics/tag/aviation/)',
];
