# The pages' content on AT Protocol

Part of v4.0 ([ROADMAP.md](../../ROADMAP.md#v40-posts-and-pages-on-at-protocol)). Projects, the CV, services, uses and About move from `src/data/` into Jeff's AT Protocol repo. The pages read the records when someone asks for them, and the admin app edits them. It works the same way as posts and series, whose plan is [posts-on-atproto.md](posts-on-atproto.md).

## What moves

| Page | Today | Record | Record key |
|---|---|---|---|
| /projects/, plus the cards on the home page and the CV | `src/data/projects.ts` | `id.skiddle.project` | The project's slug, e.g. `checkdomain`: one record per project |
| /works/ (the CV) | `src/data/works.ts` and `highlights.ts` | `id.skiddle.cv` | `self` |
| /services/, plus the home page's testimonial | `src/data/services.ts` | `id.skiddle.services` | `self` |
| /uses/ | `src/data/uses.ts` | `id.skiddle.uses` | `self` |
| /about/ | `src/data/about.ts`, moved out of the page | `id.skiddle.about` | `self` |
| /now/, plus the home page's Now list (v4.1) | New; the home page's list moved to `src/data/now.ts` | `id.skiddle.now` | `self` |
| /notes/ (v4.1): the older posts it shows besides those tagged #note | New | `id.skiddle.notes` | `self` |

**What stays in git:**
- each page's own headings, one-line intros and calls to action (the redesign in v5 rewrites those)
- the rendered pages' titles, descriptions and share card commands (`list-pages.ts`)
- the status the site falls back to (`status.ts`)
- About's accent picker

## The lexicons

They're in [`lexicons/id/skiddle/`](../../lexicons/id/skiddle/): `project.json`, `cv.json`, `services.json`, `uses.json`, `about.json`, `now.json` and `notes.json`. [`src/lib/page-records.mjs`](../../src/lib/page-records.mjs) turns today's data into records. `npm run check:lexicons` checks every one against its lexicon in CI, as it does posts. Any field the converter doesn't know fails the check, so nothing gets dropped quietly.

- **One record per project.** Other records can point at a project: the CV's `selectedProjects` are `at://` addresses. Adding a project doesn't rewrite the others. The page orders them (featured first, then by year), as it does today.
- **One record for each of the other pages,** with the key `self`, like the status. Each page is edited as a whole, its lists keep the order they're written in, and one `swapRecord` guards the whole page.
- **The CV holds the highlights.** /services/ shows the same ones, and every number in them comes from the CV, the projects or the posts.
- **Renamed on the way in:**
  - `github` becomes `source`, since code can live on Tangled too
  - the CV's `yearOrStatus` becomes `when`
  - a testimonial's `serviceName` becomes `service`
  - a position that ends "Present" has no `end`
- **Markdown** for About's `intro` and `outside`, rendered like a post's text. The CV's summary stays plain paragraphs, as today. Now's `intro` is Markdown too, and each of its `items` is one line of Markdown: links, bold and italics. Raw HTML in Now shows as text.
- **Dates:** each singleton has `updatedAt`. Uses and Now show it as "last updated", which replaces `usesUpdated` on Uses. Projects have `createdAt` and `updatedAt`.

To get there, two changes to today's data, with no change to the pages:
- About's content moved out of `about.astro` into `src/data/about.ts`.
- The CV's skills became titled groups, and its selected projects moved into `works.ts`.

## Reading them

The pages work like the post pages ([`src/lib/page-content.ts`](../../src/lib/page-content.ts)). /projects/, /works/, /services/, /uses/ and /about/ are rendered on request, and so are the home page's project cards and testimonial.
- **Reading:** each page reads its records through `src/lib/pds.ts`, which caches them for a minute.
- **Same shapes, same templates:** `page-records.mjs` turns the records back into the data files' shapes, so the templates are unchanged. A unit test checks that going to records and back gives the data files exactly.
- **Caching and refresh:** pages are cached for a minute, then served stale for up to a day while a new copy renders (tag `pages`). `/api/revalidate` purges them after a save, so edits never need a build. If the PDS can't be reached, a cached page still shows.
- **Now's fallback:** until there's a Now record, /now/ and the home page show the list in `src/data/now.ts`, with no date. A malformed record or an unreachable PDS still throws, as for the other pages, so a cached page shows instead of the old list.
- **Notes** ([`src/lib/notes.mjs`](../../src/lib/notes.mjs)): /notes/ shows Jeff's Bluesky posts, read from his own repo with `listRecords`, not from the AppView. A post is a note when it has the tag `note` in any case, as a tag in its text or in its `tags`, and isn't a reply. The posts that the `id.skiddle.notes` record links to show too, replies included. Each link is a bsky.app link or an `at://` address of one of Jeff's posts. Links to other accounts' posts are left out.
  - The page reads at most 5 pages of 100 posts, newest first. A picked post older than the newest 500 doesn't show.
  - A note's text is rendered from the record with its facets: links, mentions and tags become links, and `#note` itself is muted. Images show as thumbnails from Bluesky's CDN, with their alt text. A link card shows its title and domain. A video, a feed, a list or a starter pack is a link to it on Bluesky.
  - A quoted post shows as a card, the way Bluesky shows it: the author's avatar, name and handle, the date, the text with its links, image thumbnails, a link card, and `[video]` or `[quote]` if it has one. The card links to the post. The page reads the posts its notes quote from Bluesky's public AppView (`app.bsky.feed.getPosts`, one call for up to 25 posts, 3-second timeout), and caches them for 5 minutes. A post the AppView doesn't return (deleted or blocked), or a read that fails, shows as a `[quote]` link instead, and the failure is logged (`notes:`).
  - 20 notes to a page, newest first; `/notes/?page=2` and on go back. A page past the last goes back to /notes/.
  - With no record, the page shows only the posts tagged #note. A failed read throws and is logged (`notes:`), so a cached page shows.
- **Fallback, until the switch:** a page falls back to its data file when there's no record yet, the record is malformed (a required field is missing), or the PDS can't be reached. The error is logged.
- **Where content came from:** each page says so in the `X-Content-Source` header: `pds` or `git`.
- **Parity:** `tests/parity.test.mjs` compares each page with production, built from git, in every PR's preview checks. It covers the whole `<main>`, plus the title, description and structured data. On the home page, it covers the project cards and the testimonial.

**Until the switch, keep the records and the data files the same.** Production (v3) still renders the data files. The parity check fails when a record differs from them, as it does for posts. To change a page before the switch:
1. Change the data file on v3 and on v4.
2. Use Replace in the Pages section.

Edit records freely once the pages read them in production.

## Filling them, and editing

- **Import, once:** the admin app's **Pages** section ([`src/lib/admin/pages.ts`](../../src/lib/admin/pages.ts)) writes the records from the site's data. These collections are the site's own, and v3's sync never touches them, so they can be written now, not only at the launch. From the switch, edit in the admin app, not in `src/data/`; until then, keep both the same (see above). The data files leave git at the switch, and the import with them.
  - Each row compares the record in your repo with the one the site's data makes, leaving out the dates the import sets: not in your repo yet, the same, different, or only in your repo (a project since removed from `projects.ts`).
  - **Import** writes the records that aren't there yet, with `createRecord`, so it never overwrites one.
  - **Replace** writes the site's data over a record that differs, with `swapRecord`, after you confirm. A project keeps the date it was first imported.
  - Nothing on the site changes yet: the pages read the records from step 4.
- **Sign-in:** the admin app asks for the new collections (`id.skiddle.project`, `.cv`, `.services`, `.uses`, `.about`, and `.now` and `.notes` since v4.1), so you approve it once more on Bluesky. Until then, Pages shows the records but can't write them, and offers to sign in again.
- **The editors** ([`src/lib/admin/page-editor.ts`](../../src/lib/admin/page-editor.ts)): in Pages, each name opens its editor (`#page/cv`, `#page/services`, `#page/uses`, `#page/about`, `#page/now`, `#page/notes`, `#project/<key>`), and New project starts one (`#new-project`). Each editor works like the series editor.
  - **The form is made from the lexicon** ([`lexicon-form.ts`](../../src/lib/admin/lexicon-form.ts)), so it always matches it.
    - Text boxes, with bigger ones for Markdown and a list to pick from where the lexicon knows the values. The CV's selected projects pick from the projects.
    - Lists you can add to, reorder and remove from. Groups fold, showing their first two fields.
    - The lexicon's limits are checked as you type: required fields, lengths, URLs, numbers.
  - **Saving** checks the whole record with `@atproto/lexicon`, keeps any field the form doesn't know, and sets `updatedAt` (a new project's `createdAt`). It saves with `swapRecord`, so two devices can't overwrite each other, then refreshes the page on the site.
  - **Now, before its record exists,** starts from the list in `src/data/now.ts`. Saving creates the record.
  - **Notes** is a list of links to posts. Paste a post's bsky.app link to show it on /notes/ without the #note tag.
  - **A new project** gets its key from its name. A project can be deleted after a confirm.
  - **Backup:** it keeps a copy on the device until the save works.
  - **Until the launch,** saving and deleting are off, as for posts and series (`PUBLISHING_LIVE`), because the parity check expects the records to match the data files. Changes are kept on the device.
- **The dashboard** gets one more section: Posts · Series · Pages · Status · Site.

## Steps

1. **The lexicons, checked against today's data in CI** ([#138](https://github.com/Skiddle-ID/skiddle.id/pull/138)). Done.
2. **The Pages section,** the sign-in's new collections, and the one-time import ([#139](https://github.com/Skiddle-ID/skiddle.id/pull/139)). Done.
3. **On staging, Jeff publishes the lexicons and runs the import.** Done on 2026-11-18. The five lexicons are published, the same as `lexicons/`. All 10 records match the site's data, pass their lexicons, and read back exactly as the data files. Staging's pages now say `X-Content-Source: pds`, and the parity check against production passes.
4. **v4's pages read the records,** with a fallback to the data files and a parity check against production ([#140](https://github.com/Skiddle-ID/skiddle.id/pull/140)). Done. Until the import, staging shows the data files (`X-Content-Source: git`).
5. **The editors** ([#141](https://github.com/Skiddle-ID/skiddle.id/pull/141)). Done. Saving turns on at the switch, with `PUBLISHING_LIVE`.
6. **At the switch:** done on 2026-11-18 ([#143](https://github.com/Skiddle-ID/skiddle.id/pull/143)). Remove the data files (`projects.ts`, `works.ts`, `highlights.ts`, `services.ts`, `uses.ts`, `about.ts`), and with them:
   - the pages' fallback to them (`src/lib/page-content.ts`)
   - the import (`src/lib/admin/pages.ts`) and the converters to records (`page-records.mjs`)
   - the data part of `check:lexicons` and the round-trip test
   - the parity test

   First move the types that live in the data files (`About`, `Highlight`, `UsesSection`) to `src/types/`, next to the others, since the pages still use them.

## Before the import

Everything in a record is public and goes out on the network. Copies can stay in other services after a delete. Everything on these pages is already public on skiddle.id, but a record travels further. Two things to look at before importing:
- **About's "Outside of work"** mentions ADHD.
- **Email addresses:** the CV has one (`jeff@skiddle.id`), and About has two (`work@skiddle.id` and `jeff@skiddle.id`).

Anything that should stay on the site but not in your repo can stay in the page template instead.

The import on 2026-11-18 wrote both as the site shows them. Removing either later takes an edit after the switch, and copies made before then can stay elsewhere.
