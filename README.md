# skiddle.id — v3 local markdown · tania-warm blue

**Live** `https://skiddle.id` `Cloudflare Workers` `v3 6608d0a` `2677 KiB / 428 gz` `prerender:true` `shiki at build (github-light)` `src/content/posts/*.md`

Inspo: [hayden.moe](https://hayden.moe/) · [hailey.at](https://hailey.at/) · [tania.dev](https://tania.dev/)

## Branches

- **`v3` (default, last major)** — stable `v3.0 go local` `3a94713` + drafter `6608d0a` — this is what ships `skiddle.id`
- **`develop`** — integration `5e07722 v3.1-wip + 8138588 restructure` — PRs land here first → then `develop → v3`
- **`v2`** — archival `v2.0 warm blue` `8af0b6a` — frozen
- **`v1`** — archival `v1.2.1` `179913e` — frozen
- **`main`** — previous default, now archive of `5e07722` (same as `develop` pre-restructure) — kept for redirect, not default
- **`dependabot/*`** — auto bun updates, target `develop` or `v3` via PR

**Flow:**

```
feat branch -> PR (label feat/fix/chore) -> develop -> PR develop -> v3 (squash) -> tag v3.x -> release draft -> Full Changelog
```

## Release notes — PR-tracked

Every release tracks PRs automatically:

- **`.github/release.yml`** — powers `Generate release notes` on tag (Added/Changed/Fixed/Dependencies/Docs by labels `feat`/`fix`/`chore`/`change`/`deps`/`docs` + Full Changelog compare)
- **`.github/release-drafter.yml` + `.github/workflows/release-drafter.yml`** — drafts next `v3.x` on every `push` to `v3`/`develop` or `PR` labeled — categories `🚀 Added` `✨ Changed` `🐛 Fixed` `📦 Dependencies` `📝 Docs`

**Usage:**

1. Branch from `develop`: `git checkout -b feat/xyz` · commit `feat: ...` / `fix: ...`
2. PR to `develop` with label `feat` / `fix` / `chore` / `change` / `deps`
3. When ready to ship: PR `develop -> v3` → merge → `git tag v3.1 && git push origin v3.1` → `gh release create v3.1 --generate-notes`
4. Archival: on `v4`, create `v3` snapshot stays frozen, default moves to `v4`

**Labels:** `feat` `fix` `chore` `change` `deps` `docs` `skip-changelog`

## Content

- `src/content.config.ts` `glob` `src/content/posts/*.md` frontmatter `title/pubDate/category/tags/cover/featured/series/rkey/draft`
- `posts/[slug]` local + `posts/[rkey]` → `slug` redirect + `og/posts/[slug].svg` `1200x630` warm blue

## Build

- `bun run build` `astro 6.4.8` `@astrojs/cloudflare 13.7.0` `shiki at build` `prerender:true`
- `wrangler deploy --dry-run` must be `<3MiB gzip` — `428 gz` OK
- `/sketches` ignored (`/.gitignore /sketches/`) — local preview `python -m http.server 8789` only
