---
title: "Fast and Accessible"
description: "What a Lighthouse audit found on my site, and how the home page went from 274 KB to 82 KB."
# Set pubDate to the day you publish: posts are announced on Bluesky automatically only if they're at most 14 days old
pubDate: 2026-11-14T09:00:00.000Z
category: infra
tags: [performance, accessibility, lighthouse, css]
series: "Rebuilding skiddle.id"
order: 6
draft: true
---

## Measuring instead of guessing

After the redesign, the new desktop layout and all the security work, I realised I had never actually measured the site. It felt fast. But "feels fast on my laptop" isn't a number.

So I ran **Lighthouse** on ten pages, in both the dark and light themes, on mobile and desktop. Lighthouse loads each page like a visitor would and scores it on speed, accessibility, best practices and search.

The starting point was better than I expected: speed 99–100, accessibility 95–100, best practices 100, search 92–100. But the details had some real problems.

---

## What it found

- **Text that was too faint.** The small "(6)" count next to "On this page" on posts was grey at 60% opacity. That made it 3.5:1 contrast in dark mode and 2.9:1 in light, below the 4.5:1 minimum for readable text.
- **Headings that skipped a level.** Two posts went from the title straight to level-3 headings. Screen readers use headings to navigate, so the order matters.
- **Links that said "read more".** Two of them on the about page. Out of context, "read more" tells you nothing about where a link goes.
- **Huge avatars.** The home page loaded my 1000 px Bluesky avatar (230 KB) to show it at 112 px. The about page loaded a 379 KB PNG from GitHub. Every post loaded another 46 KB just for the small author picture at the end.
- **Text jumping as the font loaded.** On the projects page, everything shifted slightly when the web font arrived.

## The fixes

- The count uses the normal muted colour now, without the extra opacity.
- The headings in both posts are level 2. Only the `###` markers changed, not the words.
- The links say where they go: "how the site evolved →" and "the flying story →".
- The avatars are now small local copies, sized for where they're shown: **34 KB, 33 KB and 6 KB**. The trade-off is that they no longer update by themselves when I change my profile picture. I can live with that.
- The two font files are **preloaded**, so they usually arrive before the first paint. No more jump.

I first tried Cloudflare's on-the-fly image resizing, which the site's config already pointed at. It turned out it isn't even enabled on my account. Good thing nothing depended on it.

## The numbers

On the live site, after the fixes:

- **Accessibility, best practices and search: 100** on every page, in both themes
- **Speed: 99–100**, and nothing shifts while a page loads
- **Home page: 274 KB → 82 KB.** About page: **386 KB → 44 KB**

## A little motion, done carefully

While I was at it, I added page transitions: when you move between pages, the content fades and rises into place while the sidebar stays still. It's CSS only, using the browser's built-in view transitions, so it adds no JavaScript and no weight.

It's also switched off for anyone whose device asks for reduced motion. Accessibility includes not making people feel sick.

---

## That's the series

Six parts later, this little site deploys itself, previews every change, announces new posts, collects comments without a backend, locks down its scripts and scores 100 where it counts. Building a personal site really is half the fun.

Thanks for reading along. If you have questions about any part, the comments are right below. 🚀
