import type { ServicesData } from '../types/services';

const servicesData: ServicesData = {
  services: [
    {
      name: 'Server Setup & Hardening',
      description: 'Provisioning, firewall/TLS, users, backups, and secure defaults on Linux servers.',
      features: ['Firewall, TLS, SSH and users', 'Backups & recovery drills', 'Baseline hardening'],
      category: 'infrastructure',
    },
    {
      name: 'CI/CD Implementation',
      description: 'Build/test/deploy pipelines with GitHub Actions or GitLab CI, environments, and releases.',
      features: ['GitHub Actions / GitLab CI', 'Multi‑env deployments', 'Release workflows'],
      category: 'devops',
    },
    {
      name: 'Automation with Ansible',
      description: 'Playbooks, roles, inventories, idempotent provisioning and repeatable ops.',
      features: ['Playbooks & roles', 'Inventories & secrets', 'Server fleet automation'],
      category: 'automation',
    },
    {
      name: 'Self‑Hosting & Homelab Consultation',
      description: 'Architecture, SSO, backups/restore, monitoring guidance, and safe internet exposure.',
      features: ['Reverse proxy & TLS', 'Single‑sign on (SSO)', 'Backups & monitoring guidance'],
      category: 'consulting',
    },
    {
      name: 'Website Project Setup (Custom or CMS)',
      description: 'From Astro/Next.js custom builds to CMS setups (e.g., WordPress, Ghost) with sensible defaults.',
      features: ['Astro / Next.js', 'WordPress / Ghost', 'Content & SEO basics'],
      category: 'web',
    },
    {
      name: 'Monitoring Setup (Grafana & Prometheus)',
      description: 'Dashboards, alerting, and metrics pipelines for actionable insights.',
      features: ['Grafana dashboards & panels', 'Prometheus scraping & exporters', 'Alertmanager routing & notifications'],
      category: 'observability',
    },
  ],
  testimonials: [
    {
      quote: 'Jeff helped us set up a firewall at the start of our project. After that we keep consulting with him for any security related issues.',
      author: 'Adhy Musaad',
      role: 'CTO, Kwikku Interactive',
      serviceName: 'Server Setup & Hardening',
      rating: 5,
    },
    {
      quote: 'Our website and mail setup was done in a matter of hours. Saved us a lot of time and money.',
      author: 'Jason Lim',
      role: 'Business Owner',
      serviceName: 'Website Project Setup (Custom or CMS)',
      rating: 5,
    },
    {
      quote: 'My homelab is messed before. After consulting with Jeff, it is now stable, monitored, and easy to maintain. Thanks a lot!',
      author: 'K. Tan',
      role: 'Indie Dev',
      serviceName: 'Self‑Hosting & Homelab Consultation',
      rating: 5,
    },
    {
      quote: 'Jeff helped me set up my website and mail server in a matter of hours. Even though He is my cousin, I still want to give him a big thank you.',
      author: 'N. Chen',
      role: 'Individual',
      serviceName: 'Website Project Setup (Custom or CMS)',
      rating: 5,
    },
  ],
};

export default servicesData;
