# skiddle.id

My corner of the internet — [skiddle.id](https://skiddle.id) — by Jeff (Skiddle). Protocol engineer in Bangkok (Skiddle Labs), writing about infra, open protocols, homelab and life.

Built with [Astro](https://astro.build), deployed to [Cloudflare Workers](https://workers.cloudflare.com). Everything the site shows lives as records in Jeff's own [AT Protocol](https://atproto.com) repo (`did:plc:xaj6j6abvpgwps5v6k4t6clv`, @skiddle.blue): the posts, the series, the pages' content and the status. The site reads them when a page is requested, and the admin app at `/admin/` writes them. This repo holds the code. Comments come from Bluesky replies.

## Updating the site

| To change… | Where |
|---|---|
| A post, a draft, a scheduled post | Admin app → Posts |
| A series | Admin app → Series |
| Post categories | Admin app → Posts → Categories |
| A page's blocks: which, in what order, how wide, and their text (Home, About, Now, Uses, the CV, Services, Notes, and pages of your own) | Admin app → Pages → the page |
| The Now list, the services and testimonials, the note picks, the projects | Admin app → Pages |
| The status | Admin app → Status (or the "Set status" workflow) |
| Page layout, headings, styles | `src/pages/`, `src/components/` (a PR) |
| The rendered pages' titles and descriptions | `src/data/list-pages.ts` |

A save goes live within seconds, with no build: the admin app asks the site to refresh its cached pages (`POST /api/revalidate`). Only code changes go through a PR and a deploy.

Every record is public, drafts included: anyone can read them on the PDS, and they go out on the network.

### Writing and publishing

In the admin app, **Posts → New draft**. A draft is an `id.skiddle.draft` record, saved as you type, so it's on every device. The editor has a live preview (the site's own renderer) and shows the post's share card. Images are shrunk under 1 MB and uploaded as blobs.

- **Writing:** a formatting toolbar (bold, italic, link, heading, quote, lists, code) with Ctrl+B, Ctrl+I and Ctrl+K on Windows, Linux and ChromeOS, or ⌘B, ⌘I and ⌘K on a Mac (`src/lib/shortcuts.mjs`; the toolbar's tooltips show the right one). Enter continues a list, and pasting an address over selected text makes it a link. Paste or drop an image into the text to add it. The word count and minutes to read match the post page. **Focus** hides everything but the title and the text (Esc leaves it). On wide screens the preview sits beside the text and follows its scrolling.
- **Tags** suggest the ones posts and drafts already use.
- **Ctrl+S** (⌘S on a Mac) saves whichever editor is open: a draft right away instead of after the pause, a published post's changes, a series or a page. Each editor shows its state the same way: a dot and "Unsaved changes", "Saving…" or "Saved", in a bar that stays at the top.
- **The page editors** (Pages section) are made from the lexicons. Markdown fields get the same toolbar and a preview. List items (CV jobs, uses, categories, a series' planned parts) can be dragged into order, and long lists fold and unfold all at once. Short fields suggest the values already used in the same place, and in the other projects for a project.

- **Publish** draws the share card in the browser and writes the post as a `site.standard.document` with an `id.skiddle.post` inside (the Markdown, images, category, language, series and part). It then announces the post on Bluesky with the card as a link card, and turns comments on (`bskyPostRef`). The link card names the post's document and the publication (`associatedRefs`), so Bluesky shows it as a Standard.site card: the publication's name and colours, the author, and "View publication". If it stops part-way, pressing Publish again finishes it without posting twice.
- **Schedule**: pick a time and the share card is drawn for that date and stored on the draft. The scheduler, a small cron Worker ([`workers/publisher`](workers/publisher/README.md)), publishes due drafts every 5 minutes the same way.
- **Editing a published post** keeps its address and publish date and sets "updated", unless it's ticked as a small fix. The card is redrawn if the title, description or length changed.
- **Series** (Series section): name, description, planned parts ("coming"), ongoing and cadence. Saving draws the series' card.
- **Share cards** (Site section): after a change to the card design, the theme or the logo, **Check share cards** redraws every stored card and saves the ones that changed.

### How the site reads the records

Every page that shows records is rendered when it's requested and cached at Cloudflare: fresh for a minute, then stale for up to a day while a new copy renders ([posts](docs/v4/posts-on-atproto.md), [pages](docs/v4/pages-on-atproto.md)).

- `src/live.config.ts` defines live collections for posts and series, read by `src/lib/pds-posts.ts` through `src/lib/pds.ts`. That module finds the PDS from the DID (so a move to another PDS just works) and caches records for a minute. `src/lib/page-content.ts` reads the pages' records the same way.
- `src/lib/post-html.mjs` renders a post's Markdown in the Worker: GitHub-flavoured Markdown, smart punctuation and github-slugger heading ids, in about half a millisecond.
- Pages are cached with the tag `posts` or `pages`. `POST /api/revalidate` clears the cached records and pages when the repo has changed since the last purge. The admin app calls it after a save, and the scheduler after a publish.
- `/media/<cid>` serves the repo's images and share cards. Old record-key addresses, `/posts/<record key>/`, redirect to the post.
- **Categories** are one `id.skiddle.categories` record (key `self`): an ordered list of id, label and description (`src/lib/site-categories.ts`, falling back to the four in `src/lib/categories.mjs` if there's none). A post names its category by id. Each category has its page at `/topics/<id>/` (`tag` is reserved for `/topics/tag/<tag>/`), and /topics/ lists them in order. In the admin app, Posts → Categories edits the list. It refuses ids that aren't lower case letters, digits and hyphens, repeats, and dropping an id posts still use.
- The command bar's search (`/search.json`) finds posts, series and categories.
- Each series has its own page to share, `/series/<key>/` (its record's key, which stays when it's renamed; an address from an earlier name redirects), with the series' own share card. `/series/` lists them all.
- The posts are [Standard.site](https://standard.site) documents of the skiddle.id publication, so readers like Leaflet, pckt and docs.surf can find them. The site proves it owns them with `/.well-known/site.standard.publication` and `<link rel="site.standard.document">` on each post.
- The lexicons for the site's own records are in [`lexicons/`](lexicons/id/skiddle/) (`id.skiddle.*`), checked in CI (`npm run check:lexicons`) and published from the admin app.
- If the PDS can't be read, a page cached earlier still shows. Weekly backups of the whole repo and its images go to the `backups` release ([`scripts/backup.mjs`](scripts/backup.mjs), how to restore: [posts-on-atproto.md](docs/v4/posts-on-atproto.md#backups)).

**Avatars** are local, resized copies, so pages don't load full-size images from other sites. `public/avatars/bluesky.jpg` (224px, on the home page) comes from the Bluesky profile picture, and `public/avatars/github.jpg` (280px, on the about page) and `github-96.jpg` (96px, end of each post) from the GitHub one. To update one, save the new picture and resize it, e.g. `sips -z 224 224 -s format jpeg -s formatOptions 82 new.jpg --out public/avatars/bluesky.jpg`.

The site's own share cards (`/og/site.png`, and the rendered pages' at `/og/pages/<path>.png`) are made at build time (`src/lib/share-card.ts`, `src/integrations/share-cards.ts`). Posts and series carry their own, drawn in the admin app with the same code. All of them are in the theme's design (`id.skiddle.theme`: Terminal, Terminal light or Logo, picked in the admin app's Theme editor), its colours and its headings' font with the publication's logo (`site.standard.publication`'s icon), read when they're drawn (`src/lib/card-theme.mjs`); the build falls back to the terminal design and the built-in icon if the repo can't be read.

```sh
npm ci          # Node 24 (see .node-version), npm (see packageManager)
npm run dev     # http://localhost:4321
npm run build   # production build into dist/
npm run lint    # ESLint (eslint.config.js); also runs on every PR (.github/workflows/ci.yml)
```

### Admin app

`/admin/` is a small app for running the site from a phone: sign in with the Bluesky account (AT Protocol OAuth), then use its sections, each with its own address, from a sidebar (a bar along the bottom on a phone): Overview (counts, the usual jobs and what changed lately), then Content, whose lists are tables with filters and search (Posts, Series, Pages, where a page made of blocks opens the block editor (below), Timeline, the events on [`/timeline/`](docs/v4/timeline.md), and Media: every file in the repo by what uses it, plus a library of uploads, each kept by an `id.skiddle.media` record and usable in posts as `![alt](/media/<cid>)`; a file can't change in place, so Replace uploads the new image and moves the posts' and pages' links to it, keeping the old one while anything still links to it) and Site (Status, Site and SEO, with the site's icon made from one uploaded image and the frame: the sidebar's menu and the footer's links, in lists you drag into order, and switches that hide the sidebar's music card and theme buttons, Publication: the Standard.site publication's name, description and logo, Theme: the site's light or dark mode and accent colour for visitors who haven't picked their own, its design (colours for dark and light, fonts, text size, line heights, corners, spacing and the terminal touches, beside a live preview in dark and light, with a contrast check that won't save text under WCAG AA and a Reset to today's look; `src/lib/site-theme.mjs`), and the share cards' design, picked from previews, Lexicons and cards: the lexicons, share cards and the site's records). Add it to the home screen to use it like an app (it's a PWA).

- **Pages made of blocks** ([docs/v4/themes.md](docs/v4/themes.md)): a page is an `id.skiddle.page` record keyed by its address (`home` for `/`, `about` for `/about/`, `works` for the CV at `/works/`), a list of blocks, each with a width. Pages lists the site's own seven (Home, the CV, Services, Uses, About, Now and Notes) first, whether they have a record yet or not, then the records their blocks read: **The Now list**, **Services and testimonials** and **Note picks**. The block editor (`#blocks/<key>`, `src/lib/admin/block-editor.ts`) adds a block from the catalogue, removes, drags or moves one, sets its width (full, half or third) and its options, in a form made from its def in the lexicon; a block of a kind it doesn't know is kept as it is. **Save draft** writes `<key>~draft`, **Preview** opens the page with `?preview=draft` (never cached or indexed), and **Publish** copies the draft over the page, draws its share card when it has its own (home keeps the site's unless "Its own share card" is ticked) and deletes the draft; the site's cached pages are purged after each. Every site page has its page record. Without one, Home, Now, Services and Notes show their built-in page (`src/lib/page-legacy.mjs`), which the block editor also starts from; About, Uses and the CV have no built-in page, so they fail and a cached copy shows. The old page records (`id.skiddle.home`, `.about`, `.uses`, `.cv`) are no longer read or edited ([phase 6](docs/v4/themes.md#phases)). Pages of Jeff's own sit under **Your pages**, each published or a draft. **New page** asks for a title and an address, which follows the title until you type one, and says as you type whether it can have it: lowercase letters, digits and single hyphens, up to 50 characters, none of the site's own addresses (`RESERVED_KEYS` in `src/lib/own-pages.mjs`) and no page or draft already there. **Create** opens it in the block editor; it's in the repo once its draft is saved, and at `/<address>/` once it's published, with a share card drawn at Publish. **Delete page**, on a page of Jeff's own only, deletes the page and its draft after a confirm, and purges the site. A published page is in the sitemap, the search and the command bar, and the menu (Site and SEO) can link to it. The catalogue offers the blocks for any page first (text and links, then the site's data), then the parts of the site's own pages. Each kind of block is a component in `src/components/blocks/`, an entry in `BLOCKS` and a def in the lexicon (`scripts/page-blocks.test.mjs` checks all three); `node scripts/parity.mjs http://127.0.0.1:8787 / /about/ /works/` compares a local build's pages with skiddle.id.
- It runs entirely in the browser (`src/lib/admin/app.ts`, with `@atproto/oauth-client-browser`). There's no server or database: the sign-in tokens stay on the device, and the app writes straight to the PDS.
- It may only write the site's collections, upload images, and create (never edit or delete) the Bluesky posts that announce new posts. Bluesky's sign-in page shows the list, which is `COLLECTIONS` and `CREATE_ONLY` in `src/lib/admin/oauth.ts`. Adding one there means signing in again; the app says so. A session keeps a collection taken off the list until its next sign-in.
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

The site's Worker has no secrets: everything it shows is public records. The scheduler is its own Worker, with its own app password ([setup](workers/publisher/README.md)). So is Deezer's search for album art, which runs near Singapore through a service binding ([setup](workers/covers/README.md)).

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

### Latest Bluesky post

`/bluesky.svg` shows the newest post by [@skiddle.blue](https://bsky.app/profile/skiddle.blue), with "new" for a day: date, reply, repost and like counts, and the text in two lines. Reposts and replies are skipped. Images, videos, link cards and quotes aren't drawn, because an SVG inside `<img>` can't load them. The card names them instead, like `[2 images]` or `[link: skiddle.id]`. The post comes from Bluesky's public AppView (`app.bsky.feed.getAuthorFeed`, no key), cached for 60 seconds. If the AppView can't be read, the card points to the profile. The code is in `src/lib/bluesky-post.ts` (data) and `src/lib/bluesky-card.ts` (drawing).

```html
<a href="https://bsky.app/profile/skiddle.blue">
  <img src="https://skiddle.id/bluesky.svg" alt="Latest post on Bluesky" width="540">
</a>
```

### Status badge

`/status.svg` reads "● open to consulting · Bangkok 14:32", with the local time when it loads. The dot's colour is the status: available (green), busy (amber), do not disturb (red) or away (grey). With an `emoji` set (one emoji, like ✈️), it takes the dot's place, there and on the home page. The status is the `id.skiddle.status` record in Jeff's AT Protocol repo ([lexicon](lexicons/id/skiddle/status.json)), read through `src/lib/at-status.ts`. That code looks up the PDS from the DID, caches the record for 60 seconds and falls back to `src/data/status.ts` if it can't be read. `/api/status.json` serves the same status, and the home page's status line updates from it.

**History:** each time the status is set, the admin app and `npm run status` add a copy to `id.skiddle.statusLog` ([lexicon](lexicons/id/skiddle/statusLog.json)), one record per change. [`/status/`](https://skiddle.id/status/) lists every one, newest first, and the home page's status line links to it. The admin app's Status section lists the recent ones, and can delete a past one. The current status always tops the list, even if its copy wasn't added (`src/lib/status-log.mjs`).

To set it, open [`/admin/`](#admin-app) and sign in with Bluesky. Or, from a computer (with `BLUESKY_APP_PASSWORD` set):

```bash
npm run status -- --available --text "open to consulting"
```

Add `--emoji ✈️` for an emoji instead of the dot, or `--no-emoji` to go back to the dot. Without either, the current emoji stays.

`--busy` makes it busy, and `--state dnd` or `--state away` sets the others. `--location` and `--time-zone` keep their current values unless given, `--show` prints the record and `--dry-run` writes nothing. From a phone, use the **Set status** workflow (GitHub → Actions → Set status → Run workflow). GitHub offers that button only for workflows on the default branch. Everything in an AT Protocol repo is public.

```html
<a href="https://skiddle.id/services/">
  <img src="https://skiddle.id/status.svg" alt="Open to consulting" height="28">
</a>
```

### Music card

`/music.svg` is a "now playing" card, from [teal.fm](https://teal.fm)'s records in Jeff's AT Protocol repo:

```html
<img src="https://skiddle.id/music.svg" alt="Now playing on teal.fm" width="540">
```

teal.fm keeps what you listen to as records in your own repo: its scrobbler (piper) writes an `fm.teal.feed.play` record per track, and `fm.teal.actor.status` while something's playing. The card shows what's playing now, or else the last track played. It reads them through `src/lib/pds.ts` like the rest of the site, cached for 30 seconds, with no API key. It embeds the album art (cached for 7 days) so it works inside `<img>`, from the first public source that has it, none of which needs a key: Deezer by the play's ISRC (plays from Apple Music carry one), the Cover Art Archive by its MusicBrainz release (many plays that come through Last.fm, from Spotify, carry one), or by that release's group when the release itself has no cover, Deezer's search by artist and track (only a result that matches), run by a small Worker near Singapore ([`workers/covers`](workers/covers/README.md)) because Deezer answers nothing from countries where it isn't open, such as Hong Kong, where skiddle.id often runs, MusicBrainz's search by album and then by track, for the Cover Art Archive, then Apple's lookup API (which refuses requests from Cloudflare, so it's the last resort). Names match in any script, so Thai, Korean and Chinese titles find their covers too. A search that finds nothing is remembered for a day, so a track with no cover doesn't send it again on every view. If the PDS can't be read it shows "Nothing playing right now" instead of a broken image. The sidebar's "now playing" uses `/api/music.json` and opens [`/listening/`](https://skiddle.id/listening/): what's playing now, this week's top artists and tracks, and every play, newest first, 50 to a page (`src/lib/listening.ts`). Its "older plays" pages go back through teal.fm's alpha collection too, so the whole history can be browsed without one request reading thousands of records. `/lastfm.svg` and `/api/lastfm.json`, the old addresses from the Last.fm days, serve the same. The code is in `src/lib/music.ts` and `src/lib/teal.mjs` (data) and `src/lib/music-card.ts` (drawing).

### Top of the week

`/music-week.svg` shows the top 3 artists and the top 3 tracks of the last 7 days, each with its play count, and the number of plays. It's text only, with no album art. The numbers are the ones [`/listening/`](https://skiddle.id/listening/) shows. `weekPlays()` in `src/lib/listening.ts` reads the plays, `weekSummary()` in `src/lib/teal.mjs` counts them, and the result is cached for 10 minutes. If nothing was played that week, or the plays can't be read, the card says so and points to `/listening/`. The drawing code is in `src/lib/music-week-card.ts`.

```html
<a href="https://skiddle.id/listening/"><img src="https://skiddle.id/music-week.svg" alt="This week's top music on teal.fm" width="540"></a>
```

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
