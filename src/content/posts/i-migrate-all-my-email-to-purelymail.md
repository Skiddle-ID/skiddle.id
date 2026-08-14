---
title: "I Migrate All My Email to Purelymail"
description: "From self-hosted Postfix to Google Workspace to Cloudflare Routing - why Purelymail hit the sweet spot."
pubDate: 2025-09-24T11:08:03.376Z
updatedDate: 2025-10-02T00:00:00.000Z
category: homelab
tags: [email, homelab, purelymail]
rkey: 3lzita3vuqy2f
draft: false
---

Email has always been one of those essential parts of my digital life. Over the years, I've experimented with different ways to manage it—some DIY, some big-name services, and even a clever routing solution. Each phase taught me something new, but in the end, I decided to migrate everything to **Purelymail**.

Here's the story of how I got there.

---

## Starting Out: Self-Hosting My Own Mail

Like many tech enthusiasts, my first instinct was: *"Why not just run my own mail server?"*

I set up my own stack with Postfix, Dovecot, and all the moving pieces. It worked, but it quickly showed me how fragile email can be when you're on your own:

* Deliverability was a nightmare—big providers often sent my messages straight to spam.
* Constant maintenance with updates, DNS tweaks, and monitoring for blacklists.
* And the biggest one: **when something breaks, you're the one who has to fix it.**

Self-hosting gave me full control, but it also meant being on-call 24/7 for my own inbox. That trade-off got old fast.

---

## Moving to Google Workspace

After the DIY phase, I went the opposite direction: maximum convenience. I migrated to **Google Workspace**.

* **Pros:** Everything "just worked." Deliverability was excellent, the Gmail interface was familiar, and integration with Google's ecosystem was seamless.
* **Cons:** It wasn't cheap—especially since I run multiple domains and multiple email addresses. The monthly costs stacked up quickly. On top of that, it came with a sense of lock-in. I didn't really *own* my setup anymore—it felt like I had handed over the keys.

Google Workspace solved the reliability issue, but it introduced **high costs** and made me increasingly dependent on Google's ecosystem.

---

## Cloudflare Email Routing Phase

When Cloudflare announced **Email Routing**, I thought: *Perfect! A simple middle ground.*

The idea was appealing: let Cloudflare handle incoming mail and forward it elsewhere. I set it up for my domains, and it worked well—for a while.

* **Pros:** Free, simple, and integrated directly into Cloudflare's DNS dashboard.
* **Cons:** It's not a full mail solution. It only does routing—you can't use it as a proper mailbox. No sending, no receiving directly, no archiving—just forwarding.

It was fine for catching mail and pushing it into another inbox, but as soon as I needed to **send using my domain** or manage multiple full addresses, its limitations became clear.

---

## Discovering Purelymail

That's when I decided to try **Purelymail**.

What clicked for me was its philosophy:

* **Transparent pricing** - Pay for what you actually use, not bloated plans.
* **Custom domain support** - Great for managing multiple domains.
* **Simplicity** - No unnecessary extras, just solid mail hosting.
* **Control & privacy** - I could configure things my way without bloat.

The migration was straightforward:

1. Added my domains into Purelymail.
2. Updated MX, SPF, DKIM, and DMARC records.
3. Imported old mail with their IMAP migration tool.
4. Reconfigured my clients and devices with the new settings.

Compared to every setup before, this was refreshingly simple.

---

## Living with Purelymail

Since moving everything over, here's what I've noticed:

* **It just works** - no deliverability headaches, no spam nightmares.
* **Clean dashboard** - uncluttered, focused, easy to manage.
* **Cost-effective** - I'm not overpaying for features I don't use.
* **Peace of mind** - I finally have a balance between control and reliability.

Of course, I also know that using a third-party service like Purelymail doesn't automatically guarantee my data is 100% safe. Even though they keep emphasizing **privacy and security**, it still comes down to trust. For me, that's an acceptable trade-off: I gave up the *absolute control* (and constant headaches) of self-hosting in exchange for a provider that is simple, affordable, and trustworthy enough for my everyday email.

---

## Looking Back

* Self-hosting taught me the complexity of running mail and the pain of fixing everything yourself.
* Google Workspace showed me the convenience, but also the cost of scale and lock-in.
* Cloudflare Email Routing was clever and free, but too limited.
* Purelymail hit the sweet spot: **simple, affordable, and reliable.**

Sometimes, the best solution isn't the flashiest or the most DIY—it's the one that quietly does its job so you can move on with life.
