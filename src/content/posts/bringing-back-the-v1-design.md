---
title: "Bringing Back the v1 Design"
description: "People liked the old design better - so v3.2 brings it back, modernised, with a proper portfolio."
pubDate: 2026-11-12T15:55:00.000Z
category: infra
tags: [astro, design, refactoring, cloudflare]
bluesky: at://did:plc:xaj6j6abvpgwps5v6k4t6clv/app.bsky.feed.post/3n25xr6yvo22i
series: "Rebuilding skiddle.id"
order: 2
draft: false
---

## Yes, I redesigned my site again.

If you read [my last refactoring post](/posts/a-newest-refactoring-of-my-personal-sites/), you knew this would happen sooner or later. 😅

This time the reason was different. It wasn't a new framework I wanted to try. It was feedback. After a few redesigns ("warm blue", "go local"…), I got some honest feedback: the newer design was something only I really liked. Most people preferred the **old v1 design**, with its terminal-style header, monospace font and quiet layout that just lets you read.

So for **v3.2, "v1 soul"**, I went back to it. Not a copy-paste of the old site, but the same spirit with everything I've learned since.

---

## What Came Back

- The `skiddle@web ~` terminal header with the blinking cursor
- Monospace everywhere, dark by default (light mode and accent colours are still in the sidebar)
- A simple, writing-first layout

## What's New

The site is now a **portfolio** too, not only a blog:

- **Home** shows what I'm working on now, selected work and the latest writing
- **About** has a little neofetch-style card and a short timeline
- **Works** is my CV, and you can print it or save it as a PDF straight from the page
- **Projects**, **Uses** and **Services** got the same treatment

There are also two blog features I've wanted for a long time:

- **Comments from Bluesky.** When I share a post on Bluesky, the replies show up under the post. There are no accounts and no tracking, just the conversation where it already happens.
- **Older / newer post links** at the end of every post, so it's easier to keep reading.

---

## A Bit More Professional

Redesigning also made me look at what I was sharing. I removed some personal details that didn't need to be on the internet, and cleaned up a few pages so they say what I actually do.

The CV now shows how I work today: through **Skiddle Labs Pte. Ltd.**, my own company. It looks after my personal projects and the clients who have been with me for years. My current protocol engineering contract, which I do with my team, runs through it too.

---

## Under the Hood

- Upgraded to **Astro 7**, which also took care of a bunch of security alerts
- Moved my Last.fm API key out of the repo (oops) and into a Cloudflare secret
- Every merge now **deploys automatically** with Cloudflare Workers Builds. Publishing a post is just: write it, open a pull request, merge. This post is the first one published that way!
- The footer shows the release version, so you can always see which version you're looking at. Right now it's [v3.2](https://github.com/Skiddle-ID/skiddle.id/releases/tag/v3.2).

---

## Thank You

The site still owes a lot to [Hayden](https://bsky.app/profile/hayden.moe), whose code I started from in 2025, and to ideas from [hailey.at](https://hailey.at/) and [tania.dev](https://tania.dev/).

And thanks to everyone who told me honestly that they missed the old design. You were right. 🙏

If you have thoughts on the new (old) look, let me know on Bluesky. 🚀
