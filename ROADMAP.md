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
- **Reading:** live data (like the status) is read by the Worker per request with a short cache. Posts and series are built into pages from records, with a rebuild when the repo changes.
- **The admin app:** mobile-first and installable as a PWA. Posts are written and published there.
- **Everything in an AT Protocol repo is public.** Every published record and every edit goes out on the network.

### v4: posts and series

Decisions:

- [ ] Drafts and scheduled posts: drafts stay on the device in the admin app, and a scheduled post is written to the PDS when it's scheduled, then shown by the site from its time (its text can be read on the PDS early); or drafts and schedules wait in Cloudflare KV until they're published (private, but a small store of our own)
- [ ] The MDX demo post, the only post with components: rewrite it as plain Markdown, or retire it

Done so far:

- [x] `id.skiddle.status`: one record (state: available, busy, do not disturb or away; text, location, time zone), in [`lexicons/`](lexicons/id/skiddle/status.json), set with `npm run status` or the Set status workflow
- [x] `/status.svg`, `/api/status.json` and the home page read the status from the PDS, falling back to `src/data/status.ts`
- [x] Admin app, first version (`/admin/`): sign in with Bluesky, edit the status, publish the lexicon, list the site's records; works on a phone and installs as a PWA
- [ ] Publish the status lexicon: the admin app's "Publish lexicon" button (or `npm run status -- --publish-lexicon`); the `_lexicon.skiddle.id` DNS record is in place

Records:

- [ ] Posts stay one `site.standard.document` record each, with the same record keys, so links and Bluesky comments keep working. Its open `content` field holds an `id.skiddle.*` type with the Markdown, plus what Standard.site doesn't have: category, language, series and part, featured
- [ ] `id.skiddle.series`: one record per series (name, description, planned parts, ongoing, cadence), replacing `src/data/series.ts`
- [ ] Images as blobs in the PDS (one post photo today)
- [ ] pckt.blog's six older records brought into the same shape, keeping their record keys (`MOVE_PCKT_DOCUMENTS`)
- [ ] Backups: a scheduled export of the whole repo (a CAR file) kept outside the PDS

The site:

- [ ] Build posts, series, topics, the feeds, share cards and the latest-post card from records (an Astro content loader that reads the PDS)
- [ ] Rebuild the site when the repo changes (a scheduled Worker checks the repo's latest commit)
- [ ] Before the switch, a check that the pages built from records match the ones built from git

The admin app:

- [ ] Write and edit posts: Markdown with a live preview, images, series and part
- [ ] Publish: writes the record, announces it on Bluesky and turns comments on (signing in then also asks to post on Bluesky). Edits set the "updated" date
- [ ] Schedule posts, as decided above
- [ ] Series: create and edit them, including planned parts

The switch, at launch:

- [ ] Until then, v3's AT Protocol sync also writes each post's Markdown into its record, so the records match git
- [ ] Remove `src/content/posts`, the post images and the git publishing workflows (scheduled publish, the announcement on push, the AT Protocol sync, automatic "updated" dates)

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
