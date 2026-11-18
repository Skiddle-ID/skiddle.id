# skiddle-publisher

Publishes scheduled posts. Every 5 minutes it checks Jeff's AT Protocol repo for `id.skiddle.draft` records whose `publishAt` has passed. It publishes each one the way the admin app's **Publish** does:

1. writes the post (`site.standard.document`) with the share card stored on the draft
2. waits for the page
3. announces it on Bluesky and turns comments on
4. deletes the draft

It replaces three GitHub workflows: "Publish scheduled posts", "Announce posts on Bluesky" and "Publish posts to AT Protocol". The plan is in [docs/v4/posts-on-atproto.md](../../docs/v4/posts-on-atproto.md#scheduled-posts).

- [`publish.mjs`](publish.mjs): what it does, with the PDS and the site passed in
- [`publish.test.mjs`](publish.test.mjs): its tests (`npm run test:unit`, run in CI)
- [`index.mjs`](index.mjs): the Worker: the cron handler, the PDS and signing in
- [`wrangler.toml`](wrangler.toml): the cron (`*/5 * * * *`), no URL, logs on

It's a separate Worker from the site, so the site's Worker never holds the app password. It fits the free plan:
- one of the account's 5 cron triggers
- a few milliseconds of CPU a run
- about a dozen requests per post, and at most 2 posts a run

## Setting it up

At the v4 launch, step 8 of [the switch](../../docs/v4/switch.md). Not before: until v4 was production, the v3 sync deleted posts that git didn't have, so a post published from here would have disappeared again.

1. **An app password.** In Bluesky, go to Settings → Privacy and security → App passwords. Add one called `skiddle-publisher`. Don't tick direct messages.
2. **Deploy it.** Either:
   - **Workers Builds (recommended, so it redeploys with every merge):**
     - In the Cloudflare dashboard, create a Worker named `skiddle-publisher` from this repository.
     - Root directory: `workers/publisher`
     - Deploy command: `npx wrangler deploy --config wrangler.toml`
     - Production branch: the one skiddle.id is built from
   - **By hand:** `cd workers/publisher && npx wrangler deploy --config wrangler.toml`
3. **Give it the app password:** `npx wrangler secret put APP_PASSWORD --config wrangler.toml` from this folder. Paste it when asked. Only Cloudflare keeps it.
4. **Optional first run:**
   - Set `DRY_RUN = "true"` in `wrangler.toml` and deploy.
   - Schedule a draft a few minutes ahead.
   - Watch the Worker's logs: it says what it would publish.
   - Set it back to `"false"` and deploy.

Its logs (Workers & Pages → skiddle-publisher → Logs) show each post it publishes or skips, and why. A skipped draft stays as it is:
- no share card: schedule it again in the admin app
- its address is already a published post

A failed step is tried again 5 minutes later. It never publishes or announces twice. Each post and its Bluesky post get a record key made from the slug and the scheduled time, so a retry finds what's already there.
