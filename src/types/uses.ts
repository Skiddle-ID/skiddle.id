/**
 * The uses page's content, as the page reads it from its id.skiddle.uses record
 * (lexicons/id/skiddle/uses.json, src/lib/page-content.ts). Keep it vague on purpose: no
 * hostnames, locations or storage sizes.
 */
export interface UsesItem {
  name: string;
  note?: string;
  href?: string;
}
export interface UsesGroup {
  title: string;
  items: UsesItem[];
}
export interface UsesSection {
  id: string;
  title: string;
  blurb?: string;
  groups: UsesGroup[];
}
