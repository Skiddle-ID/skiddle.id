#!/usr/bin/env node
/**
 * Compares posts rendered from their AT Protocol records (src/lib/post-html.mjs) with the same posts
 * on a site built from git (Astro, Sätteri): the post body and its headings. Run while both exist,
 * before the switch to records (docs/v4/posts-on-atproto.md, step 4).
 *
 *   node scripts/check-render-parity.mjs [site]     default https://skiddle.id
 *
 * What counts as the same: see scripts/lib/html-compare.mjs. tests/parity.test.mjs compares whole
 * pages (a preview rendering from records against production built from git) in CI.
 */
import { DID, PUBLICATION_URI } from '../src/lib/standard-site.mjs';
import { renderPost } from '../src/lib/post-html.mjs';
import { firstDifference, headings as headingList, proseHtml, tokens } from './lib/html-compare.mjs';

const SITE = (process.argv[2] || 'https://skiddle.id').replace(/\/$/, '');

async function pdsFor(did) {
  const doc = await (await fetch(`https://plc.directory/${did}`)).json();
  return doc.service.find((s) => s.id === '#atproto_pds').serviceEndpoint.replace(/\/$/, '');
}

async function listRecords(pds, collection) {
  const out = [];
  let cursor = '';
  do {
    const res = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?repo=${DID}&collection=${collection}&limit=100${cursor ? `&cursor=${cursor}` : ''}`);
    const data = await res.json();
    out.push(...data.records);
    cursor = data.records.length ? (data.cursor ?? '') : '';
  } while (cursor);
  return out;
}

const pds = await pdsFor(DID);
const docs = (await listRecords(pds, 'site.standard.document')).filter(
  (r) => r.value.site === PUBLICATION_URI && r.value.content?.$type === 'id.skiddle.post',
);
let same = 0;
const problems = [];
for (const { value } of docs.sort((a, b) => a.value.path.localeCompare(b.value.path))) {
  const page = await (await fetch(`${SITE}${value.path}?parity=${Date.now()}`)).text();
  const built = proseHtml(page);
  if (built === undefined) {
    problems.push(`${value.path}: no post body found on ${SITE}`);
    continue;
  }
  const { html, headings } = renderPost(value.content.markdown, { images: value.content.images ?? [] });
  const diff = firstDifference(tokens(built), tokens(html));
  const builtHeadings = headingList(built);
  const ours = headings.map((h) => `${h.depth}#${h.slug} ${h.text}`);
  const headingDiff = builtHeadings.join('\n') !== ours.join('\n');
  if (!diff && !headingDiff) {
    same++;
    console.log(`  same  ${value.path}`);
    continue;
  }
  console.log(`  DIFF  ${value.path}`);
  if (diff) problems.push(`${value.path}: body differs at token ${diff.at}\n      built:   ${JSON.stringify(diff.a)}\n      records: ${JSON.stringify(diff.b)}`);
  if (headingDiff) problems.push(`${value.path}: headings differ\n      built:   ${JSON.stringify(builtHeadings)}\n      records: ${JSON.stringify(ours)}`);
}
console.log(`\n${same} of ${docs.length} posts render the same from records as on ${SITE}.`);
if (problems.length) {
  console.error(`\n${problems.join('\n')}`);
  process.exitCode = 1;
}
