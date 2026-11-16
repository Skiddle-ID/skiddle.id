// Prints the Lighthouse scores from .lighthouseci/ (written by `lhci autorun`) as a Markdown table,
// for the workflow's job summary.
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('.lighthouseci/manifest.json', 'utf8'));
const pct = (n) => (typeof n === 'number' ? Math.round(n * 100) : '–');
console.log('### Lighthouse\n');
console.log('| Page | Performance | Accessibility | Best practices |');
console.log('|---|---|---|---|');
for (const run of manifest) {
  const s = run.summary ?? {};
  console.log(`| ${new URL(run.url).pathname} | ${pct(s.performance)} | ${pct(s.accessibility)} | ${pct(s['best-practices'])} |`);
}
console.log('\nSEO is skipped: previews are set to noindex on purpose.');
