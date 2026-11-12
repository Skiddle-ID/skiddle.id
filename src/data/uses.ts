/**
 * Everything on /uses/. Edit here; the page renders from this file.
 * Keep it vague on purpose: no hostnames, locations or storage sizes.
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

export const usesUpdated = 'September 2025';

const uses: UsesSection[] = [
  {
    id: 'machines',
    title: 'Machines',
    blurb: 'Where the work (and the games) happen.',
    groups: [
      {
        title: 'Desktops',
        items: [
          { name: 'Dev box', note: 'Arch Linux · Ryzen 9 7950X · RTX 4090' },
          { name: 'Gaming PC', note: 'Windows 11 · Ryzen 9 9950X3D · RTX 5090' },
        ],
      },
      {
        title: 'Laptops',
        items: [
          { name: 'Daily driver', note: 'MacBook Pro 16" · M3 Pro' },
          { name: 'On the go', note: 'ASUS ProArt P16 · AMD HX 370 · RTX 5070' },
        ],
      },
    ],
  },
  {
    id: 'homelab',
    title: 'Homelab',
    blurb: 'Self-hosted everything, because I like owning my own corner of the internet.',
    groups: [
      {
        title: 'Storage',
        items: [
          { name: 'Home NAS', note: 'Unraid · NVMe cache + HDD array' },
          { name: 'Off-site NAS', note: 'Unraid · backed up to Backblaze' },
        ],
      },
      {
        title: 'Compute',
        items: [
          { name: 'Pi cluster', note: '8× Raspberry Pi 4B · Kubernetes' },
          { name: 'Workstation', note: 'Threadripper PRO 9985WX · RTX 6000 Ada · Proxmox VE (now with Aerialite)' },
        ],
      },
      {
        title: 'Platform',
        items: [
          { name: 'Docker & Kubernetes', note: 'containers and orchestration' },
          { name: 'Proxmox VE & Unraid', note: 'virtualisation and storage' },
          { name: 'ZFS', note: 'storage pools' },
        ],
      },
      {
        title: 'Observability & backup',
        items: [
          { name: 'Prometheus & Grafana', note: 'metrics, dashboards, alerts' },
          { name: 'GitHub Actions', note: 'CI/CD and scheduled jobs' },
          { name: 'Backblaze', note: 'off-site backups' },
        ],
      },
    ],
  },
  {
    id: 'dev',
    title: 'Development',
    blurb: 'The daily toolbox.',
    groups: [
      {
        title: 'Editor & terminal',
        items: [
          { name: 'Zed', note: 'main editor', href: 'https://zed.dev' },
          { name: 'Neovim', note: 'quick edits', href: 'https://neovim.io' },
          { name: 'Ghostty', note: 'terminal on macOS and Linux', href: 'https://ghostty.org' },
          { name: 'Windows Terminal + WSL', note: 'on Windows' },
        ],
      },
      {
        title: 'Operating systems & browsers',
        items: [
          { name: 'Arch Linux', note: 'dev' },
          { name: 'macOS', note: 'daily' },
          { name: 'Windows 11', note: 'games' },
          { name: 'Zen Browser', note: 'plus Chrome Canary and Firefox Nightly' },
        ],
      },
      {
        title: 'Cloud',
        items: [
          { name: 'Cloudflare', note: 'Workers and KV — this site runs here' },
          { name: 'AWS & GCP' },
          { name: 'Vercel & Render' },
        ],
      },
      {
        title: 'Languages & data',
        items: [
          { name: 'TypeScript, Go, PHP, Python', note: 'plus Ruby and Rust' },
          { name: 'Astro, Vue, React, Svelte, Nuxt', note: 'web frameworks' },
          { name: 'Postgres, MySQL, Redis, Mongo', note: 'databases' },
        ],
      },
    ],
  },
  {
    id: 'creative',
    title: 'Writing & creative',
    groups: [
      {
        title: 'Writing',
        items: [
          { name: 'Astro + Markdown', note: 'this site' },
          { name: 'Obsidian', note: 'notes' },
        ],
      },
      {
        title: 'Design & video',
        items: [
          { name: 'Adobe Creative Cloud', note: 'design' },
          { name: 'DaVinci Resolve', note: 'video' },
          { name: 'OBS', note: 'recording and streaming' },
        ],
      },
      {
        title: 'Audio',
        items: [
          { name: 'Sony WH-1000XM4 & Sennheiser HD600', note: 'listening' },
          { name: 'AT2020, SM58 & Audient iD14', note: 'recording' },
          { name: 'Logic Pro & Audacity', note: 'editing' },
        ],
      },
    ],
  },
  {
    id: 'downtime',
    title: 'Downtime',
    groups: [
      {
        title: 'Play & watch',
        items: [
          { name: 'Steam & Epic', note: 'games' },
          { name: 'Netflix & YouTube', note: 'watching' },
        ],
      },
      {
        title: 'Read & listen',
        items: [
          { name: 'Kindle, Prime Reading & Audible', note: 'books' },
          { name: 'Spotify', note: 'scrobbled to Last.fm', href: 'https://www.last.fm/user/arcestia' },
        ],
      },
    ],
  },
  {
    id: 'aviation',
    title: 'Aviation',
    blurb: "Private pilot since early 2026. Here's what's in the flight bag.",
    groups: [
      {
        title: 'Planning',
        items: [
          { name: 'ForeFlight', note: 'flight planning' },
          { name: 'SkyVector', note: 'charts' },
        ],
      },
      {
        title: 'Weather & practice',
        items: [
          { name: 'Aviation Weather Center & Windy', note: 'weather' },
          { name: 'Flight simulators', note: 'practice at home' },
          { name: 'Cirrus SR22', note: 'aircraft' },
        ],
      },
    ],
  },
];

export default uses;
