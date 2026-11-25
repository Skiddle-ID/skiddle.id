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

**Direction:** everything the site shows moves into Jeff's AT Protocol repo and is edited from the admin app: posts, series and the pages' content first, then Now, notes and flying. Git keeps the code, and the content leaves it. There's no redesign in v4. Pages keep v3's look, and the new pages (/now, /flying) use it too. The redesign is [v5](#v5-the-redesign). Decided on 2026-11-17.

**Order:** v4.0 is the launch: posts, series and the pages' content move onto AT Protocol, and the admin app's Save and Publish work for real ([v4: posts and series](#v4-posts-and-series)). v4.1 and v4.2 add Now, notes, music and flying. The pages' content moved into v4.0 on 2026-11-17, so its work can start now. How the records are read and written is in [AT Protocol backend](#at-protocol-backend).

### v4.0-pre: a safety net first

- [x] Tests in CI, run against each PR's preview: theme and CSP checks, link checker, Lighthouse, accessibility (axe) ([#108](https://github.com/Skiddle-ID/skiddle.id/pull/108))
- [ ] TypeScript 7, once typescript-eslint supports it ([#78](https://github.com/Skiddle-ID/skiddle.id/pull/78))

### v4.0: posts and pages on AT Protocol

Posts and series:

- [x] Everything in [v4: posts and series](#v4-posts-and-series)

The pages' content, today in `src/data/` and the page files. Each part becomes records, which the pages read when someone asks for them and cache, like posts. The plan is in [docs/v4/pages-on-atproto.md](docs/v4/pages-on-atproto.md):

- [x] Projects (`src/data/projects.ts`), the CV (`works.ts`), services (`services.ts`) and the highlights they share (`highlights.ts`)
- [x] Uses (`uses.ts`)
- [x] About: its text
- [x] Their lexicons: `id.skiddle.project` (one per project), `id.skiddle.cv`, `id.skiddle.services`, `id.skiddle.uses` and `id.skiddle.about` (one each), checked against today's data in CI (`npm run check:lexicons`). About's content moved into `src/data/about.ts` for it ([#138](https://github.com/Skiddle-ID/skiddle.id/pull/138))
- [x] The admin app's new section, Pages, between Series and Status, with a one-time import from the site's data. The sign-in asks for the five collections ([#139](https://github.com/Skiddle-ID/skiddle.id/pull/139))
- [x] Publish the lexicons (Site → Lexicons) and run the import (Pages), on staging. Done on 2026-11-18: all 10 records match the site's data, and staging reads them with no difference from production
- [x] The pages read the records, falling back to the data files until the switch, with a parity check against production in every PR's preview checks ([#140](https://github.com/Skiddle-ID/skiddle.id/pull/140))
- [x] The admin app: edit them in the Pages section, with forms made from the lexicons. Saving turns on at the switch, with posts ([#141](https://github.com/Skiddle-ID/skiddle.id/pull/141))
- [x] At the switch, remove the data files from git, the pages' fallback to them, and the import ([#143](https://github.com/Skiddle-ID/skiddle.id/pull/143)). What stays in git:
  - the code
  - the rendered pages' titles, descriptions and share card commands (`list-pages.ts`)
  - the built-in status the site falls back to when the PDS can't be read (`status.ts`)

Then the [launch checklist](#the-v4-branch).

### v4.1: Now, notes and music

- [ ] `id.skiddle.now` and /now, with a "last updated" date; updated from the admin app
- [ ] Notes: your Bluesky posts with a chosen hashtag, read from your repo when the page is requested
- [ ] Latest Bluesky post card, `/bluesky.svg`
- [x] A Bluesky custom feed for Lab Notes, served by the site's Worker as `did:web:skiddle.id`; any series can publish one from its editor ([#164](https://github.com/Skiddle-ID/skiddle.id/pull/164))
- [x] An RSS feed per series, `/series/<key>/rss.xml`, switched on or off in the series editor ([#163](https://github.com/Skiddle-ID/skiddle.id/pull/163))
- [x] Music from teal.fm's records (`fm.teal.feed.play`, and `fm.teal.actor.status` for what's playing now) instead of Last.fm: `/music.svg` and the sidebar's "now playing", with album art from Deezer (by ISRC, or a matching search run near Singapore by [`workers/covers`](workers/covers/README.md), since Deezer isn't open in Hong Kong) and the Cover Art Archive (by MusicBrainz release or release group, or a MusicBrainz search by album and track). piper sends plays from Apple Music, and from Spotify through Last.fm. The old `/lastfm.svg` serves the same card. The alpha collections stopped on Feb 22, 2026, when teal.fm moved off them; piper has written the new ones since Nov 12
- [x] /listening/: now playing, this week's top artists and tracks, and every play, paged back through the alpha collection; the sidebar's "now playing" opens it
- [ ] A top-of-the-week music card, from the plays

### v4.2: flying

- [ ] `id.skiddle.flight` for the logbook (needs your logbook data)
- [ ] /flying: From Fear to Flight plus logbook stats, from the records
- [ ] Flying logbook card, `/flying.svg`
- [ ] Log a flight from the admin app

## The v4 branch

**v4 has been production since 2026-11-18** ([the switch](docs/v4/switch.md), [#143](https://github.com/Skiddle-ID/skiddle.id/pull/143)): skiddle.id renders everything from Jeff's AT Protocol repo, PRs go into `v4`, and `v4` is the default branch. The rest of this section is how v4 was built alongside v3.

v4 is built on its own branch, `v4`, so `v3` stays live and unchanged while v4 takes shape.

- **Staging site:** every push to `v4` gets its own Cloudflare preview at `https://v4-skiddle-id.skiddle.workers.dev`. It shows drafts and isn't indexed, like any preview.
- **v4 work:** branch from `v4` and open PRs into `v4`. They get the same checks as v3 PRs (lint, preview checks, Lighthouse).
- **Keeping v4 current:** posts, Lab Notes and fixes keep going into `v3`. Merge `v3` into `v4` regularly, at least after each post, so v4 has the same content.
- **Publishing stays on v3:** the Bluesky announcements, the AT Protocol sync and scheduled posts only run on `v3`.

**Launch checklist,** for v4.0 (posts, series and the pages' content on AT Protocol; Now, notes, music and flying follow in v4.1 and v4.2). Every step, in order and with who does it, is in [docs/v4/switch.md](docs/v4/switch.md):

- [x] Merge `v3` into `v4` one last time: nothing left to merge on 2026-11-18
- [x] Switch posts to records: remove the post files and the git publishing workflows (see [v4: posts and series](#v4-posts-and-series)) ([#143](https://github.com/Skiddle-ID/skiddle.id/pull/143))
- [x] Cloudflare: make `v4` the production branch in the skiddle-id Worker's build settings
- [x] GitHub: make `v4` the default branch
- [x] Switch everything that names `v3` to `v4`: the workflows, the license links, robots.txt, the README. A post's "Suggest an edit" became "View the record", since posts left git ([#143](https://github.com/Skiddle-ID/skiddle.id/pull/143))
- [x] Release v4.0 (2026-11-18), then keep `v3` as an archived major, like `v1` and `v2`

## AT Protocol backend

**Goal:** the site's data lives as records in Jeff's own AT Protocol repo (`did:plc:xaj6j6abvpgwps5v6k4t6clv`), and a small admin app updates all of it by signing in with the Bluesky account (AT Protocol OAuth). There's no database of our own. It keeps working after a move to another PDS, because the site always looks up the PDS from the DID.

v4 moves all of it. Posts and series come first: the writing lives in the PDS, the repo keeps the code, and the post files leave the repo. The pages' content comes with them in v4.0. Then Now, notes and flying follow (v4.1 and v4.2).

- **Lexicons:** under `id.skiddle.*`, reusing existing ones where they fit (Standard.site for posts, maybe teal.fm for music). Lexicons can only gain optional fields once they're in use, so each one is designed before it ships.
- **Reading:** the Worker reads records when a page is requested and caches the result: the status, posts, series and the pages' content, and from v4.1 the rest. Only code changes need a build.
- **The admin app:** mobile-first and installable as a PWA. Posts are written and published there.
- **Everything in an AT Protocol repo is public.** Every published record and every edit goes out on the network.

### v4: posts and series

The full plan, with the draft lexicons, is in [docs/v4/posts-on-atproto.md](docs/v4/posts-on-atproto.md). Pages are rendered when someone asks for them and cached, so publishing, editing and scheduling never need a rebuild; only code changes do. It all fits Cloudflare's free Workers plan.

Decisions:

- [x] Drafts: `id.skiddle.draft` records, which sync between devices and can be read on the PDS, like drafts in the git repo today
- [x] The MDX demo post, the only post with components: retire it
- [x] pckt.blog's six posts: move them to the skiddle.id publication (they leave skiddle-blog.pckt.blog)

Done so far:

- [x] `id.skiddle.status`: one record (state: available, busy, do not disturb or away; text, location, time zone), in [`lexicons/`](lexicons/id/skiddle/status.json), set with `npm run status` or the Set status workflow
- [x] `/status.svg`, `/api/status.json` and the home page read the status from the PDS, falling back to `src/data/status.ts`
- [x] Admin app, first version (`/admin/`): sign in with Bluesky, edit the status, publish the lexicon, list the site's records; works on a phone and installs as a PWA
- [x] Publish the status lexicon, from the admin app; the `_lexicon.skiddle.id` DNS record is in place

Records:

- [x] The lexicons: `id.skiddle.post`, `id.skiddle.series` and `id.skiddle.draft` in [`lexicons/`](lexicons/id/skiddle/), checked against every post and series in CI (`npm run check:lexicons`) ([#121](https://github.com/Skiddle-ID/skiddle.id/pull/121)), and published from the admin app, which now lists every lexicon ([#122](https://github.com/Skiddle-ID/skiddle.id/pull/122))
- [x] Posts stay one `site.standard.document` each (Standard.site covers the published post), with the same record keys, so links and comments keep working: all 14 are skiddle.id records ([#125](https://github.com/Skiddle-ID/skiddle.id/pull/125))
- [x] `id.skiddle.post`, in the document's `content`: the Markdown, its images as blobs, and category, language, series and part, featured ([#124](https://github.com/Skiddle-ID/skiddle.id/pull/124))
- [x] `id.skiddle.series`: one record per series (name, description, planned parts, ongoing, cadence, share card); the sync writes the four from `src/data/series.ts`, which goes at launch ([#124](https://github.com/Skiddle-ID/skiddle.id/pull/124))
- [x] `id.skiddle.draft` for drafts and scheduled posts: drafts are written from the admin app ([#129](https://github.com/Skiddle-ID/skiddle.id/pull/129))
- [x] v3's AT Protocol sync fills them from git (content, images, series), so the records match git until the switch ([#124](https://github.com/Skiddle-ID/skiddle.id/pull/124))
- [x] Retire the MDX demo post, before the sync fills the records ([#121](https://github.com/Skiddle-ID/skiddle.id/pull/121))
- [x] Move pckt.blog's six posts to the skiddle.id publication (`MOVE_PCKT_DOCUMENTS`), keeping their record keys ([#125](https://github.com/Skiddle-ID/skiddle.id/pull/125))

The site:

- [x] Posts and series read from the PDS when a page is requested (Astro 7 live collections), with Markdown rendered in the Worker: post pages ([#127](https://github.com/Skiddle-ID/skiddle.id/pull/127)), then the lists, feeds, sitemap, search and latest card ([#128](https://github.com/Skiddle-ID/skiddle.id/pull/128))
- [x] Astro's route cache on Cloudflare for the post pages, lists, topics, series, feeds, sitemap and search, plus `/api/revalidate` so a save shows straight away ([#128](https://github.com/Skiddle-ID/skiddle.id/pull/128)). Purging pages by tag isn't available on workers.dev; check it on skiddle.id after the launch
- [x] `/media/<cid>` for images and share cards from the repo ([#127](https://github.com/Skiddle-ID/skiddle.id/pull/127)). Post and series cards are stored in their records (a post's is Standard.site's `coverImage`); tag pages use the Topics card
- [x] The site CSP on rendered pages, from the middleware ([#127](https://github.com/Skiddle-ID/skiddle.id/pull/127))
- [x] A parity check: every post on staging, built from records, matches production, built from git; also the lists, feed, sitemap, search and latest post ([#127](https://github.com/Skiddle-ID/skiddle.id/pull/127), [#128](https://github.com/Skiddle-ID/skiddle.id/pull/128))

The admin app:

- [x] Write drafts: Markdown with a live preview (the site's renderer), images shrunk under 1 MB, series and part, saved as you type ([#129](https://github.com/Skiddle-ID/skiddle.id/pull/129))
- [x] Sections: Posts, Series, Status and Site, one at a time under a bar, each with its own address ([#131](https://github.com/Skiddle-ID/skiddle.id/pull/131))
- [x] Publish: draws the share card in the browser (byte-for-byte the build's card), writes the record, announces it on Bluesky and turns comments on; resumable if it stops part-way. Built, and switched on at the launch ([#132](https://github.com/Skiddle-ID/skiddle.id/pull/132))
- [x] Edit and unpublish published posts; edits set the "updated" date, unless ticked as a small fix ([#130](https://github.com/Skiddle-ID/skiddle.id/pull/130)), and redraw the share card when it would change
- [x] Series: create and edit them, including planned parts, ongoing and cadence; saving draws the series' share card. Built, and switched on at the launch ([#133](https://github.com/Skiddle-ID/skiddle.id/pull/133))
- [x] A page per series to share, `/series/<key>/`, with its own share card; every series link points there
- [x] Post categories as a record (`id.skiddle.categories`), edited in the admin app (Posts → Categories), with a page per category (`/topics/<id>/`); the command bar's search finds series and categories too
- [x] Redraw all share cards, for after a change to the card design: **Check share cards** in Site redraws every post, series and scheduled draft card, compares each with the stored one, and saves only the ones that changed. Saving is switched on at the launch
- [x] Schedule posts, published by a small cron Worker every 5 minutes ([`workers/publisher`](workers/publisher/README.md), replaces three GitHub workflows). Built; deployed, with its app password, at the launch

Safety:

- [x] Weekly backups of the repo and its images (a CAR file plus blobs, each checked against its hash) to the `backups` release, keeping four ([`scripts/backup.mjs`](scripts/backup.mjs)). Built; runs once its workflow is on the default branch, at the launch

The switch, at launch:

- [x] Publish the last post from git, run the sync one last time, make v4 production, then run the backup once by hand and check it (2026-11-18)
- [x] Remove `src/content/posts`, the post images, `src/data/series.ts`, the git publishing workflows and their scripts, MDX support, and drawing share cards for posts and tags at build time ([#143](https://github.com/Skiddle-ID/skiddle.id/pull/143))

## v5: the redesign

Moved out of v4 on 2026-11-17, so v4 is only about moving to AT Protocol.

**Direction:** keep the terminal identity, make reading great, and make the site more about Jeff than about the site itself. The first mockups, four home pages, are in [docs/v4/](docs/v4/). **Logbook**, a design for every page, is in [docs/v5/](docs/v5/).

### Decisions

- [x] Reading font: Geist Sans for post text ([#98](https://github.com/Skiddle-ID/skiddle.id/pull/98))
- [x] Series show their planned parts ([#99](https://github.com/Skiddle-ID/skiddle.id/pull/99))
- [ ] Design: Logbook for every page ([docs/v5/](docs/v5/)), or one of the home pages A terminal, B editorial, C tmux or D bento ([docs/v4/](docs/v4/))
- [ ] Home intro: lead with you, or with consulting

### The redesign

- [ ] New home page, in the chosen design
- [ ] Shorter menu: writing, about, work, uses (works, projects and services become "work")
- [ ] Post page to match: description as the intro, figures with captions
- [ ] Indonesian posts: a language label, a filter and hreflang

### Later

- [ ] /changelog from the GitHub releases
- [ ] METAR card, `/metar.svg?station=…`: live airport weather (needs your home airport's ICAO code)
- [ ] Maybe: a newsletter (RSS to email; needs an account with an email service)

## Parked

- The Shortlink card on the projects page still has template text; update it after you change the shortlink itself
