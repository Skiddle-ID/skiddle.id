# Roadmap

Where skiddle.id is going and what's done. Tick a box when its PR merges.

## Now (v3)

Released as [v3.7](https://github.com/Skiddle-ID/skiddle.id/releases/tag/v3.7) on 2026-11-16.

- [x] Geist Sans for post text, Geist Mono for everything else ([#98](https://github.com/Skiddle-ID/skiddle.id/pull/98))
- [x] Series with progress bars and planned parts ([#99](https://github.com/Skiddle-ID/skiddle.id/pull/99))
- [x] Ongoing series like Lab Notes, and shorter lists for long series ([#101](https://github.com/Skiddle-ID/skiddle.id/pull/101))
- [x] Drafts readable on pull request previews only ([#102](https://github.com/Skiddle-ID/skiddle.id/pull/102))
- [x] Code MIT, writing all rights reserved, no AI training ([#103](https://github.com/Skiddle-ID/skiddle.id/pull/103))
- [x] Embeds: latest post card, status badge, 88×31 button ([#104](https://github.com/Skiddle-ID/skiddle.id/pull/104))

Since v3.7:

- [x] Scheduled posts (`publishAt`) and automatic "updated" dates ([#111](https://github.com/Skiddle-ID/skiddle.id/pull/111))

## Writing

- [x] Publish "Never Quite Done", part 7 and the end of Rebuilding skiddle.id ([#107](https://github.com/Skiddle-ID/skiddle.id/pull/107))
- [x] Publish Lab Notes #1, "Where Am I in This Series?" ([#101](https://github.com/Skiddle-ID/skiddle.id/pull/101), published Nov 17, 2026)
- [ ] Lab Notes: one or two posts every week about what's going on at Skiddle Labs
- From Fear to Flight, 6 parts (planned parts are in `src/data/series.ts`):
  - [x] 1. How It All Started
  - [ ] 2. Ground School (needs your ground-school notes)
  - [ ] 3. First Flights
  - [ ] 4. First Solo
  - [ ] 5. Planning Real Flights
  - [ ] 6. The Checkride

Publish one post at a time, in reading order, so the Bluesky announcements stay in order.

## v4

**Direction:** posts and series move completely onto AT Protocol, written and published from the admin app. Keep the terminal identity, make reading great, and make the site more about Jeff than about the site itself.

### Decisions

- [x] Reading font: Geist Sans for post text ([#98](https://github.com/Skiddle-ID/skiddle.id/pull/98))
- [x] Series show their planned parts ([#99](https://github.com/Skiddle-ID/skiddle.id/pull/99))
- [ ] Home page design: A terminal, B editorial, C tmux or D bento ([mockups](docs/v4/))
- [ ] Home intro: lead with you, or with consulting

### v4.0-pre: a safety net first

- [x] Tests in CI, run against each PR's preview: theme and CSP checks, link checker, Lighthouse, accessibility (axe) ([#108](https://github.com/Skiddle-ID/skiddle.id/pull/108))
- [ ] TypeScript 7, once typescript-eslint supports it ([#78](https://github.com/Skiddle-ID/skiddle.id/pull/78))

### v4.0: the redesign

- [ ] New home page, in the chosen design
- [ ] Shorter menu: writing, about, work, uses (works, projects and services become "work")
- [ ] Post page to match: description as the intro, figures with captions
- [ ] Indonesian posts: a language label, a filter and hreflang

### v4.1: more about Jeff

- [ ] /flying: From Fear to Flight plus logbook stats (needs your logbook data)
- [ ] /now, with a "last updated" date
- [ ] Notes: your Bluesky posts with a chosen hashtag, collected at build time

### v4.2

- [ ] /changelog from the GitHub releases
- [ ] Maybe: a newsletter (RSS to email; needs an account with an email service)

### Embeds, approved and held for v4

- [ ] METAR card, `/metar.svg?station=…`: live airport weather (needs your home airport's ICAO code)
- [ ] Last.fm top of the week, `/lastfm/top.svg`
- [ ] Latest Bluesky post, `/bluesky.svg`
- [ ] A Bluesky custom feed for Lab Notes
- [ ] Flying logbook card, `/flying.svg`, together with /flying

## The v4 branch

v4 is built on its own branch, `v4`, so `v3` stays live and unchanged while the redesign takes shape.

- **Staging site:** every push to `v4` gets its own Cloudflare preview at `https://v4-skiddle-id.skiddle.workers.dev`. It shows drafts and isn't indexed, like any preview.
- **v4 work:** branch from `v4` and open PRs into `v4`. They get the same checks as v3 PRs (lint, preview checks, Lighthouse).
- **Keeping v4 current:** posts, Lab Notes and fixes keep going into `v3`. Merge `v3` into `v4` regularly, at least after each post, so v4 has the same content.
- **Publishing stays on v3:** the Bluesky announcements, the AT Protocol sync and scheduled posts only run on `v3`.

**Launch checklist,** when v4 is ready:

- [ ] Merge `v3` into `v4` one last time
- [ ] Switch posts to records: remove the post files and the git publishing workflows (see [v4: posts and series](#v4-posts-and-series))
- [ ] Cloudflare: make `v4` the production branch in the skiddle-id Worker's build settings
- [ ] GitHub: make `v4` the default branch
- [ ] Switch everything that names `v3` to `v4`: the workflows (`branches`, `ref`, `HEAD:v3`, `--ref v3`), the "Suggest an edit", history and license links (`blob/v3/…`, `commits/v3/…`), robots.txt, the README
- [ ] Release v4.0, then keep `v3` as an archived major, like `v1` and `v2`

## AT Protocol backend (v4 to v6)

**Goal:** the site's data lives as records in Jeff's own AT Protocol repo (`did:plc:xaj6j6abvpgwps5v6k4t6clv`), and a small admin app updates all of it by signing in with the Bluesky account (AT Protocol OAuth). There's no database of our own. It keeps working after a move to another PDS, because the site always looks up the PDS from the DID.

v4 moves posts and series onto it completely: the writing lives in the PDS, the repo keeps the code, and the post files leave the repo. v5 and v6 bring the rest of the site.

- **Lexicons:** under `id.skiddle.*`, reusing existing ones where they fit (Standard.site for posts, maybe teal.fm for music). Lexicons can only gain optional fields once they're in use, so each one is designed before it ships.
- **Reading:** the Worker reads records when a page is requested and caches the result: the status, and from v4 posts and series. Only code changes need a build.
- **The admin app:** mobile-first and installable as a PWA. Posts are written and published there.
- **Everything in an AT Protocol repo is public.** Every published record and every edit goes out on the network.

### v4: posts and series

The full plan, with the draft lexicons, is in [docs/v4/posts-on-atproto.md](docs/v4/posts-on-atproto.md). Pages are rendered when someone asks for them and cached, so publishing, editing and scheduling never need a rebuild; only code changes do. It all fits Cloudflare's free Workers plan.

Decisions:

- [ ] Drafts: `id.skiddle.draft` records that sync between devices and can be read on the PDS, like drafts in the git repo today (recommended); kept on the device; or encrypted records
- [ ] The MDX demo post, the only post with components: retire it (recommended), or rewrite it as plain Markdown
- [ ] pckt.blog's six posts: move them to the skiddle.id publication (recommended; they leave skiddle-blog.pckt.blog), or add separate records

Done so far:

- [x] `id.skiddle.status`: one record (state: available, busy, do not disturb or away; text, location, time zone), in [`lexicons/`](lexicons/id/skiddle/status.json), set with `npm run status` or the Set status workflow
- [x] `/status.svg`, `/api/status.json` and the home page read the status from the PDS, falling back to `src/data/status.ts`
- [x] Admin app, first version (`/admin/`): sign in with Bluesky, edit the status, publish the lexicon, list the site's records; works on a phone and installs as a PWA
- [ ] Publish the status lexicon: the admin app's "Publish lexicon" button (or `npm run status -- --publish-lexicon`); the `_lexicon.skiddle.id` DNS record is in place

Records:

- [ ] Posts stay one `site.standard.document` each (Standard.site covers the published post), with the same record keys, so links and comments keep working
- [ ] `id.skiddle.post`, in the document's `content`: the Markdown, its images as blobs, and category, language, series and part, featured
- [ ] `id.skiddle.series`: one record per series (name, description, planned parts, ongoing, cadence), replacing `src/data/series.ts`
- [ ] `id.skiddle.draft`, if drafts are records
- [ ] v3's AT Protocol sync fills them from git (content, images, series), so the records match git until the switch
- [ ] pckt.blog's six posts, as decided above

The site:

- [ ] Posts and series read from the PDS when a page is requested (Astro 7 live collections), with Markdown rendered in the Worker
- [ ] Astro's route cache on Cloudflare for the post pages, lists, topics, series, feeds, sitemap and search, plus `/api/revalidate` so a save shows straight away
- [ ] `/media/<cid>` for images and share cards from the repo
- [ ] The site CSP on rendered pages, from the middleware
- [ ] A parity check: every post on staging, built from records, matches production, built from git

The admin app:

- [ ] Write and edit posts: Markdown with a live preview, images, series and part, drafts
- [ ] Publish: draws the share card in the browser, writes the record, announces it on Bluesky and turns comments on
- [ ] Edit and unpublish published posts; edits set the "updated" date
- [ ] Series: create and edit them, including planned parts
- [ ] Schedule posts, published by a small cron Worker every 5 minutes (replaces three GitHub workflows)

Safety:

- [ ] Weekly backups of the repo and its images (a CAR file plus blobs) to a GitHub release

The switch, at launch:

- [ ] Publish the last post from git, run the sync one last time, make v4 production
- [ ] Remove `src/content/posts`, the post images, `src/data/series.ts`, the git publishing workflows and their scripts, and drawing post share cards at build time

### v5: more of the site

v4.1 builds /now and /flying from data files in the repo; v5 moves their data into records.

- [ ] `id.skiddle.now` for the Now list and /now
- [ ] `id.skiddle.flight` for the logbook, /flying and the flying card
- [ ] Admin app: update Now and log a flight from the phone
- [ ] Notes from Bluesky posts; music from teal.fm, if it replaces Last.fm

### v6: everything

- [ ] Projects, uses and the CV as records
- [ ] Admin app: everything editable

## Parked

- The Shortlink card on the projects page still has template text; update it after you change the shortlink itself
