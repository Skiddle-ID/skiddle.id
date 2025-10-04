import type { Project } from '../types/projects';

/**
 * Example project entries (copy and customize). Keep commented to avoid rendering on the site.
 *
 * const examples: Project[] = [
 *   {
 *     id: 'personal-api',
 *     name: 'Personal API',
 *     description: 'RESTful API for personal portfolio and information',
 *     shortDescription: 'Personal API built with Hono and TypeScript',
 *     longDescription: 'A comprehensive API built with Hono and TypeScript, deployed on Cloudflare Workers. Features include profile information, blog integration, and Spotify data.',
 *     tech: {
 *       languages: ['typescript'],
 *       frameworks: ['hono'],
 *       tools: ['wrangler'],
 *       platforms: ['cloudflare workers']
 *     },
 *     year: 2024,
 *     startDate: '2024-12',
 *     github: 'https://github.com/yourusername/personal-api',
 *     homepage: 'https://api.example.com',
 *     status: 'in-progress',
 *     category: 'api',
 *     featured: true,
 *     highlights: [
 *       'Built with Hono for optimal performance',
 *       'Deployed on Cloudflare Workers for global edge distribution',
 *       'RESTful API with comprehensive documentation',
 *       'Implements best practices for API security and CORS'
 *     ],
 *     tags: ['openapi', 'rest', 'edge']
 *   },
 *   {
 *     id: 'portfolio-web',
 *     name: 'Portfolio Website',
 *     description: 'Personal website with blog and projects',
 *     shortDescription: 'Astro + Tailwind portfolio',
 *     tech: {
 *       languages: ['typescript'],
 *       frameworks: ['astro'],
 *       tools: ['tailwindcss'],
 *       platforms: ['cloudflare pages']
 *     },
 *     year: 2025,
 *     github: 'https://github.com/yourusername/portfolio',
 *     homepage: 'https://yourdomain.tld',
 *     status: 'completed',
 *     category: 'website',
 *     highlights: [
 *       'Fast first contentful paint',
 *       'Accessible and SEO‑friendly',
 *       'Automatic sitemap and RSS'
 *     ],
 *     tags: ['seo', 'a11y']
 *   }
 * ];
 */

// Add your open-source projects here
const projects: Project[] = [
  {
    id: 'shortlink',
    name: 'Shortlink',
    description: 'A simple URL shortener service powered by Cloudflare Workers and Turso.',
    homepage: 'https://skiddle.link/',
    github: 'https://github.com/arcestia/shortlink/',
    tags: ['Cloudflare', 'Shortlink', 'Turso', 'Honojs'],
    tech: {
      languages: ['typescript', 'react'],
      platforms: ['Cloudflare Workers'],
    },
    year: 2025,
    status: 'completed',
    category: 'service',
    featured: true,
    highlights: [
      'Built with Hono for optimal performance',
      'Deployed on Cloudflare Workers for global edge distribution',
      'RESTful API with comprehensive documentation',
      'Implements best practices for API security and CORS'
    ]
  },
  {
    id: 'klasemate',
    name: 'Klasemate',
    description: 'Klasemate Open Source discussion board (Forum) Software.',
    github: 'https://github.com/Skiddle-ID/klasemate',
    tags: ['PHP', 'Native', 'Self-Learning', 'Open-Source'],
    tech: {
      languages: ['php', 'mysql'],
    },
    year: 2016,
    status: 'archived',
    category: 'app',
    highlights: [
      'First time building from scratch',
      'Written in object-oriented PHP',
      'MySQL Database'
    ]
  },
  {
    id: 'checkdomain',
    name: 'CheckDomain',
    description: 'Check Domain Blocked on Trust+ by Kominfo.',
    github: 'https://github.com/Skiddle-ID/checkdomain',
    tags: ['API', 'DNS-Blocking', 'Blocklist', 'Censorship'],
    tech: {
      languages: ['javascript'],
    },
    year: 2024,
    status: 'completed',
    category: 'api',
    highlights: [
      'Simple API for checking domain status',
      'Written in Node.js',
      'Runs on Cloudflare Workers'
    ]
  },
  {
    id: 'blocklist',
    name: 'Blocklist',
    description: 'Uncensored Kominfo blocklist taken automatically updated every hour.',
    github: 'https://github.com/Skiddle-ID/blocklist',
    tags: ['blocklist', 'internet-censorship', 'domains-list'],
    tech: {
      languages: ['bash'],
      tools: ['GithubActions'],
    },
    year: 2024,
    status: 'in-services',
    category: 'tool',
    highlights: [
      'Simple script for updating blocklist',
      'Written in Bash',
      'Runs on Github Actions'
    ]
  },
  {
    id: 'proxylist',
    name: 'ProxyList',
    description: 'A proxy scraper | Proxy list - Updates every hours.',
    homepage: 'https://skiddle-id.github.io/proxylist',
    github: 'https://github.com/Skiddle-ID/proxylist',
    tags: ['proxy', 'proxy-list', 'proxy-scraper'],
    tech: {
      languages: ['javascript'],
      tools: ['GithubActions'],
    },
    year: 2024,
    status: 'in-services',
    category: 'tool',
    highlights: [
      'Simple script for updating proxy list',
      'Written in JavaScript',
      'Runs on Github Actions'
    ]
  },
  {
    id: 'domainchecker',
    name: 'DomainChecker',
    description: 'A Fast Domain Block Checker /w Hono & Cloudflare Workers.',
    homepage: 'https://skiddle.link/checkdomain',
    github: 'https://github.com/Skiddle-ID/domainchecker',
    tags: ['domain-checker', 'hono', 'cloudflare-workers'],
    tech: {
      languages: ['typescript'],
      platforms: ['cloudflare workers'],
      frameworks: ['hono'],
      databases: ['turso'],
    },
    year: 2024,
    status: 'in-services',
    category: 'tool',
    highlights: [
      'Web application for checking domain status',
      'Written in TypeScript',
      'Runs on Cloudflare Workers'
    ]
  }
];

export default projects;