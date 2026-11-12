/**
 * Proof points shown on /services/ and /works/.
 * Every number here must come from the CV, projects or posts on this site.
 */
export interface Highlight {
  value: string;
  label: string;
  href?: string;
}

const highlights: Highlight[] = [
  { value: 'since 2020', label: 'helping clients through Skiddle ID, now part of Skiddle Labs' },
  { value: '3 years', label: 'as co-founder and DevOps engineer at Aerialite, a security startup' },
  { value: '60%', label: 'less deployment time after automating Aerialite’s releases' },
  {
    value: '~500M',
    label: 'requests a month served by my free CheckDomain API',
    href: '/posts/the-story-behind-taking-down-my-free-checkdomain-api/',
  },
];

export default highlights;
