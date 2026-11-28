/**
 * The home page's built-in text (src/data/home.ts), which it shows without its id.skiddle.page
 * record (homePageFromLegacy in src/lib/page-legacy.mjs). `intro` is Markdown.
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
