---
title: "Share Cards and Comments Without a Backend"
description: "Preview images made at build time, and Bluesky replies as comments - no database, accounts or tracking."
pubDate: 2026-11-14T00:39:00.000Z
category: infra
tags: [astro, bluesky, atproto, open-graph]
series: "Rebuilding skiddle.id"
order: 4
draft: false
---

## Two things a blog needs

When you share a post, people see a preview card before they ever click. And after they read it, some of them want to reply. Most blogs solve this with an image service and a comment system like Disqus, which means more scripts, more tracking, and someone else's database.

I wanted both on this site, without running a backend for either. Here's how it works now.

---

## Share cards, made at build time

Until recently, every post used my favicon as its preview image. Share a post on Bluesky, X, LinkedIn or WhatsApp, and you'd get... a small logo. Not great.

Now every post gets its own **1200×630 card** in the same terminal style as the site: a `skiddle@web:~$ cat posts/<slug>.md` prompt, the title, the description, the date and reading time. Other pages get a general "whoami" card.

The cards are made when the site builds, so there's nothing to run afterwards:

- After Astro builds the pages, a small integration reads each post page's structured data (title, description, date). Drafts are never built, so they never get a card either.
- **satori** lays out the card. It takes a tree of boxes and text, a bit like HTML with flexbox, and turns it into an SVG using the site's own font, Geist Mono.
- **resvg** turns that SVG into a PNG, because social sites don't show SVG previews.

All the cards take about a second and a half, and each one is around 40 KB.

### Things that tripped me up

- **The card overflowed its own edges.** satori sized the card as 1200×630 *plus* its padding, so the title and footer ran off the image. The fix was an inner box with explicit sizes.
- **Empty boxes instead of letters.** Accented letters like `ľščťž` showed as boxes, even with the extended font loaded. satori only falls back between fonts with *different* names, so the extra font needed its own name.
- **Thai.** I'm in Bangkok, so a Thai title will happen one day. A Thai font is in the fallback list, and it works.

Long titles get cut to three lines with an ellipsis, and descriptions to two.

---

## Comments are Bluesky replies

The comment section under each post is just the replies to the Bluesky post that announced it. If you reply there, it shows up here.

- Each post has a `bluesky:` line pointing at its announcement post.
- When you scroll near the comments, your browser asks Bluesky's public API for that thread. There's no account, no login and no cookies, and nothing happens if you never scroll down.
- Replies are added as plain text, never as HTML, so nobody can inject anything into the page.
- Replies hidden by the thread's author stay hidden, the most-liked ones come first, and nested replies go three levels deep.

The site's security policy only lets the page talk to Bluesky's API and the site itself, so it stays that way.

If a post has no thread yet, the comment section shows a "Start the conversation on Bluesky" link instead.

---

## Connecting the two

This is where it clicks. When a new post goes live, a GitHub Action posts it on Bluesky, with its share card as the link preview, and then writes the `bluesky:` line back into the post. The next deploy turns the comments on.

So publishing a post now gives it a preview card, an announcement and a comment section, all without me doing anything. [Part 3](/posts/shipping-my-personal-site-like-production/) was the first post published that way.

And none of it needs a server of mine: the cards are files made at build time, and the comments live on Bluesky.

---

## Next in this series

- **Locking it down:** security headers, a content security policy, and how I accidentally blocked my own analytics.
- **Fast and accessible:** what a Lighthouse audit found, and how the home page went from 274 KB to 80 KB.

If you've read this far, the comments are right below. Say hi on Bluesky. 👋
