/**
 * Everything on /about/ that's about Jeff, in the shape of its id.skiddle.about record
 * (lexicons/id/skiddle/about.json), which it becomes in v4. The page renders from this file. Keep
 * it to things you're happy to have public: a record goes out on the network.
 *
 * `intro` and `outside` are Markdown.
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

const about: About = {
  profile: [
    { label: 'Role', value: 'Protocol engineer (contract)' },
    { label: 'Company', value: 'Skiddle Labs (founder)' },
    { label: 'Based', value: 'Bangkok, Thailand' },
    { label: 'Hours', value: 'Night owl' },
    { label: 'Langs', value: 'Go, TypeScript, PHP, Python' },
    { label: 'Infra', value: 'Kubernetes, Proxmox, Cloudflare' },
    { label: 'Editor', value: 'Zed + Neovim' },
    { label: 'Terminal', value: 'Ghostty' },
    { label: 'Studying', value: "Master's in AI & ML" },
    { label: 'Flying', value: 'Private pilot (PPL, 2026)' },
    { label: 'Uptime', value: 'blogging since 2015' },
  ],
  intro: [
    "I'm **Jeff**, known online as **Skiddle**. I'm based in Bangkok and run **Skiddle Labs Pte. Ltd.**, my own company. Since Q3 2026, my team and I have been on a protocol-engineering contract for a client I can't name. My background is in platforms and infrastructure: building pipelines, automating ops, and keeping things running across cloud and my homelab.",
    "I co-founded **Aerialite**, a security and privacy startup here in Bangkok, and now sit on its advisory board. Skiddle Labs is also home to my personal projects and the clients I've worked with for years, and Skiddle ID is part of it. The full version is on my [CV](/works/), and the open-source bits are on [projects](/projects/).",
  ].join('\n\n'),
  principles: [
    { title: 'Automate the toil', body: 'A small tool beats doing the same manual step twice.' },
    { title: 'Reliability, security, cost', body: 'I weigh all three on every change, not just the first one.' },
    { title: 'Own your data', body: 'Open protocols and self-hosting, where it makes sense.' },
    { title: 'Share what I learn', body: 'I write up what I build, including the parts that went wrong.' },
  ],
  timeline: [
    { year: '2015', text: 'Started blogging, on Jekyll and GitHub Pages.', href: '/posts/a-newest-refactoring-of-my-personal-sites/', link: 'how the site evolved' },
    { year: '2016', text: 'Built Klasemate, my first app from scratch: open-source forum software in PHP.' },
    { year: '2019', text: 'First infra engineer role: LDAP, device management, backups.' },
    { year: '2020', text: 'Founded Skiddle ID, building web apps and running infrastructure for clients. It’s now part of Skiddle Labs.' },
    { year: '2021', text: "Started a bachelor's in AI & machine learning at Chulalongkorn." },
    { year: '2022', text: 'Co-founded Aerialite, a security & privacy startup in Bangkok, as DevOps engineer.' },
    { year: '2024', text: "Launched CheckDomain and Blocklist, and started my master's." },
    { year: '2025', text: "Moved to Aerialite's advisory board and started pilot ground school.", href: '/posts/how-it-all-started-1/', link: 'the flying story' },
    { year: '2026', text: 'Earned my Private Pilot License, then took on a protocol-engineering contract with my Skiddle Labs team.' },
  ],
  current: "Protocol engineering, my master's, and flying.",
  outside:
    "I have ADHD, and it doesn't stop me doing the work. I game, I read, and I keep odd hours. I'm also a private pilot: I earned my PPL in early 2026, and I write about [how that journey started](/topics/tag/aviation/). I care about open protocols and owning your own data, and I'm into ATProto. Curious what I run all this on? It's on the [uses](/uses/) page.",
  contact: {
    blurb: 'For work, email is best. For everything else, Bluesky is where I hang out.',
    links: [
      { label: 'work@skiddle.id', url: 'mailto:work@skiddle.id' },
      { label: '@skiddle.blue', url: 'https://bsky.app/profile/skiddle.blue' },
      { label: 'GitHub', url: 'https://github.com/arcestia' },
      { label: 'jeff@skiddle.id', url: 'mailto:jeff@skiddle.id' },
    ],
  },
};

export default about;
