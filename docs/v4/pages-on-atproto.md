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

**What stays in git:**
- each page's own headings, one-line intros and calls to action (the redesign in v5 rewrites those)
- the list pages' titles (`list-pages.ts`)
- the status the site falls back to (`status.ts`)
- About's accent picker

## The lexicons

They're in [`lexicons/id/skiddle/`](../../lexicons/id/skiddle/): `project.json`, `cv.json`, `services.json`, `uses.json` and `about.json`. [`src/lib/page-records.mjs`](../../src/lib/page-records.mjs) turns today's data into records. `npm run check:lexicons` checks every one against its lexicon in CI, as it does posts. Any field the converter doesn't know fails the check, so nothing gets dropped quietly.

- **One record per project.** Other records can point at a project: the CV's `selectedProjects` are `at://` addresses. Adding a project doesn't rewrite the others. The page orders them (featured first, then by year), as it does today.
- **One record for each of the other pages,** with the key `self`, like the status. Each page is edited as a whole, its lists keep the order they're written in, and one `swapRecord` guards the whole page.
- **The CV holds the highlights.** /services/ shows the same ones, and every number in them comes from the CV, the projects or the posts.
- **Renamed on the way in:**
  - `github` becomes `source`, since code can live on Tangled too
  - the CV's `yearOrStatus` becomes `when`
  - a testimonial's `serviceName` becomes `service`
  - a position that ends "Present" has no `end`
- **Markdown** for About's `intro` and `outside`, rendered like a post's text. The CV's summary stays plain paragraphs, as today.
- **Dates:** each singleton has `updatedAt`. Uses shows it as "last updated", which replaces `usesUpdated`. Projects have `createdAt` and `updatedAt`.

To get there, two changes to today's data, with no change to the pages:
- About's content moved out of `about.astro` into `src/data/about.ts`.
- The CV's skills became titled groups, and its selected projects moved into `works.ts`.

## Reading them

The pages work like the post pages. They read the records when someone asks for them (Astro live collections), keep the result in the route cache, and refresh after a save (`/api/revalidate`). Edits never need a build. If the PDS can't be reached, a cached page still shows. On staging, a parity check compares each page built from records with production, built from git, before the switch.

## Filling them, and editing

- **Import, once:** the admin app's new **Pages** section writes the records from the site's data. These collections are the site's own, and v3's sync never touches them, so they can be written now, not only at the launch. After the import, edit in the admin app, not in `src/data/`. The data files leave git at the switch.
- **Sign-in:** the admin app asks for the new collections (`id.skiddle.project`, `.cv`, `.services`, `.uses`, `.about`), so you approve it once more on Bluesky.
- **The editors:** Pages lists the projects (each opens an editor), the CV, services, uses and About. Each editor is a form shaped like its lexicon, like the series editor:
  - It saves with `swapRecord`, so two devices can't overwrite each other.
  - It keeps a copy on the device until the save works.
  - It refreshes the page on the site.
- **The dashboard** gets one more section: Posts · Series · Pages · Status · Site.

## Steps

1. **The lexicons, checked against today's data in CI.** That's this step, with this page.
2. **Publish the lexicons** from the admin app (Site → Lexicons lists every file in `lexicons/`).
3. **Import:** the Pages section, the sign-in's new collections, and the one-time import.
4. **v4's pages read the records,** checked for parity against production.
5. **The editors.**
6. **At the switch:** remove the data files (`projects.ts`, `works.ts`, `highlights.ts`, `services.ts`, `uses.ts`, `about.ts`) and their types.

## Before the import

Everything in a record is public and goes out on the network. Copies can stay in other services after a delete. Everything on these pages is already public on skiddle.id, but a record travels further. Two things to look at before importing:
- **About's "Outside of work"** mentions ADHD.
- **Email addresses:** the CV has one (`jeff@skiddle.id`), and About has two (`work@skiddle.id` and `jeff@skiddle.id`).

Anything that should stay on the site but not in your repo can stay in the page template instead.
