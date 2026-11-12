import type { WorksData } from '../types/works';

const works: WorksData = {
  header: {
    name: 'Laurensius Jeffrey (Jeff)',
    title: 'DevOps Engineer',
    location: 'Bangkok, Thailand',
    email: 'jeff@skiddle.id',
    links: {
      github: 'https://github.com/arcestia',
      bluesky: 'https://bsky.app/profile/skiddle.blue',
    },
  },
  summary: [
    'DevOps engineer who codes end‑to‑end: building platforms, automating delivery and operations, and running networks across cloud and self‑hosted. Passionate about AI, and outside of work I’m a licensed private pilot (PPL, 2026).'
  ],
  experience: [
    {
      company: 'Aerialite',
      positions: [
        {
          role: 'Advisory Board Member',
          start: '2025',
          end: 'Present',
          highlights: [
            'Moved to the advisory board; no longer involved in day-to-day operations',
            'Advising on the company’s ISO 9001 and ISO 27001 certification',
          ],
        },
        {
          role: 'Co-Founder & DevOps Engineer',
          start: '2022',
          end: '2025',
          highlights: [
            'Built and maintained CI/CD pipelines for multiple applications',
            'Managed infrastructure using Infrastructure as Code (IaC)',
            'Implemented monitoring and logging',
            'Automated deployments, cutting deployment time by 60%',
            'Supported the company’s ISO 9001 and ISO 27001 certification work',
          ],
        },
      ],
    },
    {
      company: 'Skiddle Labs Pte. Ltd.',
      description: 'My own company for personal projects and long-term clients. Skiddle ID is part of Skiddle Labs.',
      positions: [
        {
          role: 'Founder & CEO',
          start: '2020',
          end: 'Present',
          highlights: [
            'Run my personal projects and long-term client work under one company, including the Skiddle ID brand',
            'Developed and maintained web applications using multiple frameworks and technologies',
            'Supported infrastructure, including server management, backups and deployment',
            'Managed cloud and virtualisation platforms such as AWS, Cloudflare and Proxmox',
            'Coordinated and supported client projects from start to finish',
          ],
        },
      ],
    },
    {
      company: 'Undisclosed Company',
      positions: [
        {
          role: 'Infra Engineer',
          start: '2019',
          end: '2020',
          highlights: [
            'Implemented LDAP integration for user authentication',
            'Configured mobile device management (MDM) for company devices',
            'Automated backups and reduced backup time',
            'Set up and maintained company infrastructure',
          ],
        },
      ],
    },
  ],
  education: [
    {
      degree: "Master's Degree in Artificial Intelligence and Machine Learning",
      school: 'Chulalongkorn University',
      start: '2024',
      end: 'Present',
      description: 'Continuing advanced studies in AI and ML with focus on deep learning, neural networks, and practical AI applications in industry.',
    },
    {
      degree: "Bachelor's Degree in Artificial Intelligence and Machine Learning",
      school: 'Chulalongkorn University',
      start: '2021',
      end: '2024',
      description: 'Focused on machine learning algorithms, data science, and AI applications. Graduated with GPA 4.0.',
    },
  ],
  skills: {
    programmingLanguages: ['TypeScript', 'Go', 'PHP', 'Rust', 'JavaScript', 'Python'],
    devopsInfrastructure: ['Docker', 'Kubernetes', 'Proxmox', 'Unraid', 'TrueNAS', 'CI/CD', 'Monitoring'],
    frameworksTools: ['Vue.js', 'React.js', 'Astro', 'Node.js', 'Git', 'Linux'],
    interests: ['Aviation', 'Machine Learning', 'Open Source', 'Self-hosting'],
  },
  projects: [
    {
      title: 'Personal Website & Blog',
      description: 'This site: Astro and Markdown, deployed to Cloudflare Workers, with a terminal-inspired design',
      labels: ['Astro', 'TypeScript', 'Tailwind CSS', 'Cloudflare Workers'],
      live: 'https://skiddle.id',
      github: 'https://github.com/Skiddle-ID/skiddle.id',
    },
    {
      title: 'Home Lab Infrastructure',
      status: 'Ongoing',
      description: 'Self-hosted services running on Kubernetes cluster with automated backups and monitoring',
      labels: ['Kubernetes', 'Proxmox', 'TrueNAS', 'Monitoring'],
    },
  ],
  certifications: [
    { title: 'Private Pilot License (PPL)', yearOrStatus: '2026' },
    { title: 'AWS Certified Machine Learning - Specialty', yearOrStatus: '2024' },
    { title: 'CompTIA Security+', yearOrStatus: '2023' },
    { title: 'Microsoft Certified: DevOps Engineer Expert', yearOrStatus: '2022' },
    { title: 'Microsoft Certified: Azure Fundamentals', yearOrStatus: '2022' },
    { title: 'AWS Certified Developer-Associate', yearOrStatus: '2021' },
    { title: 'AWS Certified Solutions Architect-Associate', yearOrStatus: '2021' },
    { title: 'Cisco Certified Internetwork Expert (CCIE)', yearOrStatus: '2021' },
    { title: 'Cisco Certified Security Professional (CCSP)', yearOrStatus: '2020' },
    { title: 'Cisco Certified Network Associate (CCNA)', yearOrStatus: '2020' },
  ],
};

export default works;
