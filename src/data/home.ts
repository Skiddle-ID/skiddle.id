/**
 * The home page's built-in text: what it shows for each field the id.skiddle.home record leaves out,
 * or for all of them until there's a record (src/lib/page-content.ts), and what the admin app's Home
 * editor starts from. The shape is the page's (src/types/home.ts).
 */
import type { Home } from '~/types/home';

export const FALLBACK_HOME: Home = {
  title: 'Skiddle — protocol engineer in Bangkok',
  description:
    'Jeff (Skiddle) — protocol engineer and founder of Skiddle Labs in Bangkok, with a background in delivery pipelines and self-hosted infrastructure. I write about it, and I fly as a private pilot.',
  greeting: "Hi, I'm Jeff. Known as Skiddle.",
  tagline: 'Protocol engineer · Founder of Skiddle Labs · Bangkok',
  intro: [
    "I run Skiddle Labs, my own company. Right now my team and I are on a protocol-engineering contract for a client I can't name. My background is delivery pipelines and keeping infrastructure running across the cloud and my homelab. If I have to do something twice, I'd rather write a small tool for it.",
    "I'm a fan of open source and open protocols like ATProto, and I write here about infra, the open web, homelab experiments and life, including flying.",
  ].join('\n\n'),
  selectedProjects: ['checkdomain', 'shortlink', 'blocklist'],
  hire: {
    title: 'Need a hand with infrastructure?',
    blurb:
      "I help with server hardening, CI/CD, automation, monitoring and self-hosting. Tell me what you're working on and I'll reply with next steps.",
  },
  elsewhere: [
    { label: 'Bluesky', href: 'https://bsky.app/profile/skiddle.blue', me: true },
    { label: 'GitHub', href: 'https://github.com/arcestia', me: true },
    { label: 'Instagram', href: 'https://www.instagram.com/skiddle.id' },
    { label: 'Email', href: 'mailto:jeff@skiddle.id' },
    { label: 'RSS', href: '/rss.xml' },
  ],
};
