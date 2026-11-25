/**
 * What Jeff is doing now, as /now/ and the home page read it from the id.skiddle.now record
 * (lexicons/id/skiddle/now.json, src/lib/page-content.ts). `intro` and each item are Markdown.
 */
export interface Now {
  /** Shown above the list on /now/ only */
  intro?: string;
  items: string[];
  /** When it was last updated, an ISO date */
  updatedAt: string;
}
