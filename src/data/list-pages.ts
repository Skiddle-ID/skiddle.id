/**
 * The pages rendered on request (from the PDS): their title and description. The pages use them,
 * and so do their share cards (src/integrations/share-cards.ts), which can't read built HTML for
 * these pages. First the pages that list posts:
 */
export const LIST_PAGES = {
  posts: { title: 'Posts', description: "Everything I've written: infra, open protocols, homelab notes and life." },
  series: { title: 'Series', description: 'Multi-part posts on skiddle.id, in reading order.' },
  topics: { title: 'Topics', description: 'Browse posts by topic and tag.' },
} as const;

/**
 * The other pages rendered on request from records: the pages' content (src/lib/page-content.ts)
 * and the listening history (src/lib/listening.ts). Their title, description, and the command their
 * share card shows (the page's own prompt, or a cd into it).
 */
export const CONTENT_PAGES = {
  projects: {
    title: 'Projects',
    description: 'Open-source projects by Jeff (Skiddle): APIs, automation and tools, with links to source code, live demos and the stories behind them.',
    command: 'ls -l projects/',
  },
  works: {
    title: 'Works & CV',
    description: 'CV of Laurensius Jeffrey (Skiddle) — protocol engineer in Bangkok with a DevOps background: experience, skills, projects, education and certifications.',
    command: 'cat cv.md',
  },
  services: {
    title: 'Services',
    description: 'Infrastructure help from Jeff (Skiddle): server hardening, CI/CD, Ansible automation, monitoring, self-hosting and website setup.',
    command: 'ls services/',
  },
  uses: {
    title: 'Uses',
    description: 'The hardware, software and tools Jeff (Skiddle) uses every day: machines, homelab, dev setup, creative tools and the flight bag.',
    command: 'cd ~/uses',
  },
  about: {
    title: 'About',
    description: 'About Jeff (Skiddle) — protocol engineer and founder of Skiddle Labs in Bangkok, homelabber, open-web fan and private pilot.',
    command: 'neofetch',
  },
  now: {
    title: 'Now',
    description: 'What Jeff (Skiddle) is doing now: work, study and flying.',
    command: 'cat now.md',
  },
  listening: {
    title: 'Listening',
    description: 'What Jeff (Skiddle) has been listening to: now playing, this week’s top artists and tracks, and every play, from teal.fm.',
    command: 'tail -n 50 plays.log',
  },
} as const;
