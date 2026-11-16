---
title: "Never Quite Done"
description: "The site follows your device's theme, every page gets a share card, and I blocked my own analytics again."
# Set pubDate to the day you publish: posts are announced on Bluesky automatically only if they're at most 14 days old
pubDate: 2026-11-15T09:00:00.000Z
category: infra
tags: [astro, cloudflare, csp, open-graph]
series: "Rebuilding skiddle.id"
order: 7
draft: true
---

## I said that was the series

Part 6 ended with "that's the series". Then I kept going. A personal site is never really finished, and the small things kept adding up, so here they are.

---

## Light or dark, like your device

Until now the site was dark for everyone until you clicked the theme toggle. Now it starts in whatever your device is set to: light on a light-mode phone, dark on a dark-mode laptop.

- A tiny script in the page head picks the theme before anything is drawn, so there's no flash of the wrong one.
- If your device switches by itself, say automatic dark mode at sunset, the site follows along, as long as you haven't picked a theme here.
- The toggle still works, and your pick wins over the device. Switch back to your device's theme and the site forgets your pick, so it follows the device again.
- If your browser blocks storage, it still follows the device. Without JavaScript it stays dark, like before.

I tested it in headless Chrome with 13 checks: light and dark devices, switching while the page is open, picking a theme and moving between pages, a pick saved before the change, storage blocked, and the label on the command bar's theme switch.

The head script changed, so its hash in the script policy from [part 5](/posts/locking-down-my-personal-site/) changed too. The build worked that out by itself.

## A share card for every page

In [part 4](/posts/share-cards-and-comments-without-a-backend/), every post got its own share card, but every other page shared the same `whoami` card. A link to my uses page or a tag page looked exactly like a link to the home page.

Now each page gets its own card, with its title, its description and a terminal command:

- Pages that show a prompt on screen use the same one: `neofetch` on about, `cat cv.md` on works, `ls -l projects/` on projects.
- The others get a `cd` into the page, like `cd ~/uses`.
- Lists show how many posts they have, so the #aviation tag card says "1 post".

It works like the post cards: after the build, a small integration reads each finished page and renders the card it asks for. If a page points at a card that doesn't exist, the build warns me.

That's 37 page cards on top of the 12 post cards, about 2.1 MB together.

## Blocking my own analytics, again

In part 5, I accidentally blocked my own analytics for about 20 minutes. I managed to do it again.

This time I removed Google Analytics from the site, which also turned off **Zaraz**, the Cloudflare tool that was running it. When I tested the site afterwards, the browser was blocking **Cloudflare Web Analytics** on every page.

Here's what I didn't know: Zaraz was the reason Cloudflare added a one-time pass (a *nonce*) to my script policy, and that same pass is what let the Web Analytics script run. With Zaraz gone, there was no pass, and my policy did exactly what it was built to do: block a script it didn't know.

- The fix was to allow the script's own address, `static.cloudflareinsights.com`, which is what Cloudflare documents for Web Analytics. The script loads with an integrity hash, so the browser checks that it hasn't been tampered with.
- With Google Analytics gone, I also removed the last Google address from the policy.

It's the same lesson as part 5, with a twist. Cloudflare only adds the analytics script on the real domain, for real browsers, so a preview can't show the problem at all. I tested the fix by adding the same script tag myself in headless Chrome, then checked again on skiddle.id after the merge.

## Smaller things

- **The 404 page searches for you.** If you land on a page that doesn't exist, the first suggestion is a search built from the words in the address. `/posts/how-it-started/` offers `grep "how it started"`, and clicking it opens the command bar with "How It All Started #1" at the top.
- **One image was 3.1 MB.** The illustration in "How It All Started #1" was a PNG more than 30 times the size of the whole home page. Now the build turns it into WebP in six sizes, from 31 KB to 275 KB, and the browser picks the right one: on a phone, that's 41 KB. The site was also still set to use Cloudflare's image resizing, which part 6 found isn't even enabled on my account, so a photo in a new post would simply have broken. Now every image in a post gets optimised at build time.
- **Dates in the sitemap.** Every post now tells search engines when it last changed, so updates like the recent rewrite of "How It All Started #1" get noticed. Pages without a real date don't get a made-up one.
- **Checking every link.** I checked every link on all 57 pages. The site's own links were fine, but the [projects page](/projects/) still listed DomainChecker as running, with a link to a tool I shut down at the end of 2025. It's marked archived now, with a link to the post about it. Two old repos had moved to an archive account, so they link there directly.
- **Updates that changed nothing.** Patch updates for Astro, its Cloudflare and MDX packages, ESLint and Wrangler. I compared the build before and after, and every file came out byte for byte the same. That's my favourite kind of update.

---

## Still not done

The site still isn't finished, and it never will be. But this is the last part of Rebuilding skiddle.id.

What comes next is bigger: v4, a redesign. The first pieces are already live, like the new font for post text and the series box on this page. From now on, I'll write about changes like these in a new weekly series, **Lab Notes**: one or two posts every week about what's going on at Skiddle Labs. This site is just the start.

If you spot something on the site that could be better, tell me. The comments are right below. 🛠️
