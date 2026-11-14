---
title: "Locking Down My Personal Site"
description: "Security headers, a script-locking CSP, secret scanning - and how I accidentally blocked my own analytics."
# Set pubDate to the day you publish: posts are announced on Bluesky automatically only if they're at most 14 days old
pubDate: 2026-11-14T09:00:00.000Z
category: infra
tags: [security, cloudflare, csp, github]
series: "Rebuilding skiddle.id"
order: 5
draft: true
---

## Why lock down a blog?

It's a personal site. No logins, no payments, mostly static pages. So why bother?

Because it's also my portfolio. If someone who might hire me opens the browser's dev tools, or runs a quick security scan, I'd like it to look like someone who does this for a living built it. And honestly, I had already made the classic mistake: my Last.fm API key was sitting in a public repo. 😅

So I went through the site the way I'd go through a client's.

---

## Secrets out of the repo

The Last.fm key now lives as a **Cloudflare secret**, not in `wrangler.toml`. I also turned on GitHub's **secret scanning and push protection**, which are free for public repos. If I try to commit a key like that again, GitHub stops the push before it ever reaches the repo.

While I was there, I closed a small hole in the "Now Playing" card: it used to accept any `?user=`, so anyone could use my key to look up any Last.fm account. Now it only ever shows mine.

## Headers on every response

Every page and file now comes with a set of security headers:

- **nosniff**, so browsers don't guess file types
- a **referrer policy**, so other sites see less when you click away
- **no framing**, so nobody can load the site inside their page to trick you into clicking things
- a **permissions policy** that switches off camera, microphone, location and friends
- **HSTS** for six months, so browsers always use HTTPS for these domains (it was actually set to `max-age=0` before, which means "off")

Static pages get them from a `_headers` file. The few routes the Worker renders itself, like the Now Playing card, get them from a small middleware.

## A CSP that only runs my scripts

The bigger one is the **Content-Security-Policy**. It tells the browser which scripts may run and where the page may connect. The usual shortcut is `'unsafe-inline'`, which lets any inline script run and defeats much of the point.

Instead, a build step reads every page after it's built and **hashes each inline script**. There are only ten across the whole site. The policy lists exactly those hashes, so only those exact scripts run. I tested it by injecting a script into a page: the browser refused it.

Styles still allow inline, because code highlighting uses inline styles. Images can come from anywhere over HTTPS. The page can only talk to the site itself and Bluesky's API, for comments.

GitHub's code scanning even flagged my hashing script: the regex didn't match `<SCRIPT>` in capitals. It only reads my own build output, so it wasn't a real hole, but it's fixed now.

## How I blocked my own analytics

Here's the embarrassing part. I tested every page before merging: no blocked resources, everything worked. Then, on the live site, the browser blocked a request to a Google domain I had never added.

It turned out Cloudflare injects two things into the pages: **Zaraz** (running Google Analytics) and **Cloudflare Web Analytics**. But only for real browsers. My test requests didn't look like a browser, so they never saw them. Cloudflare even adds a one-time pass for its own scripts to the policy, so the scripts ran fine. Their reports, though, went to addresses my policy didn't allow.

So for about 20 minutes, Web Analytics recorded nothing. The fix was two more addresses in the policy. The lesson: **test security headers with real browser requests**, not just curl.

## Zero alerts

At the start, GitHub's Dependabot showed **66 open security alerts**. Upgrading to Astro 7 cleared most of them, and removing old code that pulled in an outdated library cleared the last serious one. Today all three of GitHub's security tabs say **0**: dependencies, code scanning and secrets.

---

## Next in this series

- **Fast and accessible:** what a Lighthouse audit found, and how the home page went from 274 KB to 82 KB.

If you spot something I missed, tell me on Bluesky. Comments are right below. 🔒
