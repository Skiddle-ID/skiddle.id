# Posts and series on AT Protocol

The plan for v4: posts and series live only in Jeff's AT Protocol repo (`did:plc:xaj6j6abvpgwps5v6k4t6clv`), are written and published from the admin app, and the site renders them when someone asks for a page. Publishing, editing and scheduling never need a rebuild; only code and design changes do. Everything fits Cloudflare's free Workers plan.

The roadmap tracks progress in [ROADMAP.md](../../ROADMAP.md#v4-posts-and-series). The decisions made along the way are at the end of this page.

## What changes

| | Today | v4 |
|---|---|---|
| Where a post lives | `src/content/posts/*.md` in git, copied to a `site.standard.document` record on publish | Only the `site.standard.document` record |
| Where series live | `src/data/series.ts` | One `id.skiddle.series` record each |
| Writing | An editor and a pull request | The admin app, on a phone or a laptop |
| Publishing | Merge to `v3`, a build, then three GitHub workflows | One button in the admin app |
| A typo fix | A pull request and a build | Save in the admin app |
| Scheduled posts | GitHub's hourly run, which it sometimes skips | A Cloudflare cron every 5 minutes |
| When the site shows a change | After the build, a few minutes | Within about a minute, immediately after a publish |

## Standard.site, and what we add

[Standard.site](https://standard.site) publishes these lexicons: `site.standard.publication`, `site.standard.document`, `site.standard.theme.*`, `site.standard.graph.subscription` and `.recommend`, and two OAuth permission sets.

**Posts: Standard.site's document is enough for the published post**, so each post stays one `site.standard.document`, with the record key it has today. Links, Bluesky comments and readers like Leaflet keep working. It already has:

- `title`, `description`, `publishedAt`, `updatedAt`, `tags`, `path` and `site`
- `coverImage` (the share card), `textContent` (plain text for readers and search), `bskyPostRef` (the announcement, for comments)
- `content`, an open union "extended with other lexicons to support additional content formats". pckt.blog already puts its own `blog.pckt.content` there.

What it doesn't have, so we add our own `id.skiddle.post` type inside `content`:

- the Markdown, and the images it shows
- category, language, series and part, and featured

**Series: Standard.site has nothing for them.** Its `links` field is an empty union with no defined types, so we add `id.skiddle.series` records.

**Drafts: Standard.site has no draft state**, and readers list every `site.standard.document` they find. Unpublished posts go in `id.skiddle.draft` records instead (decision 1).

All our lexicons are named `id.skiddle.<name>`, so the `_lexicon.skiddle.id` DNS record that's already in place covers them. Once a lexicon has records, it can only gain optional fields, so these are drafts until they ship.

### `id.skiddle.post` (draft)

An object, not a record: the value of a document's `content`.

```json
{
  "lexicon": 1,
  "id": "id.skiddle.post",
  "defs": {
    "main": {
      "type": "object",
      "description": "skiddle.id's content for a site.standard.document: the post's Markdown and what Standard.site doesn't have.",
      "required": ["markdown"],
      "properties": {
        "markdown": {
          "type": "string",
          "maxLength": 200000,
          "description": "The post body: CommonMark with GitHub's extensions (tables, footnotes, strikethrough). An image is written ![alt](image:NAME), NAME being one of `images`."
        },
        "images": { "type": "array", "maxLength": 50, "items": { "type": "ref", "ref": "#image" } },
        "category": { "type": "string", "maxLength": 32, "knownValues": ["infra", "atproto", "homelab", "life"] },
        "lang": { "type": "string", "format": "language", "description": "The post's language, e.g. 'en' or 'id'. Absent means English." },
        "series": { "type": "ref", "ref": "#seriesPart" },
        "featured": { "type": "boolean" }
      }
    },
    "image": {
      "type": "object",
      "required": ["name", "image", "alt"],
      "properties": {
        "name": { "type": "string", "maxLength": 64 },
        "image": { "type": "blob", "accept": ["image/*"], "maxSize": 1000000 },
        "alt": { "type": "string", "maxGraphemes": 1000 },
        "caption": { "type": "string", "maxGraphemes": 300 },
        "width": { "type": "integer", "minimum": 1 },
        "height": { "type": "integer", "minimum": 1 }
      }
    },
    "seriesPart": {
      "type": "object",
      "required": ["series", "part"],
      "properties": {
        "series": { "type": "string", "format": "at-uri", "description": "An id.skiddle.series record." },
        "part": { "type": "integer", "minimum": 1 }
      }
    }
  }
}
```

Width and height stop the page jumping while an image loads. The admin app shrinks images to under 1 MB before uploading. The one post photo today is 720 KB.

### `id.skiddle.series` (draft)

```json
{
  "lexicon": 1,
  "id": "id.skiddle.series",
  "defs": {
    "main": {
      "type": "record",
      "key": "any",
      "description": "A series of posts on skiddle.id. The record key is the series' slug, e.g. from-fear-to-flight.",
      "record": {
        "type": "object",
        "required": ["name", "createdAt"],
        "properties": {
          "name": { "type": "string", "maxGraphemes": 100 },
          "description": { "type": "string", "maxGraphemes": 1000 },
          "ongoing": { "type": "boolean", "description": "A series with no last part, like a weekly one." },
          "cadence": { "type": "string", "maxGraphemes": 64, "description": "How often new parts come out, e.g. 'every week'." },
          "planned": { "type": "array", "maxLength": 100, "items": { "type": "ref", "ref": "#plannedPart" } },
          "coverImage": {
            "type": "blob",
            "accept": ["image/*"],
            "maxSize": 1000000,
            "description": "The series' share card, drawn by the admin app when the series is saved. Named like site.standard.document's."
          },
          "createdAt": { "type": "string", "format": "datetime" },
          "updatedAt": { "type": "string", "format": "datetime" }
        }
      }
    },
    "plannedPart": {
      "type": "object",
      "required": ["part", "title"],
      "properties": {
        "part": { "type": "integer", "minimum": 1 },
        "title": { "type": "string", "maxGraphemes": 300 }
      }
    }
  }
}
```

It's what `src/data/series.ts` holds today, plus a share card. A post says which series it belongs to and which part it is; a published part replaces the planned one with the same number, as now.

### `id.skiddle.draft` (draft)

A post that isn't published yet. Record key: a TID.

- The same fields as the post will have: `title`, `description`, `tags`, `path`, and `content` (an `id.skiddle.post`)
- `publishAt` (optional): when it's scheduled
- `coverImage` (optional): the share card, made when the draft is scheduled, so the cron doesn't have to draw it
- `createdAt`, `updatedAt`

## Serving posts without rebuilds

**Pages are rendered when someone asks for them, and cached.** This is how the status already works.

- **Loading:** Astro 7's live collections (`src/live.config.ts`) get a loader that reads the records from the PDS: `posts` from `site.standard.document`, `series` from `id.skiddle.series`. The PDS is looked up from the DID, so a PDS move just works.
  - Entries keep the shape `getPosts()` returns today, so the pages barely change.
- **Markdown to HTML:** done in the Worker with a light renderer (`marked`). It takes 0.1–0.5 ms per post, measured on all 15 posts, against the free plan's 10 ms of CPU per request.
  - `image:NAME` links become `/media/<cid>`.
  - No post has code blocks today. If one does later, the admin app highlights the code when it's published.
- **On request:** these routes are rendered when asked for (`prerender = false`):
  - `/`, `/posts/`, `/posts/<slug>/` and the old `/posts/<rkey>` redirects
  - `/series/`, `/topics/` and `/topics/tag/<tag>/`
  - `/rss.xml`, `/sitemap.xml`, `/search.json`, `/latest.json`
  - `/latest.svg` already is. About, uses, works, projects and services stay built until their content moves into records, also in v4.0.
- **Caching:** Astro 7's route cache with the Cloudflare provider (`cacheCloudflare()`), and route rules giving those routes a short max age (about a minute) and the tag `posts`. Cached pages are served from Cloudflare's cache in front of the Worker, so they cost no Worker CPU (and, to be confirmed on staging, don't count towards the free plan's 100,000 requests a day).
- **Instant refresh after a save:** a small endpoint, `/api/revalidate`.
  - It reads the repo's latest revision (`com.atproto.sync.getLatestCommit`). If the revision changed since the last check, it purges the `posts` tag.
  - It needs no login, because it only purges when the repo really changed.
  - The admin app calls it after every save; the cron calls it after a scheduled publish.
- **Images and share cards:** `/media/<cid>` serves blobs from the repo with a cache that never expires, since a CID is the hash of the file. See [Share cards](#share-cards).
- **A growing archive:** list pages read a small index of posts (no Markdown), rebuilt once per repo change and cached. That keeps the CPU per request low at hundreds of posts.
- **Security headers:** the middleware gives rendered HTML pages the site's CSP. The script hashes that `_headers` gets at build time move into a shared module.
- **If the PDS is down:** cached pages keep being served. A page nobody has opened since the last change shows a short "can't reach the posts right now" page.

## Share cards

Share cards stay stored images. Drawing one is the heaviest thing the site does: the last build drew 51 in 15.5 seconds, about 300 ms each, some 30 times the free plan's 10 ms of CPU. So cards for posts and series are drawn once, in the browser, and kept in the records; the Worker only serves them.

| Page | Its card | Drawn |
|---|---|---|
| A post | Its document's `coverImage`, Standard.site's own field. Readers show it as the post's thumbnail, and the Bluesky link card reuses the same blob | By the admin app when the post is published, and again when its title or description changes |
| A series, if series get their own pages (`/series/<slug>/`) | The series' `coverImage` | By the admin app when the series is saved |
| A tag (`/topics/tag/<tag>/`) | The Topics card | At build time. Tags now come and go without a build, so there's no card per tag (today there are 29) |
| Home, About, Uses, the post and series lists, and the other built pages | Their own card, as today | At build time |

- A post's `og:image` is `/media/<cid>` of its `coverImage`.
- The card design is one module, shared by the build and the admin app (satori, with resvg's Node build at build time and its WebAssembly build in the browser), so both draw the same card.
- **Changing the design:** built cards update with the next build, but stored ones don't. **Check share cards**, in the admin app's Site section ([`src/lib/admin/redraw.ts`](../../src/lib/admin/redraw.ts)), redraws every stored card and compares each with the stored one by its CID. Drawing is deterministic, so an unchanged card comes out byte for byte the same. It covers:
  - every published post
  - every series
  - every scheduled draft

  It lists the cards that changed, or that have none yet, with the new card. **Save** uploads them and saves only each record's `coverImage`, with `swapRecord`, so a post's "updated" date stays. Bluesky posts keep the card they were announced with. It also catches cards that went stale without a design change, like the part count of a series that isn't ongoing when another part is published. Saving starts at the launch, like the rest of publishing.
- **A separate cover photo:** not now. Only the MDX demo uses today's `cover` field, to show its own share card at the top, and no real post has a hero photo. If the v4 design adds them, `id.skiddle.post` can gain an optional `cover` naming one of its images; adding optional fields is always allowed.

## The admin app

It gets a post editor, built on the first version (`/admin/`).

- **Write:** Markdown with a live preview that uses the same renderer as the Worker. Add images, which are shrunk and uploaded as blobs. Pick the series and part, category, tags and language. Drafts save as you type, as `id.skiddle.draft` records, so a post started on the phone can be finished on the laptop.
- **Publish now:**
  1. Draw the share card in the browser (satori and resvg's WebAssembly build, the same design as today) and upload it.
  2. Write the `site.standard.document`: the content, plain text, tags, path `/posts/<slug>/`, and a TID made from the publish time.
  3. Post on Bluesky with a link card, reusing the share card's blob. Add `bskyPostRef` to the document, which turns comments on.
  4. Delete the draft and call `/api/revalidate`.
- **Schedule:** set a time. The share card is made then and stored on the draft; the cron does the rest.
- **Edit a published post:** saves straight to its record, with `swapRecord`, so two devices can't overwrite each other. It sets `updatedAt` and redraws the share card if the title or description changed.
- **Unpublish:** deletes the document, and optionally the Bluesky post, after a confirmation.
- **Series:** create and edit them, including planned parts, ongoing and cadence. Saving draws the series' share card.
- **Check share cards** (Site): redraws every stored card, lists the ones that changed and saves them. For after a change to the card design.
- **Sign-in:** Bluesky's approval page asks for more access.
  - Write `site.standard.document`, `id.skiddle.series` and `id.skiddle.draft`
  - Create posts on Bluesky (`repo:app.bsky.feed.post?action=create`)
  - Upload images (`blob:image/*`)
  - Standard.site's `authFull` permission set could replace the Standard.site part.

## Scheduled posts

A small separate Worker, [`workers/publisher`](../../workers/publisher/README.md), with a cron trigger every 5 minutes (the free plan allows cron triggers):

1. List the `id.skiddle.draft` records whose `publishAt` has passed, oldest first.
2. For each:
   - write the document, dated `publishAt`, with the share card stored on the draft
   - call `/api/revalidate` and wait for the page
   - post on Bluesky
   - add `bskyPostRef`
   - delete the draft
3. Make every step safe to retry. The document and its Bluesky post get the same record key, made from the slug and `publishAt`, so a run that stops part-way is finished by the next without posting twice.
   - A draft edited after its post went up is kept and unscheduled, not deleted.

It signs in with a Bluesky app password stored as a Worker secret, which Jeff sets with `wrangler secret put`. It replaces "Publish scheduled posts", "Announce posts on Bluesky" and "Publish posts to AT Protocol".

Scheduling happens in the admin app's editor: pick a time and press **Schedule**. The share card is drawn then, for that date, and stored on the draft. Edits that change the card (title, description, length) redraw it as the draft saves. **Publish** on a scheduled draft unschedules it first.

## Backups

Once the posts are only in the PDS, they need a copy somewhere else. Every Sunday, [Back up the AT Protocol repo](../../.github/workflows/backup.yml) runs [`scripts/backup.mjs`](../../scripts/backup.mjs). It attaches one `backup-YYYY-MM-DD.tar.gz` to the `backups` release on GitHub and keeps the newest four. None of it adds to the git history. Each one holds:

- `repo.car`: every record in the repo, Bluesky's too, as the PDS exports it (`com.atproto.sync.getRepo`). This is what a move to another PDS imports.
- `blobs/<cid>`: every image and other file the records point to (`com.atproto.sync.listBlobs` and `getBlob`)
- `plc-log.json`: the DID's history from plc.directory (its handles, PDSes and keys)
- `manifest.json`:
  - when it was made, and from which PDS
  - the commit
  - how many of the site's records there are
  - each blob's type and size
  - any blob the PDS no longer has

It checks every block of the CAR file and every blob against its hash. A broken download fails the run, and GitHub emails about it, so a broken backup never replaces a good one. For the same reason it refuses to back up a repo with no posts. Today a backup is about 14 MB and takes a minute.

The release is public, like the repo it copies. A deleted record stays in the backups for up to four weeks.

**Restoring.** [goat](https://github.com/bluesky-social/goat), Bluesky's command-line tool, reads the CAR file:
- `goat repo ls repo.car` lists the records.
- `goat repo unpack repo.car` writes each one out as JSON.

A lost post or series can be written back from its JSON, and its images from `blobs/`.

To move the whole account to a new PDS:
1. Import the records with `com.atproto.repo.importRepo` (`goat repo import`).
2. Upload each file in `blobs/` with `com.atproto.repo.uploadBlob`. `com.atproto.repo.listMissingBlobs` shows what's left.
3. Point the DID at the new PDS with a PLC operation.

Step 3 needs the private half of one of the DID's rotation keys. `plc-log.json` lists them. Bluesky holds its own. With a key of your own, kept somewhere safe, the account can move even if Bluesky's PDS is gone. Without one, the records could only come back under a new DID. `goat account plc add-rotation-key` adds one.

## Migration, step by step

v3 stays live and keeps publishing from git until the switch.

1. **Lexicons:** add `id.skiddle.post`, `id.skiddle.series` and `id.skiddle.draft` to `lexicons/`, and publish them from the admin app. Retire the MDX demo post (decision 2) before the next step, so it never becomes a record.
2. **Fill the records from git:** v3's AT Protocol sync also writes each post's `content`: the Markdown, its images as blobs, and category, language, series and featured. It writes the series records from `src/data/series.ts` (their share cards come with series pages, from the admin app). From then on the records match git after every post. Done in [#124](https://github.com/Skiddle-ID/skiddle.id/pull/124).
3. **pckt.blog's six posts:** move them to the skiddle.id publication, keeping their record keys (`MOVE_PCKT_DOCUMENTS`, decision 3). They then disappear from skiddle-blog.pckt.blog. Done in [#125](https://github.com/Skiddle-ID/skiddle.id/pull/125): all 14 posts are skiddle.id records with their content.
4. **v4 reads the records:** the live collections, the route cache, `/media/` and `/api/revalidate`, on staging.
5. **Parity check:** a test compares every post on staging (built from records) with production (built from git): titles, dates, text, links, images and series. Any difference blocks the switch.
6. **The admin app's editor:** drafts, publish, schedule, edit and series. Then the cron Worker and the backups.
7. **The switch, at the v4 launch:** publish the last post from git, run the sync one last time, and make v4 production. Run the backup once by hand and check the release. Then remove what git no longer needs.

## What leaves the repo at launch

- `src/content/posts/` and `src/assets/posts/` (about 780 KB with the photo)
- `src/data/series.ts`
- MDX support: the demo post is retired, so `src/components/mdx/` and `@astrojs/mdx` go too
- The workflows "Publish scheduled posts", "Announce posts on Bluesky" and "Publish posts to AT Protocol"
- Their scripts: `publish-scheduled`, `bluesky-announce`, `standard-site-sync` and `mark-updated`
- Drawing share cards for posts and tags at build time
- The README's "Writing a post" section, which then points to the admin app

Git keeps old files in its history, so a clone stays about the same size. What gets smaller is the checkout and the work: there are no post files to keep in sync, and no build for content.

## Decisions

Made on 2026-11-17, each the recommended option.

1. **Drafts are `id.skiddle.draft` records.** They sync between the phone and the laptop, and scheduling just works. Anyone who looks can read them on the PDS. Drafts are just as public in the git repo today, though records also go out on the network to anyone following it. Not chosen: drafts kept on one device (private, but no sync), or encrypted records (private and synced, but more work).
2. **The MDX demo post is retired.** It's a draft that tests components, not writing, and it's the only post that uses MDX or `src/components/mdx/`.
3. **pckt.blog's six posts move to the skiddle.id publication.** One record per post. They disappear from skiddle-blog.pckt.blog. Not chosen: keeping pckt's records and adding separate ones, which readers would show twice.

## Risks

- **Cloudflare's cache layer for Workers on the free plan.** It should work, but it's checked on staging first. If it doesn't, the pages use the Workers Cache API directly, as the status does today.
- **Everything is public.** Every saved record goes out on the network straight away, and copies may stay in other services after a delete. Nothing private goes in the repo (see decision 1).
- **The PDS is a dependency.** Cached pages cover short outages, and the weekly backups cover losing the account's data. If Jeff moves to his own PDS, the site follows the DID.
- **Lexicons are hard to change.** Once there are records, they can only gain optional fields. That's why they're drafted here and checked against all 15 posts before they ship.
