# v4 mockups

Static mockups of the v4 home page in four directions, plus the post page for direction A. They use the site's real content, colours and fonts. The plan and the open decisions are in [ROADMAP.md](../../ROADMAP.md).

How posts and series move onto AT Protocol, with the draft lexicons, is in [posts-on-atproto.md](posts-on-atproto.md).

| File | What it shows |
|---|---|
| [`mockups/designs.html`](mockups/designs.html) | All four side by side, with screenshots, pros and cons |
| [`mockups/index.html`](mockups/index.html) | **A · Terminal**: v3's sidebar and single column, tightened up |
| [`mockups/editorial.html`](mockups/editorial.html) | **B · Editorial**: a top bar, a big intro, a featured story with a photo |
| [`mockups/tmux.html`](mockups/tmux.html) | **C · tmux**: the page as a terminal session, with panes and a status bar |
| [`mockups/bento.html`](mockups/bento.html) | **D · Bento**: the sidebar plus a grid of cards |
| [`mockups/post.html`](mockups/post.html) | The post page for A, with the series in the side column |

## Viewing them

GitHub shows the HTML as code, so open them locally:

```bash
npx serve docs/v4/mockups
```

Then go to the address it prints, starting with `designs.html`. Opening the files directly in a browser works too.

The yellow **v4 mockup** panel in the corner switches between the designs, dark and light, and the reading font (sans or mono), and A's intro (you or consulting). **Notes** outlines what changed from v3. The fonts load from Google Fonts. The site itself serves them from its own domain.
