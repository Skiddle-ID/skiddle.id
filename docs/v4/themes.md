# Themes and layout

Planned on 2026-11-27 ([ROADMAP.md](../../ROADMAP.md#v44-themes-and-layout)). Nothing is built yet; the share cards' design, the logo and the site's mode and accent already live in `id.skiddle.theme` ([#194](https://github.com/Skiddle-ID/skiddle.id/pull/194), [#195](https://github.com/Skiddle-ID/skiddle.id/pull/195)).

The site becomes a complete CMS on AT Protocol: its design, its layout and every page's content are set in the admin app and kept as records in Jeff's repo, like the posts. That covers:
- **design:** colours for dark and light, fonts, sizes, corners and spacing
- **the frame:** the menu, the footer and what the sidebar shows
- **layout:** each page as rows of blocks, side by side on wide screens
- **blocks:** the pieces a page is made of, from a Markdown section to recent posts
- **pages of Jeff's own,** at an address he picks

## The rule: code defines, records arrange

The site ships a fixed set of blocks and design settings, each a tested component that's accessible, fast and allowed by the site's security policy. Records only choose which ones a page uses, in what order, with what options, and the theme's values. No record holds raw HTML, CSS or scripts. That keeps every page safe, fast and accessible whatever is changed in the admin app, and a new kind of block is a PR, like any code.

Every lexicon is our own (`id.skiddle.*`). Block shapes are kept close to the common ones (a heading, text, an image), so they could be mapped onto other apps' later, but nothing depends on a lexicon someone else controls.

**The redesign stays on hold.** This is the engine. It ships with today's look as its only preset and adds no new design. When the v5 direction is picked in January, it becomes a preset and layouts in this system, not a rebuild.

## The records

Three records hold it all. Real lists of things keep their own collections, and blocks point at them.

| Record | Key | Holds |
|---|---|---|
| `id.skiddle.theme` | `self` | The design: colours, fonts, sizes, corners, spacing, the cards' design, the default mode and accent |
| `id.skiddle.site` | `self` | What it already has (name, metadata, icon, profiles), plus the frame: the menu, the footer links, what the sidebar shows |
| `id.skiddle.page` | the page's address: `home`, `about`, `speaking` | A page: its title, description, share card and blocks |

`id.skiddle.page` replaces the seven lexicons that exist only because each page had its own shape:

| Merged into `id.skiddle.page` | Kept as they are |
|---|---|
| `about`, `cv`, `home`, `notes`, `now`, `services`, `uses` | `post`, `draft`, `series`, `project`, `event`, `status`, `statusLog`, `media`, `categories`, `site`, `theme` |

That's 18 lexicons down to 12, and a new page never needs a new one. A draft of a page is the same record under `<page>~draft` (`home~draft`).

## Design: `id.skiddle.theme`

The theme becomes the site's design tokens. Each is optional; one left out keeps today's value (`src/style.css`), so an empty record is today's site.

- **Colours, for dark and for light:** background, alternate background, border, text, muted text, and the five accents. The mode and default accent stay as they are.
- **Fonts:** one for headings and menus, one for text, one for post text and one for code, each picked from a catalogue the site bundles and serves itself (`@fontsource`). Today: Geist Mono for all but post text, which is Geist. Only the fonts in use are preloaded.
- **Sizes:** the base text size (in steps, not pixels) and the line height for text and for posts.
- **Shape:** corner radius (none, small, round) and spacing (compact, normal, roomy).
- **Decoration:** the terminal touches, each on or off: the `$` prompts, the blinking cursor, the `##` before headings.

The page gets the theme as CSS variables in a `<style>` in its head (the security policy allows inline styles). The share cards follow the colours and the heading font.

**Contrast:** the editor checks every text colour against its background and won't save one under WCAG AA (4.5:1, 3:1 for large text), in both modes.

## The frame: `id.skiddle.site`

- **Menu:** the sidebar's links, in order: a label, a link (a page or any address) and an icon from the site's set. The command bar lists the same.
- **Footer:** its links.
- **What the sidebar shows:** the status, the music card, the theme and accent buttons, each on or off.

Where the frame sits (a sidebar on the left) stays in code. A top bar or another frame is design, and waits for the redesign.

## Layout

A page is a list of blocks, each with a width: **full**, **half** or **third**. They flow into rows: a half beside a half, three thirds, a full one alone. On a phone, every block is full width, in the same order, which is also the order screen readers read them in. That's the whole layout system: enough for "Now beside the status, then projects below", and nothing can be placed where it breaks on a small screen.

A page also has a width (narrow for reading, wide for grids) and can hide the page heading.

## Blocks

Each block is an Astro component in `src/components/blocks/`, with its shape as a def in `id.skiddle.page` (`#markdown`, `#jobs`…), a lenient reader and a registry entry. Every block renders inside a wrapper: one that fails shows nothing and logs the error, and the rest of the page renders.

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

| Page | Blocks |
|---|---|
| Home | Profile, Markdown (intro), Now and Status (half each), This week, Projects, Recent posts, Series, Testimonials, Call to action |
| About | Profile, Markdown, Principles, So far, Markdown (outside work), Contact |
| CV (`/works/`) | Profile, Highlights, Jobs, Education, Links |
| Services | Markdown, Services, Testimonials, Call to action |
| Uses | Uses |
| Now | Now |
| Notes | Bluesky posts |

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

A new page lives at the address he picks, e.g. `/speaking/`. Addresses the site already uses (`posts`, `series`, `admin`, `api`…) can't be picked. A page is in the sitemap and the search, can be in the menu, and gets its own share card: the admin draws it when the page is published and keeps it in the record, as a series' is, so it needs no deploy.

## How it renders

Pages render on request, as now: a page reads its record and the collections its blocks use, all cached like the other records and purged when the admin saves. Blocks are server-rendered; only those that update live (the status, the music) load a script. It fits Cloudflare's free Workers plan: the work per page is what it is today.

If a page's record can't be read or isn't there, the page uses its built-in version, today's. If the theme can't be read, the site has today's look.

## Moving over

Pages move one at a time. Until a page is moved, it reads its old record as now; once it has a `page` record, it reads that first, then the old one, then the built-in text. **Move to blocks** does the move for a page; publishing it is Jeff's step. When every page has moved, one PR removes the old lexicons and their permissions (a new sign-in), and deleting the old records is Jeff's call, since it can't be undone. Backups list the new collection.

## Phases

1. **Design.** The theme's colours, fonts, sizes, shape and decoration; the Theme editor with its live preview and contrast check; share cards follow.
2. **The frame.** The menu, the footer and the sidebar's parts in `id.skiddle.site`; the sidebar, the command bar and the footer read them.
3. **Pages from blocks, starting with home.** `id.skiddle.page`, the block registry and wrapper, the blocks home needs, the block editor with draft, preview and publish, and page share cards drawn in the admin app.
4. **The other pages,** one PR each: About, Now, Uses, the CV, Services, Notes, each with the blocks it needs and Move to blocks.
5. **Pages of Jeff's own:** New page, the address rules, the sitemap, search and the menu.
6. **Clean-up:** remove the seven old lexicons and their permissions.
7. **Later:** saved theme presets (switch, export, import), post page settings.

## Open questions

- **The font catalogue:** Geist and Geist Mono, plus which? Candidates: IBM Plex Sans and Mono (the site's colours are IBM Carbon's), JetBrains Mono, Inter, and a serif for posts (Source Serif).
- **The CV's address:** it stays `/works/`, as a page whose record key is `cv`, or the key becomes `works`.
- **Presets:** when presets come (phase 7), `id.skiddle.theme`'s key changes from `self` only to any, with `self` the one in use.
