# skiddle.id

My corner of the internet — [skiddle.id](https://skiddle.id) — by Jeff (Skiddle). Protocol engineer in Bangkok (Skiddle Labs), writing about infra, open protocols, homelab and life.

Built with [Astro](https://astro.build), deployed to [Cloudflare Workers](https://workers.cloudflare.com). Everything the site shows lives as records in Jeff's own [AT Protocol](https://atproto.com) repo (`did:plc:xaj6j6abvpgwps5v6k4t6clv`, @skiddle.blue): the posts, the series, the pages' content and the status. The site reads them when a page is requested, and the admin app at `/admin/` writes them. This repo holds the code. Comments come from Bluesky replies.

## Updating the site

| To change… | Where |
|---|---|
| A post, a draft, a scheduled post | Admin app → Posts |
| A series | Admin app → Series |
| The CV, services, uses, About, projects | Admin app → Pages |
| The status | Admin app → Status (or the "Set status" workflow) |
| Page layout, headings, styles | `src/pages/`, `src/components/` (a PR) |
| The rendered pages' titles and descriptions | `src/data/list-pages.ts` |

A save goes live within seconds, with no build: the admin app asks the site to refresh its cached pages (`POST /api/revalidate`). Only code changes go through a PR and a deploy.

Every record is public, drafts included: anyone can read them on the PDS, and they go out on the network.

### Writing and publishing

In the admin app, **Posts → New draft**. A draft is an `id.skiddle.draft` record, saved as you type, so it's on every device. The editor has a live preview (the site's own renderer) and shows the post's share card. Images are shrunk under 1 MB and uploaded as blobs.

- **Publish** draws the share card in the browser and writes the post as a `site.standard.document` with an `id.skiddle.post` inside (the Markdown, images, category, language, series and part). It then announces the post on Bluesky with the card as a link card, and turns comments on (`bskyPostRef`). If it stops part-way, pressing Publish again finishes it without posting twice.
- **Schedule**: pick a time and the share card is drawn for that date and stored on the draft. The scheduler, a small cron Worker ([`workers/publisher`](workers/publisher/README.md)), publishes due drafts every 5 minutes the same way.
- **Editing a published post** keeps its address and publish date and sets "updated", unless it's ticked as a small fix. The card is redrawn if the title, description or length changed.
- **Series** (Series section): name, description, planned parts ("coming"), ongoing and cadence. Saving draws the series' card.
- **Share cards** (Site section): after a change to the card design, **Check share cards** redraws every stored card and saves the ones that changed.

### How the site reads the records

Every page that shows records is rendered when it's requested and cached at Cloudflare: fresh for a minute, then stale for up to a day while a new copy renders ([posts](docs/v4/posts-on-atproto.md), [pages](docs/v4/pages-on-atproto.md)).

- `src/live.config.ts` defines live collections for posts and series, read by `src/lib/pds-posts.ts` through `src/lib/pds.ts`. That module finds the PDS from the DID (so a move to another PDS just works) and caches records for a minute. `src/lib/page-content.ts` reads the pages' records the same way.
- `src/lib/post-html.mjs` renders a post's Markdown in the Worker: GitHub-flavoured Markdown, smart punctuation and github-slugger heading ids, in about half a millisecond.
- Pages are cached with the tag `posts` or `pages`. `POST /api/revalidate` clears the cached records and pages when the repo has changed since the last purge. The admin app calls it after a save, and the scheduler after a publish.
- `/media/<cid>` serves the repo's images and share cards. Old record-key addresses, `/posts/<record key>/`, redirect to the post.
- The posts are [Standard.site](https://standard.site) documents of the skiddle.id publication, so readers like Leaflet, pckt and docs.surf can find them. The site proves it owns them with `/.well-known/site.standard.publication` and `<link rel="site.standard.document">` on each post.
- The lexicons for the site's own records are in [`lexicons/`](lexicons/id/skiddle/) (`id.skiddle.*`), checked in CI (`npm run check:lexicons`) and published from the admin app.
- If the PDS can't be read, a page cached earlier still shows. Weekly backups of the whole repo and its images go to the `backups` release ([`scripts/backup.mjs`](scripts/backup.mjs), how to restore: [posts-on-atproto.md](docs/v4/posts-on-atproto.md#backups)).

**Avatars** are local, resized copies, so pages don't load full-size images from other sites. `public/avatars/bluesky.jpg` (224px, on the home page) comes from the Bluesky profile picture, and `public/avatars/github.jpg` (280px, on the about page) and `github-96.jpg` (96px, end of each post) from the GitHub one. To update one, save the new picture and resize it, e.g. `sips -z 224 224 -s format jpeg -s formatOptions 82 new.jpg --out public/avatars/bluesky.jpg`.

The site's own share cards (`/og/site.png`, and the rendered pages' at `/og/pages/<path>.png`) are made at build time (`src/lib/share-card.ts`, `src/integrations/share-cards.ts`). Posts and series carry their own, drawn in the admin app with the same code.

```sh
npm ci          # Node 24 (see .node-version), npm (see packageManager)
npm run dev     # http://localhost:4321
npm run build   # production build into dist/
npm run lint    # ESLint (eslint.config.js); also runs on every PR (.github/workflows/ci.yml)
```

### Admin app

`/admin/` is a small app for running the site from a phone: sign in with the Bluesky account (AT Protocol OAuth), then use its sections, each with its own address: Posts, Series, Pages, Status and Site (lexicons, share cards, the site's records). Add it to the home screen to use it like an app (it's a PWA).

- It runs entirely in the browser (`src/lib/admin/app.ts`, with `@atproto/oauth-client-browser`). There's no server or database: the sign-in tokens stay on the device, and the app writes straight to the PDS.
- It may only write the site's collections, upload images, and create (never edit or delete) the Bluesky posts that announce new posts. Bluesky's sign-in page shows the list, which is `COLLECTIONS` and `CREATE_ONLY` in `src/lib/admin/oauth.ts`. Adding one there means signing in again; the app says so.
- Every save uses `swapRecord`, so a change made on another device is never overwritten unseen, and unsaved changes are kept on the device until a save works.
- `PUBLISHING_LIVE` in `src/lib/admin/launch.ts` pauses publishing and saving if it's ever set to false.
- Only @skiddle.blue can change the site: anyone else who signs in is told it's the wrong account, and couldn't write to Jeff's repo anyway.
- `/oauth-client-metadata.json` is the app's OAuth client ID. It's built from the host, so the app works on skiddle.id and on every preview. With `npm run dev`, open `http://127.0.0.1:4321/admin/`: the app uses AT Protocol's local-development client there, and its sign-in lasts a day.
- It has its own Content-Security-Policy, which also allows plc.directory, bsky.social and Bluesky's PDS hosts (`src/integrations/security-headers.ts`). After a move to another PDS, add its host there.
- Kept out of search engines (noindex, robots.txt) and the sitemap.

### Deploying

Merging into `v4` deploys automatically through [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/). Settings for the `skiddle-id` Worker (Workers & Pages → skiddle-id → Settings → Build):

- Git repository: `Skiddle-ID/skiddle.id`, production branch `v4`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy` (the default; it picks up the config Astro generates in `dist/server/`)
- Root directory: `/`, no build variables needed (Node comes from `.node-version`)

Secrets live in Cloudflare, not in the repo: `LASTFM_API_KEY` (`npx wrangler secret put LASTFM_API_KEY`). For local dev, put it in `.dev.vars`. The scheduler is its own Worker, with its own app password ([setup](workers/publisher/README.md)).

Manual deploy and rollback still work from any machine logged in with `npx wrangler login`: `npm run build && npm run deploy`, `npx wrangler rollback`.

### Releases

The footer shows the latest release tag reachable from the deployed commit (e.g. `v4.0`), linked to its GitHub release. [Release Drafter](.github/release-drafter.yml) keeps a draft of the next release (`v4.1`, …) under GitHub → Releases, with PRs sorted by their title prefix (`feat:`, `fix:`, `chore:`, `docs:`). Rename and publish it when you're ready. Add a `major` label to a PR for a new major version.

Publishing a release only creates a tag, and tags don't trigger Workers Builds. So the footer picks up the new version on the next merge into `v4`. To show it straight away, either:

- re-run the latest build from the Worker's build history in the Cloudflare dashboard, or
- `git pull --tags && npm run build && npm run deploy` on a machine logged in with `npx wrangler login`.

## Checks

Every PR is checked on its own Cloudflare preview (the build of exactly that commit) by [`.github/workflows/preview-checks.yml`](.github/workflows/preview-checks.yml). It waits for Cloudflare's bot comment to list the preview, then runs:

- `tests/theme.test.mjs`: the light / dark theme follows the device, remembers a pick, survives blocked storage
- `tests/pages.test.mjs`: every page (the sitemap, the posts and the 404 page) has no browser or CSP errors and no serious accessibility problems (axe, WCAG 2.1 AA); the home page and a post are also checked in dark
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

`/status.svg` reads "● open to consulting · Bangkok 14:32", with the local time when it loads. The dot's colour is the status: available (green), busy (amber), do not disturb (red) or away (grey). The status is the `id.skiddle.status` record in Jeff's AT Protocol repo ([lexicon](lexicons/id/skiddle/status.json)), read through `src/lib/at-status.ts`. That code looks up the PDS from the DID, caches the record for 60 seconds and falls back to `src/data/status.ts` if it can't be read. `/api/status.json` serves the same status, and the home page's status line updates from it.

To set it, open [`/admin/`](#admin-app) and sign in with Bluesky. Or, from a computer (with `BLUESKY_APP_PASSWORD` set):

```bash
npm run status -- --available --text "open to consulting"
```

`--busy` makes it busy, and `--state dnd` or `--state away` sets the others. `--location` and `--time-zone` keep their current values unless given, `--show` prints the record and `--dry-run` writes nothing. From a phone, use the **Set status** workflow (GitHub → Actions → Set status → Run workflow). GitHub offers that button only for workflows on the default branch. Everything in an AT Protocol repo is public.

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
- **Writing and images** (posts, drafts, post images, photos, and the pages' text, in Jeff's AT Protocol repo and on the site): © Laurensius Jeffrey, all rights reserved, see [LICENSE-CONTENT.md](LICENSE-CONTENT.md). Quoting short excerpts with a link is fine; ask before republishing.
- **No AI training** on the writing. The site says so in [robots.txt](src/pages/robots.txt.ts) (a Content-Signal line, plus AI training crawlers turned away), in a `tdm-reservation` tag on every page, and in the RSS feed's copyright line. These are requests that well-behaved crawlers follow, not locks. Cloudflare's AI bot blocking (dashboard → AI Crawl Control) can enforce it at the edge.

## Credits & inspiration

This site started in 2025 from **[Hayden Young](https://bsky.app/profile/hayden.moe)'s** personal site, [hayden.moe](https://web.archive.org/web/2025/https://hayden.moe/) ([source](https://github.com/hbjydev/hayden.moe)). The terminal-style `@web ~` header, the blinking cursor and the original ATProto blog setup come from there. It has since been rewritten, but the spirit is Hayden's. Thank you! Hayden now writes at [hayden.leaflet.pub](https://hayden.leaflet.pub/).

Other sites that shaped it:

- [hailey.at](https://hailey.at/): minimal, writing-first, published on AT Protocol
- [tania.dev](https://tania.dev/): the "brief timeline", series and older / newer post navigation

---

*Branches: PRs merge into `v4` (default branch, deploys automatically) · release notes drafted from PRs, see [Releases](https://github.com/Skiddle-ID/skiddle.id/releases) · `v1`, `v2` and `v3` are archived majors*
