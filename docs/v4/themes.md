# Themes and layout

Planned on 2026-11-27 ([ROADMAP.md](../../ROADMAP.md#v44-themes-and-layout)) and reviewed on 2026-11-28 against the AT Protocol specs, Leaflet's lexicons and Cloudflare's limits ([the review](#the-review)). Phases 1 to 5, the design, the frame, the site's pages on blocks and pages of Jeff's own, are built (see [Phases](#phases)); the share cards' design, the logo and the site's mode and accent already lived in `id.skiddle.theme` ([#194](https://github.com/Skiddle-ID/skiddle.id/pull/194), [#195](https://github.com/Skiddle-ID/skiddle.id/pull/195)).

The site becomes a complete CMS on AT Protocol: its design, its layout and every page's content are set in the admin app and kept as records in Jeff's repo, like the posts. That covers:

- **design:** colours for dark and light, fonts, sizes, corners and spacing
- **the frame:** the menu, the footer and what the sidebar shows
- **layout:** each page as rows of blocks, side by side on wide screens
- **blocks:** the pieces a page is made of, from a Markdown section to recent posts
- **pages of Jeff's own,** at an address he picks

## The rule: code defines, records arrange

The site ships a fixed set of blocks and design settings, each a tested component that's accessible, fast and allowed by the site's security policy. Records only choose which ones a page uses, in what order, with what options, and the theme's values. No record holds raw HTML, CSS or scripts. That keeps every page safe, fast and accessible whatever is changed in the admin app, and a new kind of block is a PR, like any code.

Every lexicon is our own (`id.skiddle.*`). Block shapes are kept close to the common ones (a heading, text, an image), so they could be mapped onto other apps' later, but nothing depends on a lexicon someone else controls.

The lexicons follow AT Protocol's rules for changing a published lexicon: a new field is always optional, and a type, a required field or a length limit never changes ([the spec](https://atproto.com/specs/lexicon#lexicon-evolution)). So every limit (how many blocks a page holds, how long the menu is) is picked once, with room to spare, when its lexicon is first published.

**The redesign stays on hold.** This is the engine. It ships with today's look as its only preset and adds no new design. When the v5 direction is picked in January, it becomes a preset and layouts in this system, not a rebuild.

## The records

Three records hold it all. Real lists of things keep their own collections, and blocks point at them.

| Record             | Key                                             | Holds                                                                                                                    |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id.skiddle.theme` | `self`                                          | The design: colours, fonts, sizes, corners, spacing, the cards' design, the default mode and accent                      |
| `id.skiddle.site`  | `self`                                          | What it already has (name, metadata, icon, profiles), plus the frame: the menu, the footer links, what the sidebar shows |
| `id.skiddle.page`  | the page's address: `home`, `about`, `speaking` | A page: its title, description, share card and blocks                                                                    |

`id.skiddle.page` replaces the seven lexicons that exist only because each page had its own shape:

| Merged into `id.skiddle.page`                             | Kept as they are                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `about`, `cv`, `home`, `notes`, `now`, `services`, `uses` | `post`, `draft`, `series`, `project`, `event`, `status`, `statusLog`, `media`, `categories`, `site`, `theme` |

That's 18 lexicons down to 12, and a new page never needs a new one. A draft of a page is the same record under `<page>~draft` (`home~draft`): `~` is allowed in a record key, and a page's own address never has one, so anything that lists pages (the sitemap, search, the admin's list) leaves out the keys with a `~`. A page's key is its address, so a page of Jeff's own is one level deep (`/speaking/`): a record key can't hold a `/` ([record keys](https://atproto.com/specs/record-key)).

## Design: `id.skiddle.theme`

The theme becomes the site's design tokens. Each is optional; one left out keeps today's value (`src/style.css`), so an empty record is today's site.

- **Colours, for dark and for light:** background, alternate background, border, text, muted text, and the five accents. Each is stored as numbers, `{ r, g, b }` from 0 to 255, never as text, the shape Standard.site and Leaflet use for theirs (`site.standard.theme.color#rgb`, `pub.leaflet.theme.color#rgb`), defined in our own lexicon. A colour goes into the page's `<style>`, and a number can't carry anything else into it, so no record can inject CSS. The mode and default accent stay as they are.
- **Fonts:** one for headings and menus, one for text, one for post text and one for code, each picked from a catalogue the site bundles and serves itself (`@fontsource`). Today: Geist Mono for all but post text, which is Geist. Only the fonts in use are preloaded.
- **Sizes:** the base text size (in steps, not pixels) and the line height for text and for posts.
- **Shape:** corner radius (none, small, round) and spacing (compact, normal, roomy).
- **Decoration:** the terminal touches, each one a switch named so that off is today's look: `noPrompt` (the `$` prompts), `noCursor` (the blinking cursor), `noHeadingMarks` (the `##` before headings). AT Protocol's style guide asks for optional booleans whose default is `false`, and it keeps an empty record meaning today's site.

The page gets the theme as CSS variables in a `<style>` in its head (the security policy allows inline styles). The share cards follow the colours and the heading font.

**Contrast:** the editor checks every text colour against its background and won't save one under WCAG AA (4.5:1, 3:1 for large text), in both modes.

## The frame: `id.skiddle.site`

- **Menu:** the sidebar's links, in order: a label, a link (a page or any address) and an icon from the site's set. The command bar lists the same.
- **Footer:** its links.
- **What the sidebar shows:** the music card and the theme and accent buttons, each a switch that hides it (`hideMusic`, `hideThemeButtons`), so leaving it out shows it, as today. The plan had `hideStatus` too, but the sidebar shows no status.

Where the frame sits (a sidebar on the left) stays in code. A top bar or another frame is design, and waits for the redesign.

## Layout

A page is a list of blocks, each with a width: **full**, **half** or **third**. They flow into rows: a half beside a half, three thirds, a full one alone. On a phone, every block is full width, in the same order, which is also the order screen readers read them in. That's the whole layout system: enough for "Now beside the status, then projects below", and nothing can be placed where it breaks on a small screen.

A page also has a width (narrow for reading, wide for grids) and can hide the page heading.

## Blocks

Each block is an Astro component in `src/components/blocks/`, with its shape as a def in `id.skiddle.page` (`#markdown`, `#jobs`…), a lenient reader and a registry entry. Every block renders inside a wrapper: one that fails shows nothing and logs the error, and the rest of the page renders.

In the record, a page's `blocks` is a list of `#block` objects, each holding the block's layout and the block itself: `{ width, block }`, where `block` is a union of the block defs. Leaflet's pages have the same shape (`pub.leaflet.pages.linearDocument#block`: `{ block, alignment }`), and it keeps layout apart from content: a new layout option is a new optional field on `#block`, whatever the block.

The union is **open**, as AT Protocol's style guide asks "in almost all situations", so a new kind of block is added without breaking the lexicon. A block the site doesn't know (one added by a newer admin app on another device) is left out of the page, and the editor keeps it as it is, shown as "an unknown block", so saving never drops it.

**Text and media:**

- **Markdown:** a section of text, rendered and sanitised as posts are
- **Heading** with an optional `##` and anchor
- **Image:** a library image (`/media/<cid>`), its alt text and caption
- **Quote** and **callout** (note, tip, caution)
- **Links:** a list of links, optionally as buttons
- **Call to action:** a title, a line and a button ("Hire me")

**The site's data**, read from its collections, so they stay current:

- **Recent posts:** how many, from which category or series
- **Series:** all, or picked ones
- **Projects:** picked ones, in order, or all of a category
- **Status**, **Now playing**, **This week**, **Upcoming** (from the timeline)
- **Bluesky posts:** picked ones, as `/notes/` shows them

**About Jeff**, the shapes the pages have now, kept as their own blocks so they keep their meaning:

- **Profile:** greeting, tagline, photo
- **Jobs** and **education** (the CV)
- **Highlights**, **principles**, **So far** (About's life timeline)
- **Services** and **testimonials**
- **Uses:** sections of items
- **Now:** the list, with its date
- **Contact**

Today's pages, as blocks:

| Page           | Blocks (the kinds in `src/lib/page-blocks.mjs`)                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Home           | profile (with the status), markdown (intro), links (buttons), now, thisWeek, projects, recentPosts (with the series), testimonials, callToAction, links (Elsewhere) |
| About          | facts, section (intro), principles, soFar, section (outside work), contact                                                             |
| CV (`/works/`) | cvHeader (with the highlights), jobs, skills, projectGrid, education (with the certifications), cvContact                               |
| Services       | servicesIntro, highlights, services, steps, reviews, brief                                                                              |
| Uses           | uses                                                                                                                                    |
| Now            | nowFull                                                                                                                                 |
| Notes          | blueskyPosts                                                                                                                            |

Post pages, `/posts/`, series, topics and `/timeline/` stay templates: they're views of collections, not layouts. They can get small settings later (show the series bar, comments), not blocks.

## The admin app

- **Site → Theme:** colours (pickers, with the contrast check as you go), fonts, sizes, shape and decoration, beside a live preview of a sample page in dark and light. **Reset** goes back to today's look.
- **Site → Site and SEO** gains the menu and the footer, in lists you drag into order.
- **Content → Pages** lists the page records. The block editor:
  - add a block from the catalogue, remove one, drag to reorder, set its width
  - each block's options as a form made from its lexicon def (as the page editors are now)
  - **Save draft** writes `<page>~draft`; **Preview** opens the page reading the draft (`?preview=draft`, not cached, not indexed); **Publish** copies the draft over the page and draws its share card
  - **New page:** a title and an address
- **Move to blocks**, on each old page: turns its old record into its `id.skiddle.page` record, keeping the content, as a draft to check and publish.

## Pages of Jeff's own

A new page lives at the address he picks, e.g. `/speaking/`. Addresses the site already uses (`posts`, `series`, `admin`, `api`…) can't be picked. A page is in the sitemap and the search, can be in the menu, and gets its own share card: the admin draws it when the page is published and keeps it in the record, as a series' is, so it needs no deploy. How it's built is in [phase 5](#phases).

## How it renders

Pages render on request, as now: a page reads its record and the collections its blocks use, all cached like the other records and purged when the admin saves. Blocks are server-rendered; only those that update live (the status, the music) load a script.

**The free plan's budget.** A Worker on Cloudflare's free plan has 10 ms of CPU and 50 subrequests per request, and Cloudflare puts server-side rendering at "typically 10-20 ms" ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)). Most visits never render, since pages are cached at the edge, but a page that does has to fit. So:

- reads are shared within a request: each collection is read once, however many blocks use it (two blocks with posts read the posts once)
- each data block says what it reads, so the editor can warn when a page would read too much
- phase 3 measures the home page's CPU time and subrequests with its blocks, against a budget (under 5 ms of CPU and 25 subrequests), before any other page moves

If a page's record can't be read or isn't there, the page uses its built-in version, today's. If the theme can't be read, the site has today's look.

## Moving over

Pages move one at a time. Until a page is moved, it reads its old record as now; once it has a `page` record, it reads that first, then the old one, then the built-in text. **Move to blocks** does the move for a page; publishing it is Jeff's step. When every page has moved, one PR stops using the old lexicons and drops their permissions (a new sign-in). Their published schemas stay, marked deprecated in their descriptions: AT Protocol has no way to retire a published lexicon other than leaving it be, and others may still resolve it. Deleting the old records is Jeff's call, since it can't be undone. Backups list the new collection.

## Phases

1. **Design.** The theme's colours, fonts, sizes, shape and decoration; the Theme editor with its live preview and contrast check; share cards follow. **Built** ([#198](https://github.com/Skiddle-ID/skiddle.id/pull/198)): `src/lib/site-theme.mjs` reads the record and writes the page's CSS variables, which `src/style.css` reads with today's values as fallbacks. The font catalogue is Geist, Geist Mono, IBM Plex Sans, IBM Plex Mono, Inter, JetBrains Mono and Source Serif 4. Every theme colour is used for body-size text somewhere, so the contrast check asks 4.5:1 of each, never the 3:1 of large text.
2. **The frame.** The menu, the footer and the sidebar's parts in `id.skiddle.site`; the sidebar, the command bar and the footer read them. **Built** ([#199](https://github.com/Skiddle-ID/skiddle.id/pull/199)): `menu` (up to 50 items, each a label, a link and an optional icon), `footerLinks` (up to 30), `hideMusic` and `hideThemeButtons`, read by `src/lib/site-meta.mjs`, which drops a link that isn't a site path, an `https:` or a `mailto:` address. The built-in menu, footer links and command bar pages are in `src/data/frame.ts`. The command bar lists the site's pages and, when the record sets a menu, its other links. There's no `hideStatus`: the sidebar shows no status, so it waits until it does.
3. **Pages from blocks, starting with home.** `id.skiddle.page`, the block registry and wrapper, the blocks home needs, the block editor with draft, preview and publish, and page share cards drawn in the admin app. **Built** ([#200](https://github.com/Skiddle-ID/skiddle.id/pull/200)):
   - `src/lib/page-blocks.mjs` reads a page record leniently and has `BLOCKS`, the one table of kinds: how each is read, what it reads and its heading's id. Each kind is a component in `src/components/blocks/`, laid out in rows by `blocks.astro`; `frame.astro` renders each one first, so one that fails is left out and logged. Side by side, blocks line up at the top, and a block that shows nothing leaves no gap. `scripts/page-blocks.test.mjs` checks every kind has its def, reader and component.
   - Home's nine kinds: profile (with the status line), markdown, links (buttons or a line), now, this week, projects, recent posts (with the series' cards), testimonials and call to action. The quick links and the hire box's buttons, which were in the page's code, are links in the record now. Markdown renders like the Now page's intro: raw HTML shows as text.
   - Until `home` is published, the home page renders its old record turned into blocks (`homePageFromLegacy`), so every deploy runs the blocks. `scripts/parity.mjs` found its `<main>`, title, description and JSON-LD the same as the live page's; only whitespace between blocks and between buttons in flex rows differs, which doesn't render.
   - Each source the blocks read is loaded once per request, all started together (`src/lib/page-data.ts`). A source that fails fails the page, as before, so a cached copy shows; only This week is left out.
   - `/?preview=draft` renders `home~draft`, read fresh, with `Cache-Control: no-store` and `X-Robots-Tag: noindex`, under a note that it's a preview.
   - The admin app's block editor (`#blocks/home`) and Move to blocks: see [the README](../../README.md#admin-app).
   - **The budget,** measured on a local `wrangler dev`, as the workerd process's CPU time per request: 3.4–3.8 ms with the records cached (150 requests, 3 runs; a bare request costs 1.2 ms), against 6.4–7.8 ms for the page before blocks. Most of the difference is a fix that came out of measuring: the timeline built two date formatters for every post, status change and note on each render (`src/lib/timeline.mjs` now makes each once). A render with expired records makes 21 subrequests (20 before: the page record is read first, and the old record too until the page record exists) and costs 110–120 ms of process CPU (130–140 before). That figure also counts the TLS and HTTP work of 21 HTTPS connections, which Cloudflare does outside the Worker, so it's an upper bound; Workers observability shows the real CPU time of those renders.
4. **The other pages:** About, Now, Uses, the CV, Services, Notes, each with the blocks it needs and Move to blocks. **Built** ([#201](https://github.com/Skiddle-ID/skiddle.id/pull/201), a commit per page):
   - Each page renders from blocks through `src/lib/block-page.ts`, as home now does too: its `id.skiddle.page` record, else its old record turned into blocks (`src/lib/page-legacy.mjs`), and `?preview=draft`. The CV's page key is `works`, its address. `scripts/parity.mjs` finds every page's `<main>`, title, description and JSON-LD the same as the live page's, and screenshots of `<main>` at 1280 and 375 px match the live site's to the pixel, but for the avatars' downscaling, which also differs between two captures of the live site.
   - Twenty new kinds. The table above met the pages' markup: home's kinds carry home's spacing and link styles, so none of them fit another page exactly, and each page's sections became kinds of their own. About: `facts` (the neofetch card), `section` (Markdown under an optional heading, its id its own or made from the title), `principles`, `soFar` and `contact`. Now: `nowFull`. Uses: `uses`. The CV: `cvHeader` (with the highlights under it), `jobs`, `skills`, `projectGrid`, `education` (with the certifications beside it) and `cvContact` (with the print button). Services: `servicesIntro`, `highlights`, `services`, `steps`, `reviews` and `brief`. Notes: `blueskyPosts`.
   - On each of these pages, a block holds the page's main heading (`facts`, `nowFull`, `uses`, `cvHeader`, `servicesIntro`, `blueskyPosts`), so the page hides its own; its title is still the browser tab's (`About — Skiddle`).
   - The text that was in the pages' code is in the records: headings, leads, Services' steps and its email template. Leads and short lines are Markdown (`src/lib/now-html.ts`): a link off the site opens in a new tab wherever the site renders Markdown, and bold in a muted line is the text colour.
   - What another page also shows stays in its record, and the block reads it once per request (`src/lib/page-data.ts`): the Now list and the services and testimonials (the home page reads them), and the notes (the timeline does). The rest moves into the page record: About's, Uses' and the CV's content. Services' track record is a copy of the CV's highlights. Uses' "last updated" is the page record's `updatedAt`, and its converted page keeps the Uses record's.
   - A block's script stays in its page's route, as home's status script does: Astro renders a component's script where the component is, inside `<main>`. Astro 7.4 also drops the scoped styles of components shared only by pages rendered on request, so the blocks' styles are in `src/components/blocks/blocks.css`, which `src/style.css` imports.
   - **The budget,** measured as in phase 3, on a local `wrangler dev`, this branch's build beside `v4`'s, interleaved: 150 requests a run, 5 runs each. With the records cached, the median CPU time per render is 2.5 ms for About, the heaviest moved page (2.6 ms before), 2.3 ms for the CV (3.1 ms), 2.3 ms for Services (2.9 ms), 2.1 ms for Uses (3.0 ms), 1.9 ms for Now and 2.2 ms for Notes (both as before) and 2.9 ms for the home page (2.8 ms); a bare request costs 0.8 ms. Why the CV, Services and Uses measure lower isn't explained (no profile was taken), so no speedup is claimed: the pages are no slower. A render with expired records reads one more record than before, the page record: Notes, the most, makes 6 fetches, 6 cache reads and 6 cache writes (5 of each before), 18 subrequests counted together, under 25. The runs are in the PR.
5. **Pages of Jeff's own:** New page, the address rules, the sitemap, search and the menu. **Built:**
   - `src/pages/[key].astro` serves the `id.skiddle.page` record under `<key>` at `/<key>/`, from its blocks, through `src/lib/block-page.ts` like the site's own pages: cached with them (`PAGES_CACHE`), `?preview=draft` for its draft, and `?page=` for a Bluesky posts block's notes, as on `/notes/`. Without a card of its own, it shares with the site's (`/og/site.png`).
   - **The address rules** (`src/lib/own-pages.mjs`): lowercase letters, digits and single hyphens, up to 50 characters, so a key with a `~` (a draft's) is never one. `RESERVED_KEYS` lists the addresses the site uses itself: every top-level route in `src/pages/` and everything at the top of `public/`, which `scripts/own-pages.test.mjs` reads from the folders, so a new route without its entry fails the tests; also `/og/` (the build's cards), Cloudflare's `/cdn-cgi/` and the site pages' keys (`/home/` isn't home). Astro serves a real route before `[key]`, and a record under a reserved key is never served, so no record can take a route's place. Any other address is the site's 404.
   - Pages of Jeff's own are read from one list of the page records (`getPageRecords`), cached like the other records and forgotten by `/api/revalidate`, so a request for an address with no page reads nothing more from the PDS. A draft at `?preview=draft` is read fresh, as on the other pages. A page just published can take up to a minute to show in a Worker that read the list before, like any change to a record.
   - `ownPagesOf` is what's published: the sitemap lists each page with its `updatedAt`, `/search.json` its title, description and address, and the command bar adds them to its pages once it has loaded `/search.json` (in `data-pages`, every page's render would read the list). Drafts are left out of all three. A menu item's link can be a page's address (`/speaking/`), like any path on the site.
   - The blocks' scripts (the status line, the facts block's accent picker, the CV's print buttons, the reviews' slider) moved from their routes to `src/components/blocks/scripts/`, each doing nothing on a page without its block, so a page of Jeff's own runs them all. Every kind of block renders on such a page with nothing else on it: a page with one of each, 29 blocks, rendered them all, and none failed.
   - The admin app: see [the README](../../README.md#admin-app). The block catalogue groups the kinds by `group` in `BLOCKS`: text and links, the site's data, and the parts of the site's own pages, which work anywhere but read as About's or the CV's.
   - **The budget,** measured as in phase 3 on a local `wrangler dev` with a page record served from a local fixture: 150 requests a run, 5 runs. With the records cached, the median CPU time per render is 3.1 ms (2.7–3.3) for a page with Markdown, links, recent posts, Now, projects, This week and a call to action, 3.9 ms (3.6–4.1) for the page with all 29 kinds, and 2.9 ms for the home page; a bare request costs 0.8 ms. With every record expired, the first page makes 19 fetches (phase 3's count; the home page makes 21), one of them the list of page records. Cloudflare also counts Cache API calls against the same limit: with its 13 cache reads and 13 writes, that's 45 of the free plan's 50, and 51 for the home page, whose reads this phase didn't change. Six of those fetches are a list's second, empty page (`listRecords` in `src/lib/pds.ts` asks for the next page until one comes back empty), so that's the place to cut first.
6. **Clean-up:** stop using the seven old lexicons, mark them deprecated, drop their permissions.
7. **Later:** saved theme presets (switch, export, import), post page settings.

## Open questions

- **Presets (settled in the review):** `id.skiddle.theme` keeps the key `self` only. Changing it to any would break the published lexicon: a preset saved under another key wouldn't be valid under today's schema. Presets get a collection of their own, `id.skiddle.themePreset` (key: the preset's name), and applying one copies it into `self`.

## The review

On 2026-11-28 the plan was checked against the [lexicon spec](https://atproto.com/specs/lexicon), the [record key spec](https://atproto.com/specs/record-key), the [lexicon style guide](https://atproto.com/guides/lexicon-style-guide), [Leaflet's lexicons](https://github.com/hyperlink-academy/leaflet/tree/main/lexicons/pub/leaflet) and [Cloudflare's Workers limits](https://developers.cloudflare.com/workers/platform/limits/). It changed:

1. **Presets** get their own collection instead of a new key type for the theme.
2. **Colours** are `{ r, g, b }` numbers, so no record can put CSS into a page.
3. **Blocks** sit in a `#block` wrapper that holds their layout.
4. **The block union** is open, and unknown blocks are kept by the editor and left out of the page.
5. **Switches** are named so `false`, or no field, is today's look.
6. **Length limits** are picked once, when a lexicon is first published.
7. **The old page lexicons** stay published, marked deprecated, when the pages move.
8. **A CPU and subrequest budget** for a page, measured in phase 3.
9. **Draft keys** (`home~draft`) are valid; lists of pages leave them out.
