# skiddle.id

My corner of the internet — [skiddle.id](https://skiddle.id) — by Jeff (Skiddle). Protocol engineer in Bangkok (Skiddle Labs), writing about infra, open protocols, homelab and life.

Built with [Astro](https://astro.build), deployed to [Cloudflare Workers](https://workers.cloudflare.com). Posts live in `src/content/posts` as Markdown, highlighted with Shiki at build time. Comments come from Bluesky replies.

## Updating the site

| To change… | Edit |
|---|---|
| A post | `src/content/posts/<slug>.md` (frontmatter schema in `src/content.config.ts`) |
| CV / works | `src/data/works.ts` |
| Projects, services, uses, highlights | `src/data/*.ts` |
| Pages and layout | `src/pages/`, `src/components/` |

New posts start with `draft: true`. They stay off the live site until it's `false`. Once a published post is merged into `v3`, it's announced on Bluesky automatically and gets its `bluesky: at://…` line, which shows replies as comments (see [Bluesky announcements](#bluesky-announcements)).

### Bluesky announcements

`.github/workflows/bluesky-announce.yml` runs `scripts/bluesky-announce.mjs` after each push to `v3` that touches posts. For every post in the push that is published, has no `bluesky:` line and is at most 14 days old, it:

1. waits until the post is live
2. reuses a Bluesky post that already links to it (if you shared it by hand), or else posts the title and link with the share card as a link card
3. commits `bluesky: at://…` to the post, so comments turn on with the next deploy

To announce an older post, or try it safely: Actions → "Announce posts on Bluesky" → Run workflow, then enter the slug. Dry run is on by default.

Setup (once): create an app password in Bluesky (Settings → Privacy and security → App passwords), then store it with `gh secret set BLUESKY_APP_PASSWORD`.

Every post gets a share card (the preview image on Bluesky, X, LinkedIn, chat apps) at `/og/posts/<slug>.png`, made at build time from its title, description, date and reading time. Other pages use `/og/site.png`. A post with a `.png`/`.jpg`/`.webp` `cover` uses that instead. The code is in `src/lib/share-card.ts` and `src/integrations/share-cards.ts`.

```sh
npm ci          # Node 24 (see .node-version), npm (see packageManager)
npm run dev     # http://localhost:4321
npm run build   # production build into dist/
```

### Deploying

Merging into `v3` deploys automatically through [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/). Settings for the `skiddle-id` Worker (Workers & Pages → skiddle-id → Settings → Build):

- Git repository: `Skiddle-ID/skiddle.id`, production branch `v3`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy` (the default; it picks up the config Astro generates in `dist/server/`)
- Root directory: `/`, no build variables needed (Node comes from `.node-version`)

Secrets live in Cloudflare, not in the repo: `LASTFM_API_KEY` (`npx wrangler secret put LASTFM_API_KEY`). For local dev, put it in `.dev.vars`.

Manual deploy and rollback still work from any machine logged in with `npx wrangler login`: `npm run build && npm run deploy`, `npx wrangler rollback`.

### Releases

The footer shows the latest release tag reachable from the deployed commit (e.g. `v3.2`), linked to its GitHub release.

Publishing a release only creates a tag, and tags don't trigger Workers Builds. So the footer picks up the new version on the next merge into `v3`. To show it straight away, either:

- re-run the latest build from the Worker's build history in the Cloudflare dashboard, or
- `git pull --tags && npm run build && npm run deploy` on a machine logged in with `npx wrangler login`.

## Last.fm card

`/lastfm.svg` is a "now playing" card in the site's terminal style, made for profile READMEs and other sites:

```html
<a href="https://www.last.fm/user/arcestia">
  <img src="https://skiddle.id/lastfm.svg" alt="Last.fm: now playing" width="540">
</a>
```

- `?theme=auto` (default; follows the viewer's light / dark setting), `dark` or `light`
- `?accent=blue` (default), `teal`, `purple`, `pink` or `green`

It always shows `LASTFM_USERNAME`, embeds the album art so it works inside `<img>`, and caches Last.fm for 30 seconds (artwork for 7 days). If Last.fm is down it shows "Nothing playing right now" instead of a broken image. The code is in `src/lib/lastfm.ts` (data) and `src/lib/lastfm-card.ts` (drawing).

## Credits & inspiration

This site started in 2025 from **[Hayden Young](https://bsky.app/profile/hayden.moe)'s** personal site, [hayden.moe](https://web.archive.org/web/2025/https://hayden.moe/) ([source](https://github.com/hbjydev/hayden.moe)). The terminal-style `@web ~` header, the blinking cursor and the original ATProto blog setup come from there. It has since been rewritten, but the spirit is Hayden's. Thank you! Hayden now writes at [hayden.leaflet.pub](https://hayden.leaflet.pub/).

Other sites that shaped it:

- [hailey.at](https://hailey.at/): minimal, writing-first, published on AT Protocol
- [tania.dev](https://tania.dev/): the "brief timeline", series and older / newer post navigation

---

*Dev: `develop` → `v3` (default, last major) · releases auto‑composed per PR — see Releases. [`v1` `v2` archival]*
