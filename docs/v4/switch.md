# The switch: v4.0 goes live

The steps that make v4 production, in order, and who does each. Part of v4.0 ([ROADMAP.md](../../ROADMAP.md#the-v4-branch)). Everything before this is built and on staging:
- posts and series read from their records
- the pages read theirs
- the admin app's publishing, scheduling and editors
- the scheduler Worker and the backups

Steps marked **Jeff** happen in an account (Bluesky, Cloudflare, GitHub). The others are a PR or a check that Claude does, on Jeff's go.

## What the switch PR does

The switch PR goes into `v4`, and merging it is the moment of the switch. It:

- **Turns publishing on.** `PUBLISHING_LIVE = true` in `src/lib/admin/launch.ts`. The sign-in also asks for `site.standard.document`, `id.skiddle.series`, and create-only `app.bsky.feed.post` (`src/lib/admin/oauth.ts`).
- **Makes `v4` the production branch for builds.** `PRODUCTION_BRANCH` in `astro.config.mjs`: production builds are indexed, and previews aren't.
- **Removes the posts from git:**
  - `src/content/posts/`, `src/assets/posts/`, `src/content.config.ts` and `src/data/series.ts`
  - MDX (`@astrojs/mdx`)
  - drawing share cards for posts at build time
  - the git fallback in the post pages, the lists and the feed
- **Removes git publishing:**
  - the workflows "Announce posts on Bluesky", "Publish posts to AT Protocol" and "Publish scheduled posts"
  - their scripts: `bluesky-announce`, `standard-site-sync`, `mark-updated`, `publish-scheduled`
  - the render parity script
- **Removes the pages' data files:**
  - `src/data/{projects,works,highlights,services,uses,about}.ts`
  - the pages' fallback to them
  - the one-time import in the admin app
  - the types that lived in those files move to `src/types/`
- **Removes the parity test,** since production and previews now render from the same records.
- **Post pages:** "Suggest an edit" (a GitHub link to a file that no longer exists) becomes **View the record**, a link to the post's record on pdsls. "Updated" is plain text, no longer a link to the git history.
- **Points everything at `v4`:** the workflows, the footer's license links, robots.txt, the backup's restore link, the release drafter and the README.

## Before the day

1. **The last post from git.** Publish any post that's due on `v3`, and let its runs finish: "Announce posts on Bluesky", then "Publish posts to AT Protocol". After the switch, git has no posts, so a post merged into `v3` later wouldn't appear.
2. **Records match git.** The latest v4 PR's preview checks pass, parity included. That shows every post and page renders the same from its record as production does from git.
3. **Jeff: an app password for the scheduler.** Bluesky → Settings → Privacy and security → App passwords → add `skiddle-publisher`, without direct messages. Keep it for step 8.

## The switch

About half an hour. Steps 1–4 are the window where it matters that nothing is published from git.

1. **Merge `v3` into `v4` one last time** (a PR), so `v4` has every commit. If that brings new post files, the switch PR is updated to remove them too.
2. **Jeff: stop v3's publishing.** In GitHub → Actions, disable "Announce posts on Bluesky", "Publish posts to AT Protocol" and "Publish scheduled posts". From now on, nothing on `v3` can rewrite or delete records: the sync deletes the documents git doesn't have, which would include posts published from the admin app.
3. **Merge the switch PR.** `v4`'s staging build now has publishing on. Check it builds. Until step 4 the staging site counts as production, so it isn't marked noindex for those few minutes.
4. **Jeff: make `v4` production in Cloudflare.** Workers & Pages → skiddle-id → Settings → Build → production branch `v4`. Then retry the switch's build from the Worker's build history, so it deploys to skiddle.id.
5. **Check skiddle.id.**
   - The build meta is the switch commit.
   - Every page answers.
   - Posts and pages come from the records.
   - The admin app loads.
   - The feed, sitemap and search index list the posts.
6. **Jeff: make `v4` the default branch on GitHub.** Settings → General → Default branch. Scheduled workflows run from the default branch, so this starts the weekly backup and puts "Run workflow" buttons on `v4`'s workflows.
7. **Jeff: sign in to the admin app again** on skiddle.id. Bluesky's page asks for the new permissions: publishing posts and series, and creating the posts that announce them.
8. **Jeff: the scheduler.** Set it up from [`workers/publisher`](../../workers/publisher/README.md):
   - deploy it (Workers Builds, or `npx wrangler deploy --config wrangler.toml`)
   - give it the app password: `npx wrangler secret put APP_PASSWORD --config wrangler.toml`
   - its README has an optional dry run first
9. **Run the backup once by hand.** Actions → "Back up the AT Protocol repo" → Run workflow. Then check the `backups` release has `backup-<date>.tar.gz`, and that its `manifest.json` counts the records and blobs.
10. **Jeff: release v4.0.** The switch PR carries the `major` label, so Release Drafter's draft is v4.0. Publish it from GitHub → Releases. Then retry the latest build, so the footer shows it.
11. **Jeff: archive `v3`,** like `v1` and `v2`: lock the branch (Settings → Branches → a rule for `v3` → Lock branch).

## After

- **A save shows straight away.** Publish or edit something small and check it's on skiddle.id within seconds. Purging pages by tag couldn't be tested on workers.dev. If it doesn't work, pages still refresh within their minute.
- **Tick the launch checklist** in ROADMAP.md, and the switch steps in the plans.
- **The Tangled mirror** is still off. Its workflow mirrors whichever branch it's set to, so turning it on again means pointing it at `v4`.

## If something goes wrong

- **Before step 4,** nothing has changed for readers: production is still `v3`. Revert the switch PR in `v4`.
- **After step 4:**
  1. Set Cloudflare's production branch back to `v3` and redeploy its last build, or run `npx wrangler rollback`.
  2. `v3` still has every post up to the switch, and the records are untouched.
  3. Keep v3's three publishing workflows disabled. If they run, the sync deletes the records of any post published from the admin app in the meantime.
- **The PDS is down:** cached pages keep showing for up to a day. The backups have everything.
