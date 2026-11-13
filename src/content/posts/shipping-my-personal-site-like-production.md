---
title: "Shipping My Personal Site Like Production"
description: "Merge to deploy, a preview for every pull request, checks that run themselves - and the day a post disappeared."
pubDate: 2026-11-13T11:29:00.000Z
category: infra
tags: [cloudflare, github-actions, astro, ci-cd]
series: "Rebuilding skiddle.id"
order: 3
draft: false
---

## The boring part, finally done properly

After [bringing back the v1 design](/posts/bringing-back-the-v1-design/), I looked at how changes actually reach this site. Honestly? Not great. I built it on my Mac and ran `npm run deploy` by hand. Merging a pull request did nothing on its own, and if my laptop wasn't around, nothing shipped.

For a site that's supposed to show how I work, that felt wrong. So I spent some time on the unglamorous part: the pipeline.

---

## Merge = deploy

The site runs on **Cloudflare Workers**, so I connected the GitHub repo to **Workers Builds**. Now every merge into `v3` builds and deploys the site on its own, usually in a minute or two. No laptop needed. I can fix a typo from GitHub on my phone and it's live before I've put the phone down.

One small thing I learned: publishing a release only creates a git tag, and tags don't trigger a build. The footer shows the release version, so after a release I re-run the last build to update it.

## A preview for every pull request

Every pull request now gets its own preview link, like `https://<branch>-skiddle-id.skiddle.workers.dev`. I can click through a new post or a layout change on my phone before merging anything.

It didn't work on the first try, though. Two gotchas:

- **A binding nobody used.** Astro's Cloudflare adapter adds a `SESSION` storage binding for Astro sessions, without saying which storage to use. Production deploys quietly reused the old one, but previews refused it. I don't use sessions at all, so `session: false` in the Astro config fixed it.
- **Previews that kept switching off.** If you don't set `preview_urls` in `wrangler.toml`, it follows `workers_dev`, which is off for me because the site only lives on its own domains. So every production deploy turned the preview links off again. Setting `preview_urls = true` explicitly fixed that.

## The day a post disappeared

Here's my favourite lesson. I merged two pull requests a few seconds apart: one only changed the README, the other added a new post. The post went live... and then disappeared a minute later.

Both merges started a build. The README one was slower, finished last, and deployed a version of the site from **before** the post existed. Nothing warns you about this. Now I merge one pull request at a time and wait for its build.

## Checks that run themselves

A few things now happen without me remembering to do them:

- **Lint on every pull request.** ESLint had quietly stopped working after an upgrade. It's back, and a red check shows up before I merge a mistake.
- **Dependabot and CodeQL.** After upgrading to Astro 7 and removing some old code, open security alerts went from **66 to 0**.
- **Secret scanning and push protection.** These would have stopped me from committing my Last.fm API key to a public repo (yes, I did that 😅).

## Release notes that write themselves

**Release Drafter** keeps a draft of the next release, sorted into sections from the pull request titles (`feat:`, `fix:`, `post:`...). It turned out it had been failing quietly with a permission error, while still reporting success. With that fixed, a release is now: open the draft, give it a name, publish.

## Posting to Bluesky automatically

When a new post is merged, a GitHub Action waits until it's live, posts the title and link on Bluesky with the share card, and adds the thread to the post so replies show up as comments. If I already shared the post by hand, it reuses that instead of posting twice. Old posts never get announced by surprise: only posts from the last two weeks.

You might be reading this because of it. 👋

---

## Next in this series

- **Share cards and comments without a backend:** generated preview images, and Bluesky replies as a comment section.
- **Locking it down:** security headers, a content security policy, and how I accidentally blocked my own analytics.
- **Fast and accessible:** what a Lighthouse audit found, and how the home page went from 274 KB to 80 KB.

Building a personal site is still half the fun. Now the shipping part is fun too. 🚀
