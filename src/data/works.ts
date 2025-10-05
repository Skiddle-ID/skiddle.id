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
    'DevOps engineer who codes end‑to‑end: building platforms, automating delivery and operations, and running networks across cloud and self‑hosted. Passionate about AI, and outside of work I love aviation and am working toward a first solo flight.'
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
            'Switching to Advisory Board Member, Not directly involved in day-to-day operations',
            'Supporting company to get their certification on ISO 9001 and ISO 27001',
          ],
        },
        {
          role: 'Co-Founder & DevOps Engineer',
          start: '2022',
          end: '2025',
          highlights: [
            'Building and maintaining CI/CD pipelines for multiple applications',
            'Managed infrastructure using Infrastructure as Code (IaC)',
            'Implemented monitoring and logging solutions',
            'Automated deployment processes and reduced deployment time by 60%',
            'Supporting company to get their certification on ISO 9001 and ISO 27001',
          ],
        },
      ],
    },
    {
      company: 'Skiddle ID',
      positions: [
        {
          role: 'Founder & CEO',
          start: '2020',
          end: 'Present',
          highlights: [
            'Developed and maintained web applications using multiple frameworks and technologies',
            'Supported infrastructure including server management, backup, and deployment',
            'Managed cloud services such as AWS, Cloudflare, and Proxmox',
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
            'Configured multi-device management (MDM) for company device management',
            'Automated backup processes and reduced backup time',
            'Setting up and maintaining company infrastructure',
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
      description: 'Built with Astro, integrated with ATProtocol for federated blogging',
      labels: ['Astro', 'TypeScript', 'ATProtocol', 'Cloudflare'],
      live: 'https://skiddle.id',
      github: 'https://github.com/arcestia',
    },
    {
      title: 'Home Lab Infrastructure',
      status: 'Ongoing',
      description: 'Self-hosted services running on Kubernetes cluster with automated backups and monitoring',
      labels: ['Kubernetes', 'Proxmox', 'TrueNAS', 'Monitoring'],
    },
  ],
  certifications: [
    { title: 'Private Pilot License (PPL) - In Progress', yearOrStatus: 'Expected Q1 2025' },
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
