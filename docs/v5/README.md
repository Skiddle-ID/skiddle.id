# v5 mockups: Logbook

A proposal for the v5 redesign that covers every page, not only the home page. The four home-page directions from November (A–D) are still in [docs/v4/](../v4/).

**The idea:** each page is a page of a logbook. Posts, builds, plays and flights are all entries, because since v4 they're all records in my AT Protocol repo. It keeps the terminal, adds the flight deck and shows the protocol underneath. Mono speaks for the machine; Sans speaks for Jeff.

| From | What it brings |
|---|---|
| The terminal (engineer) | the `skiddle@web:~$` prompt, `##` headings, search with Ctrl K or ⌘K, the cursor |
| The flight deck (pilot) | flight strips for entries, series drawn as routes, Bangkok and Zulu time, a hold-short line before the call to action, NOTE and CAUTION callouts |
| The repo (protocol) | a crew card numbered with the DID, "Lately, in my repo", "This post is a record", totals carried forward in the footer |

## Viewing them

Open the overview first, `index.html`. From the repo's root:

```bash
python3 -m http.server 4500 --directory docs/v5/mockups
```

Then go to <http://localhost:4500/>. The yellow **v5 mockup** panel on each page jumps between pages and switches theme and accent. It also runs a text-spacing check (WCAG 1.4.12) and shows the notes for that page.

## Editing them

Each page is a fragment in [`pages/`](pages/). [`build.mjs`](build.mjs) wraps it in the shared shell and writes it to `mockups/`. The shell is the status line, header, search dialog and footer.

```bash
node docs/v5/build.mjs
```

The design system is one stylesheet, [`mockups/v5.css`](mockups/v5.css), and one optional script, [`mockups/v5.js`](mockups/v5.js). A page's own styles sit in a `<style>` block in its fragment, the way an Astro component's would. `mock.css` and `mock.js` are only for the panel.

## Pages

| Page | File | Notes |
|---|---|---|
| Overview | `index.html` | The idea, the parts, the budgets, what's left to decide |
| Home | `home.html` | |
| Writing | `writing.html` | |
| Post | `post.html` | Lab Notes #2 |
| Series | `series.html` | |
| One series | `series-flight.html` | From Fear to Flight |
| Topics | `topics.html` | |
| Notes | `notes.html` | planned for v4.1 |
| Work | `work.html` | works, projects and services under one menu item |
| Services | `services.html` | |
| Projects | `projects.html` | |
| CV | `cv.html` | prints on A4 |
| Changelog | `changelog.html` | planned (Later) |
| Flying | `flying.html` | planned for v4.2; placeholders where the logbook and the airport go |
| About | `about.html` | |
| Now | `now.html` | planned for v4.1 |
| Listening | `listening.html` | |
| Uses | `uses.html` | |
| 404 | `404.html` | |

The content is the live site's as of November 18, 2026. Pages for data that doesn't exist yet show where it will come from instead of made-up numbers.

## Budgets and checks

| | Budget |
|---|---|
| CSS | ≤ 10 KB gzipped, one file |
| JavaScript | ≤ 3 KB gzipped; everything works without it |
| Fonts | Geist Mono 400 and Geist 400 preloaded (about 10 KB and 13 KB); 600 and italic load when used |
| Third-party requests | none |
| Layout shift | 0 |
| Largest paint | text, never waiting on an image |

**Accessibility, WCAG 2.2 AA:**

- Contrast is 4.5:1 for text in both themes and every accent, and 3:1 for input borders.
- Focus is visible everywhere.
- Targets meet the WCAG 2.2 minimum of 24 px (axe's target-size check); buttons are 36–44 px.
- Colour is never the only signal.
- Nothing moves with reduced motion. The testimonials have a Pause button.
- Forced colours (Windows high contrast) have their own rules, to keep borders, waypoints and badges visible. These aren't tested on Windows yet.
- Indonesian titles carry `lang="id"`.

Every page was checked with axe (WCAG 2.2 AA plus best practice) in both themes, at 1440 px and 390 px, with no horizontal scrolling.

**Measured** on November 19, 2026, with everything gzipped: fonts and images included, the mockup panel excluded.

| | Result |
|---|---|
| Every page | 47–79 KB in total, in 6–8 requests |
| `v5.css` | 9.1 KB |
| `v5.js` | 2.3 KB |
| Layout shift | 0 on every page |
| Largest paint | text everywhere, except the two flying pages, where it's the illustration (22 KB on phones) |
