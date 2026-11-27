/**
 * The site's built-in frame: the sidebar's menu and the footer's links, which the id.skiddle.site
 * record can replace (src/lib/site-meta.mjs), and the pages the command bar lists, with the words
 * that find them.
 */
import type { CommandPage, MenuItem, SiteLink } from '~/lib/site-meta.mjs';

export const FALLBACK_MENU: MenuItem[] = [
  { label: 'posts', href: '/posts/' },
  { label: 'notes', href: '/notes/' },
  { label: 'timeline', href: '/timeline/' },
  { label: 'about', href: '/about/' },
  { label: 'works', href: '/works/' },
  { label: 'projects', href: '/projects/' },
  { label: 'uses', href: '/uses/' },
  { label: 'services', href: '/services/' },
];

export const FALLBACK_FOOTER_LINKS: SiteLink[] = [
  { label: 'now', href: '/now/' },
  { label: 'rss', href: '/rss.xml' },
  { label: 'work@skiddle.id', href: 'mailto:work@skiddle.id' },
  { label: 'source', href: 'https://github.com/Skiddle-ID/skiddle.id' },
];

export const COMMAND_PAGES: CommandPage[] = [
  { href: '/', label: 'home', hint: 'start here', keywords: 'index start' },
  { href: '/posts/', label: 'posts', hint: 'everything I have written', keywords: 'blog articles writing archive' },
  { href: '/series/', label: 'series', hint: 'multi-part posts, in reading order', keywords: 'parts' },
  { href: '/topics/', label: 'topics', hint: 'posts by topic and tag', keywords: 'tags categories' },
  { href: '/about/', label: 'about', hint: 'who I am', keywords: 'me protocol engineer founder skiddle labs bangkok homelab open web private pilot flying' },
  { href: '/now/', label: 'now', hint: 'what I’m doing now', keywords: 'work study flying current focus' },
  { href: '/notes/', label: 'notes', hint: 'short posts from Bluesky', keywords: 'bluesky posts microblog thoughts #note' },
  { href: '/works/', label: 'works', hint: 'CV: experience, skills, certifications', keywords: 'resume cv experience skills projects education certifications jobs' },
  { href: '/projects/', label: 'projects', hint: 'open-source projects', keywords: 'open source apis automation tools code demos' },
  { href: '/uses/', label: 'uses', hint: 'hardware, software and tools', keywords: 'setup machines homelab dev creative tools flight bag gear' },
  { href: '/listening/', label: 'listening', hint: 'what I’ve been listening to', keywords: 'music now playing songs artists plays teal.fm spotify apple music last.fm' },
  { href: '/services/', label: 'services', hint: 'infrastructure help', keywords: 'hire server hardening ci/cd ansible automation monitoring self-hosting website setup' },
];
