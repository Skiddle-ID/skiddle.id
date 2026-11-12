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

New posts start with `draft: true`. They stay off the live site until it's `false`. After sharing a post on Bluesky, add `bluesky: at://…` to its frontmatter to show replies as comments.

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

## Credits & inspiration

This site started in 2025 from **[Hayden Young](https://bsky.app/profile/hayden.moe)'s** personal site, [hayden.moe](https://web.archive.org/web/2025/https://hayden.moe/) ([source](https://github.com/hbjydev/hayden.moe)). The terminal-style `@web ~` header, the blinking cursor and the original ATProto blog setup come from there. It has since been rewritten, but the spirit is Hayden's. Thank you! Hayden now writes at [hayden.leaflet.pub](https://hayden.leaflet.pub/).

Other sites that shaped it:

- [hailey.at](https://hailey.at/): minimal, writing-first, published on AT Protocol
- [tania.dev](https://tania.dev/): the "brief timeline", series and older / newer post navigation

---

*Dev: `develop` → `v3` (default, last major) · releases auto‑composed per PR — see Releases. [`v1` `v2` archival]*
