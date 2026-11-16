# Roadmap

Where skiddle.id is going and what's done. Tick a box when its PR merges.

## Now (v3)

- [x] Geist Sans for post text, Geist Mono for everything else ([#98](https://github.com/Skiddle-ID/skiddle.id/pull/98))
- [x] Series with progress bars and planned parts ([#99](https://github.com/Skiddle-ID/skiddle.id/pull/99))
- [x] Ongoing series like Lab Notes, and shorter lists for long series ([#101](https://github.com/Skiddle-ID/skiddle.id/pull/101))
- [x] Drafts readable on pull request previews only ([#102](https://github.com/Skiddle-ID/skiddle.id/pull/102))
- [x] Code MIT, writing all rights reserved, no AI training ([#103](https://github.com/Skiddle-ID/skiddle.id/pull/103))
- [x] Embeds: latest post card, status badge, 88×31 button ([#104](https://github.com/Skiddle-ID/skiddle.id/pull/104))

## Writing

- [x] Publish "Never Quite Done", part 7 and the end of Rebuilding skiddle.id ([#107](https://github.com/Skiddle-ID/skiddle.id/pull/107))
- [ ] Publish Lab Notes #1, after part 7 (draft)
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

**Direction:** keep the terminal identity, make reading great, and make the site more about Jeff than about the site itself.

### Decisions

- [x] Reading font: Geist Sans for post text ([#98](https://github.com/Skiddle-ID/skiddle.id/pull/98))
- [x] Series show their planned parts ([#99](https://github.com/Skiddle-ID/skiddle.id/pull/99))
- [ ] Home page design: A terminal, B editorial, C tmux or D bento ([mockups](docs/v4/))
- [ ] Home intro: lead with you, or with consulting

### v4.0-pre: a safety net first

- [x] Tests in CI, run against each PR's preview: theme and CSP checks, link checker, Lighthouse, accessibility (axe)
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

## Parked

- The Shortlink card on the projects page still has template text; update it after you change the shortlink itself
- The next v3 release: Release Drafter keeps its notes ready under GitHub → Releases
