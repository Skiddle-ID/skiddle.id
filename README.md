# skiddle.id

My corner of the internet — [skiddle.id](https://skiddle.id) — by Jeff (Skiddle). Protocol engineer in Bangkok (Skiddle Labs), writing about infra, open protocols, homelab and life.

Built with [Astro](https://astro.build), deployed to [Cloudflare Workers](https://workers.cloudflare.com). Posts live in `src/content/posts` as Markdown, highlighted with Shiki at build time. Comments come from Bluesky replies.

## Updating the site

| To change… | Edit |
|---|---|
| A post | `src/content/posts/<slug>.md` (frontmatter schema in `src/content.config.ts`) |
| CV / works | `src/data/works.ts` |
| Projects, services, uses, highlights | `src/data/*.ts` |
| Pages and layout | `src/pages/`, `src/components/` |

New posts start with `draft: true`. They stay off the live site until it's `false`. A pull request's preview (`<branch>-skiddle-id.skiddle.workers.dev`) does show drafts, with a "Draft" banner, so you can read one before publishing it. Previews tell search engines not to index them, but anyone with the link can open them. Once a published post is merged into `v3`, it's announced on Bluesky automatically and gets its `bluesky: at://…` line, which shows replies as comments (see [Bluesky announcements](#bluesky-announcements)).

### Scheduling a post

Keep `draft: true` and add the time it should go live, with its offset:

```yaml
publishAt: 2026-11-20T09:00:00+07:00
draft: true
```

Merge it any time before then; its preview shows "Scheduled for Nov 20, 2026, 9:00 AM (Bangkok time)". Every hour, [Publish scheduled posts](.github/workflows/scheduled-publish.yml) (`scripts/publish-scheduled.mjs`) publishes the posts whose time has passed, oldest first. It sets `draft: false` and `pubDate` to the scheduled time, removes `publishAt`, and pushes to `v3`, which Cloudflare deploys. Then it starts the Bluesky announcement, which waits until the post is live. GitHub can start the hourly run a few minutes late. To move or cancel a post, change or remove `publishAt` before then. To publish due posts straight away, run the workflow by hand with dry run off.

### Updated dates

When a published post's text, title or description changes, the Bluesky workflow sets `updatedDate` to the time of the merge (`scripts/mark-updated.mjs`). The post then shows both dates, for example "Sep 30, 2025 · updated Nov 14, 2026", with "updated" linking to the post's history. The sitemap, the JSON-LD and the AT Protocol record get the new date too. Tags, series and other frontmatter don't count, and neither does publishing a draft. For a change that shouldn't count, like a typo fix, put `[skip updated]` in the PR title. You can also set `updatedDate` yourself in the PR.

### Bluesky announcements

`.github/workflows/bluesky-announce.yml` runs `scripts/bluesky-announce.mjs` after each push to `v3` that touches posts. For every post in the push that is published, has no `bluesky:` line and is at most 14 days old, it:

1. waits until the post is live
2. reuses a Bluesky post that already links to it (if you shared it by hand), or else posts the title and link with the share card as a link card
3. commits `bluesky: at://…` to the post, so comments turn on with the next deploy

To announce an older post, or try it safely: Actions → "Announce posts on Bluesky" → Run workflow, then enter the slug. Dry run is on by default.

Setup (once): create an app password in Bluesky (Settings → Privacy and security → App passwords), then store it with `gh secret set BLUESKY_APP_PASSWORD`.

### AT Protocol (Standard.site)

The posts are also published as AT Protocol records with the [Standard.site](https://standard.site) lexicons, so readers like Leaflet, pckt and docs.surf can find them: one `site.standard.publication` for skiddle.id and a `site.standard.document` per published post (title, path, description, dates, tags, plain text, share card and the Bluesky announcement).

- `.github/workflows/standard-site.yml` runs `scripts/standard-site-sync.mjs` after each "Announce posts on Bluesky" run on `v3`. It creates, updates or deletes records to match the published posts, and leaves records of other publications alone. It uses the same app password.
- The site proves it owns the records with `/.well-known/site.standard.publication` and `<link rel="site.standard.document">` on each post. Record keys are worked out from the posts (see `src/lib/standard-site.mjs`), so pages can link to a record before it exists.
- The six older posts with an `rkey:` were already published on pckt.blog under those keys. `MOVE_PCKT_DOCUMENTS` in `src/lib/standard-site.mjs` decides whether skiddle.id leaves them to pckt or takes them over.
- To check what would change: Actions → "Publish posts to AT Protocol" → Run workflow (dry run is on by default), or locally `DRY_RUN=1 SKIP_WAIT=1 node scripts/standard-site-sync.mjs` (no password needed).

**Avatars** are local, resized copies, so pages don't load full-size images from other sites. `public/avatars/bluesky.jpg` (224px, on the home page) comes from the Bluesky profile picture, and `public/avatars/github.jpg` (280px, on the about page) and `github-96.jpg` (96px, end of each post) from the GitHub one. To update one, save the new picture and resize it, e.g. `sips -z 224 224 -s format jpeg -s formatOptions 82 new.jpg --out public/avatars/bluesky.jpg`.

Every post gets a share card (the preview image on Bluesky, X, LinkedIn, chat apps) at `/og/posts/<slug>.png`, made at build time from its title, description, date and reading time. Other pages use `/og/site.png`. A post with a `.png`/`.jpg`/`.webp` `cover` uses that instead. The code is in `src/lib/share-card.ts` and `src/integrations/share-cards.ts`.

```sh
npm ci          # Node 24 (see .node-version), npm (see packageManager)
npm run dev     # http://localhost:4321
npm run build   # production build into dist/
npm run lint    # ESLint (eslint.config.js); also runs on every PR (.github/workflows/ci.yml)
```

### Admin app

`/admin/` is a small app for changing the site from a phone: sign in with the Bluesky account (AT Protocol OAuth), then set the status, publish its lexicon, and see which of the site's records are in the repo. Add it to the home screen to use it like an app (it's a PWA).

- It runs entirely in the browser (`src/lib/admin/app.ts`, with `@atproto/oauth-client-browser`). There's no server or database: the sign-in tokens stay on the device, and the app writes straight to the PDS.
- It may only write `id.skiddle.status` and `com.atproto.lexicon.schema` records; Bluesky's sign-in page shows that. The list is `COLLECTIONS` in `src/lib/admin/oauth.ts`. Adding a collection there means signing in again.
- Only @skiddle.blue can change the site: anyone else who signs in is told it's the wrong account, and couldn't write to Jeff's repo anyway.
- `/oauth-client-metadata.json` is the app's OAuth client ID. It's built from the host, so the app works on skiddle.id, the v4 staging site and previews. With `npm run dev`, open `http://127.0.0.1:4321/admin/`: the app uses AT Protocol's local-development client there, and its sign-in lasts a day.
- It has its own Content-Security-Policy, which also allows plc.directory, bsky.social and Bluesky's PDS hosts (`src/integrations/security-headers.ts`). After a move to another PDS, add its host there.
- Kept out of search engines (noindex, robots.txt) and the sitemap.

### Deploying

Merging into `v3` deploys automatically through [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/). Settings for the `skiddle-id` Worker (Workers & Pages → skiddle-id → Settings → Build):

- Git repository: `Skiddle-ID/skiddle.id`, production branch `v3`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy` (the default; it picks up the config Astro generates in `dist/server/`)
- Root directory: `/`, no build variables needed (Node comes from `.node-version`)

Secrets live in Cloudflare, not in the repo: `LASTFM_API_KEY` (`npx wrangler secret put LASTFM_API_KEY`). For local dev, put it in `.dev.vars`.

Manual deploy and rollback still work from any machine logged in with `npx wrangler login`: `npm run build && npm run deploy`, `npx wrangler rollback`.

### Releases

The footer shows the latest release tag reachable from the deployed commit (e.g. `v3.2`), linked to its GitHub release. [Release Drafter](.github/release-drafter.yml) keeps a draft of the next release (`v3.3`, …) under GitHub → Releases, with PRs sorted by their title prefix (`feat:`, `fix:`, `post:`, `chore:`, `docs:`). Rename and publish it when you're ready. Add a `major` label to a PR for a new major version.

Publishing a release only creates a tag, and tags don't trigger Workers Builds. So the footer picks up the new version on the next merge into `v3`. To show it straight away, either:

- re-run the latest build from the Worker's build history in the Cloudflare dashboard, or
- `git pull --tags && npm run build && npm run deploy` on a machine logged in with `npx wrangler login`.

## Checks

Every PR is checked on its own Cloudflare preview (the build of exactly that commit, drafts included) by [`.github/workflows/preview-checks.yml`](.github/workflows/preview-checks.yml). It waits for Cloudflare's bot comment to list the preview, then runs:

- `tests/theme.test.mjs`: the light / dark theme follows the device, remembers a pick, survives blocked storage
- `tests/pages.test.mjs`: every page (the sitemap, drafts and the 404 page) has no browser or CSP errors and no serious accessibility problems (axe, WCAG 2.1 AA); the home page and a post are also checked in dark
- `tests/links.test.mjs`: every same-site link, image, script and share card works (links to other sites aren't checked)
- Lighthouse ([`lighthouserc.json`](lighthouserc.json)): accessibility ≥ 95 and best practices ≥ 90 must pass; performance under 80 is a warning, because CI machines vary. SEO is skipped, since previews are noindex. The scores show in the job summary.

To run the tests yourself against any copy of the site (Chrome needed; set `CHROME_PATH` if it isn't found):

```bash
PREVIEW_URL=https://skiddle.id npm run test:preview
```

Or after a build, with `npm start` running, `npm run test:preview` checks http://localhost:8787.

## Embeds

Cards and badges in the site's terminal style, for a GitHub profile README, other sites or an email signature. The SVG cards take `?theme=auto` (default; follows the viewer's light / dark setting), `dark` or `light`, and `?accent=blue` (default), `teal`, `purple`, `pink` or `green`. They never show a broken image, and embeds revalidate on every view (no-cache plus an ETag). The shared drawing code is in `src/lib/embed-card.ts`.

### Latest post

`/latest.svg` shows the newest post: date, read time, series, title and description, with "new" for a week. It's drawn from `/latest.json`, which is built with the site, so it changes with each deploy.

```html
<a href="https://skiddle.id/posts/">
  <img src="https://skiddle.id/latest.svg" alt="Latest post on skiddle.id" width="540">
</a>
```

### Status badge

`/status.svg` reads "● open to consulting · Bangkok 14:32", with the local time when it loads. The status is the `id.skiddle.status` record in Jeff's AT Protocol repo ([lexicon](lexicons/id/skiddle/status.json)), read through `src/lib/at-status.ts`. That code looks up the PDS from the DID, caches the record for 60 seconds and falls back to `src/data/status.ts` if it can't be read. `/api/status.json` serves the same status, and the home page's status line updates from it.

To set it, open [`/admin/`](#admin-app) and sign in with Bluesky. Or, from a computer (with `BLUESKY_APP_PASSWORD` set):

```bash
npm run status -- --available --text "open to consulting"
```

`--busy` turns the dot grey. `--location` and `--time-zone` keep their current values unless given, `--show` prints the record and `--dry-run` writes nothing. From a phone, use the **Set status** workflow (GitHub → Actions → Set status → Run workflow). GitHub offers that button only for workflows on the default branch. Everything in an AT Protocol repo is public.

```html
<a href="https://skiddle.id/services/">
  <img src="https://skiddle.id/status.svg" alt="Open to consulting" height="28">
</a>
```

### Last.fm card

`/lastfm.svg` is a "now playing" card:

```html
<a href="https://www.last.fm/user/arcestia">
  <img src="https://skiddle.id/lastfm.svg" alt="Last.fm: now playing" width="540">
</a>
```

It always shows `LASTFM_USERNAME`, embeds the album art so it works inside `<img>`, and caches Last.fm for 30 seconds (artwork for 7 days). If Last.fm is down it shows "Nothing playing right now" instead of a broken image. The code is in `src/lib/lastfm.ts` (data) and `src/lib/lastfm-card.ts` (drawing).

### 88×31 button

The classic small web badge, for other sites to link here. It's rendered at build time with the site's font (`src/lib/share-card.ts`), at 1× and 2×:

```html
<a href="https://skiddle.id/"><img src="https://skiddle.id/88x31.png" srcset="https://skiddle.id/88x31-2x.png 2x" width="88" height="31" alt="skiddle.id"></a>
```

## License

- **Code:** MIT, see [LICENSE](LICENSE). Learn from it, reuse it.
- **Writing and images** (posts, drafts, post images, photos, and the text of the pages and data files): © Laurensius Jeffrey, all rights reserved, see [LICENSE-CONTENT.md](LICENSE-CONTENT.md). Quoting short excerpts with a link is fine; ask before republishing.
- **No AI training** on the writing. The site says so in [robots.txt](src/pages/robots.txt.ts) (a Content-Signal line, plus AI training crawlers turned away), in a `tdm-reservation` tag on every page, and in the RSS feed's copyright line. These are requests that well-behaved crawlers follow, not locks. Cloudflare's AI bot blocking (dashboard → AI Crawl Control) can enforce it at the edge.

## Credits & inspiration

This site started in 2025 from **[Hayden Young](https://bsky.app/profile/hayden.moe)'s** personal site, [hayden.moe](https://web.archive.org/web/2025/https://hayden.moe/) ([source](https://github.com/hbjydev/hayden.moe)). The terminal-style `@web ~` header, the blinking cursor and the original ATProto blog setup come from there. It has since been rewritten, but the spirit is Hayden's. Thank you! Hayden now writes at [hayden.leaflet.pub](https://hayden.leaflet.pub/).

Other sites that shaped it:

- [hailey.at](https://hailey.at/): minimal, writing-first, published on AT Protocol
- [tania.dev](https://tania.dev/): the "brief timeline", series and older / newer post navigation

---

*Branches: PRs merge into `v3` (default branch, deploys automatically) · release notes drafted from PRs, see [Releases](https://github.com/Skiddle-ID/skiddle.id/releases) · `v4` is the next major, in progress (staging at `v4-skiddle-id.skiddle.workers.dev`, see [ROADMAP.md](ROADMAP.md#the-v4-branch)) · `v1` and `v2` are archived majors*
