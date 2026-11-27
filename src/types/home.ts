/**
 * The home page's own text, as it reads it from the id.skiddle.home record
 * (lexicons/id/skiddle/home.json, src/lib/page-content.ts), with src/data/home.ts filling in any
 * field the record leaves out. `intro` is Markdown.
 */
export interface HomeLink {
  label: string;
  /** A path on the site, or an https:, http: or mailto: URL */
  href: string;
  /** One of Jeff's own profiles: rel="me" */
  me?: boolean;
}

export interface Home {
  title: string;
  description: string;
  greeting: string;
  tagline: string;
  intro: string;
  /** The projects' ids (their record keys), in order */
  selectedProjects: string[];
  hire: { title: string; blurb: string };
  elsewhere: HomeLink[];
}
