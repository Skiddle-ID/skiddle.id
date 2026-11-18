/**
 * The About page's content, as the page reads it from its id.skiddle.about record
 * (lexicons/id/skiddle/about.json, src/lib/page-content.ts). `intro` and `outside` are Markdown.
 */
export interface AboutFact {
  label: string;
  value: string;
}

export interface AboutPrinciple {
  title: string;
  body: string;
}

export interface AboutMilestone {
  year: string;
  text: string;
  href?: string;
  /** The link's text, so it says where it goes */
  link?: string;
}

export interface AboutContactLink {
  label: string;
  url: string;
}

export interface About {
  /** neofetch-style facts beside the avatar */
  profile: AboutFact[];
  intro: string;
  principles: AboutPrinciple[];
  /** Facts from the CV, projects and posts on this site, oldest first */
  timeline: AboutMilestone[];
  /** The timeline's last line: what Jeff is doing now */
  current: string;
  /** Outside of work */
  outside: string;
  contact: { blurb: string; links: AboutContactLink[] };
}
