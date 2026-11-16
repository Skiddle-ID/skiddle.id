// CI: waits until Cloudflare has deployed a preview of this PR's head commit, then writes its URL
// to $GITHUB_OUTPUT (url=…). Cloudflare's bot keeps one comment on the PR with a row per commit
// (build and deployment status, the commit, a URL for exactly that version) and a line with the
// branch's preview URL and the commit it shows. The version URL is used if it answers; otherwise
// the branch URL, once it shows the head commit.
import { appendFileSync } from 'node:fs';

const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, HEAD_SHA, GITHUB_OUTPUT } = process.env;
const BOT = 'cloudflare-workers-and-pages[bot]';
const TIMEOUT_MS = 20 * 60 * 1000;
const started = Date.now();

async function botComment() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments?per_page=100`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return (await res.json()).filter((c) => c.user?.login === BOT).pop()?.body ?? '';
}

/** { url, build, deployment } for the head commit's row, if there is one */
function headRow(body) {
  for (const [, row] of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const sha = /<td>([0-9a-f]{7,40})<\/td>/.exec(row)?.[1];
    if (!sha || !HEAD_SHA.startsWith(sha)) continue;
    return {
      url: /href="(https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev)"/.exec(row)?.[1],
      build: /Build:<\/b>\s*([^<]+)/.exec(row)?.[1]?.trim() ?? '',
      deployment: /Deployment:<\/b>\s*([^<]+)/.exec(row)?.[1]?.trim() ?? '',
    };
  }
  return undefined;
}

/** The branch's preview URL, if the comment says it shows the head commit */
function branchUrl(body) {
  const m = /Preview URL:\s*(https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev)\s*\(commit ([0-9a-f]{7,40})\)/.exec(body);
  return m && HEAD_SHA.startsWith(m[2]) ? m[1] : undefined;
}

let last = '';
while (Date.now() - started < TIMEOUT_MS) {
  const body = await botComment().catch((e) => (console.log(e.message), ''));
  const row = headRow(body);
  const status = row ? `build ${row.build || '…'}, deployment ${row.deployment || '…'}` : 'no preview row for this commit yet';
  if (status !== last) console.log(`${HEAD_SHA.slice(0, 7)}: ${status}`);
  last = status;
  if (row && /fail/i.test(`${row.build} ${row.deployment}`)) {
    console.error('Cloudflare could not build or deploy the preview: see "Workers Builds: skiddle-id".');
    process.exit(1);
  }
  if (row && /success/i.test(row.deployment)) {
    for (const url of [row.url, branchUrl(body)].filter(Boolean)) {
      if (await fetch(url).then((r) => r.ok, () => false)) {
        console.log(`Preview: ${url}`);
        if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `url=${url}\n`);
        process.exit(0);
      }
    }
  }
  await new Promise((r) => setTimeout(r, 15_000));
}
console.error(`No preview of ${HEAD_SHA.slice(0, 7)} after ${TIMEOUT_MS / 60000} minutes.`);
process.exit(1);
