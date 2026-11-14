---
title: "Publishing My Blog to AT Protocol"
description: "My posts now also live as records in my own AT Protocol repo, where Standard.site readers can find them."
pubDate: 2026-11-14T07:58:00.000Z
category: atproto
tags: [atproto, bluesky, standard-site, astro]
bluesky: at://did:plc:xaj6j6abvpgwps5v6k4t6clv/app.bsky.feed.post/3n2aztysnzk27
draft: false
---

## My posts, in my own repo

Every Bluesky account has a repo: a small database of records that lives on your PDS (personal data server). Your posts, likes and follows are all in there. Apps don't keep your data, they read it from your repo.

This site already leans on that for comments, which are just [Bluesky replies](/posts/share-cards-and-comments-without-a-backend/). Now the posts themselves are in my repo too. Every published post on skiddle.id has a matching record, so any app that reads long-form posts from AT Protocol can find them without scraping my site.

---

## Standard.site

For that to work, apps have to agree on what a blog post record looks like. That's [Standard.site](https://standard.site): a shared set of lexicons (record schemas) that Leaflet, pckt and others use. There are two kinds of record:

- **`site.standard.publication`**: the blog itself. Mine says `https://skiddle.id`, "Skiddle", a short description and my icon.
- **`site.standard.document`**: one per post, with the title, its path on the site, the description, dates, tags and the text.

Mine also carry the post's share card as a cover image, and a link to the Bluesky post that announced it.

## Proving the site is mine

Anyone could create a record that says "this is skiddle.id". So readers check the other direction too:

- `skiddle.id/.well-known/site.standard.publication` returns the address of my publication record: `at://did:plc:…/site.standard.publication/3cfljnvz22222`.
- Every post has a `<link rel="site.standard.document" href="at://…">` tag in its page that points at its record.

When the record and the website point at each other, a reader knows they belong together.

## The chicken-and-egg problem

That second step had a catch. The page has to contain its record's address, but the record is written after the site is built. And I can't pick any key I like: Standard.site wants a **TID**, a record key made from a timestamp.

So the page doesn't wait for the record. A TID is just a time in microseconds plus a small extra number, so I make one from the post's publish date and a number worked out from its slug. The site build and the sync script do the same math, which means a page knows its record's address before the record exists, and the site stays plain static files.

## Keeping it in sync

A GitHub Action does the writing. It runs right after the [Bluesky announcement](/posts/shipping-my-personal-site-like-production/), so a new post's record can already link to its announcement. Each run:

1. waits until the site serves the `.well-known` file and the new post is live, because readers check as soon as a record appears
2. creates or updates the record of every published post that changed, and leaves the rest alone
3. deletes records whose post is gone

There's also a dry run that only reads public data. I ran that first to see exactly what would be written. The first real run created the publication and three posts, and they all passed a check against the official lexicons. The next run said "4 unchanged", which is what you want from a sync.

## Things I didn't expect

- **I had already done this once.** My account still had a publication from pckt.blog, set up earlier this year, with six of my older posts. Even the record keys matched, because both came from my old WhiteWind posts. I left those with pckt, so skiddle.id's publication starts with the newer posts. The sync never touches another publication's records.
- **Readers can be stricter than the spec.** Leaflet uses tighter limits than Standard.site itself (a tag can be at most 50 characters, for example) and quietly drops records that go over. So the sync stays inside the stricter limits.
- **Still no backend.** Like the comments, none of this needs a server of mine. The site is static files, and the records live on my PDS.

---

If everything works, this post has its own record by the time you read it. You can look it up in an AT Protocol explorer like pdsls.dev. Comments are right below, as Bluesky replies. 🦋
