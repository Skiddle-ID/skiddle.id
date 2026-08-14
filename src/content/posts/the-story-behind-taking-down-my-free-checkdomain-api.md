---
title: "The Story Behind Taking Down My Free checkdomain API"
description: "Two years free, then abuse, reselling, and DDoS - why the API closed."
pubDate: 2025-11-23T14:41:28.085Z
category: infra
tags: [api, checkdomain, trustpositif]
series: checkdomain
order: 1
rkey: 3m6cjqfkcfr23
draft: false
---

For almost two years, I maintained a free public API that powered **checkdomain**, an open-source tool I built to let anyone quickly check whether a domain was blocked by Kominfo's Trust+ list. What started as a side project designed to help developers and researchers slowly grew into something much larger than I ever expected.

This article is my personal reflection on the project, why I ultimately shut down the free API, and what I learned along the way.

---

## How the Project Started

When I first released **checkdomain**, my only intention was to provide a simple, accessible way to verify domain status. The idea was straightforward:

- You send a request with a domain.
- The API replies with whether that domain is blocked.
- Developers could integrate it into scripts, dashboards, or automated checks with minimal effort.

I open-sourced the code on GitHub because I believed transparency mattered, and because I wanted others to be able to self-host or improve the tool if they wished.

For a long time, the free API did exactly what it needed to do. It served thousands of requests without issue, and I was glad people found it useful.

---

## Where Things Went Wrong

Over time, usage increased in ways I never anticipated. That alone wasn't a problem - growth means the tool had value. The real issues were:

### 1. **People pushed past the limits I set**
The API had reasonable free limits, intended for personal use or small integrations. Unfortunately, some users ignored those boundaries entirely. Heavy, automated traffic started to strain the service and my hosting resources.

### 2. **Unauthorized reselling emerged**
The most disappointing discovery was that some individuals were **reselling access** to my free API - without permission, without attribution, and without contributing to its cost or maintenance.
It felt unfair and genuinely disrespectful to the intent of the project.

### 3. **The project became financially and operationally unsustainable**
Maintaining a high-traffic, publicly accessible API isn't free. I handled everything - hosting, monitoring, updates, and abuse mitigation - and eventually it demanded more time and resources than I could continue to give.

After evaluating the situation, I made the difficult decision to take down the free API endpoint.

---

## What This Means Now

- The free API is no longer available.
- The **open-source code remains online**, so anyone who needs the functionality can still **self-host** it.
- For users who want long-term access, I may consider a private or paid service option if there is enough interest.

I want the tool to remain available - just not in a way that leaves the entire burden on me.

---

## Looking Back: What I Learned

Running a free public API for two years taught me several important lessons:

- **Good intentions are not enough** - clear boundaries and enforcement matter.
- **Abuse happens sooner than you expect**, especially when something is free and easy to integrate.
- **Open-source is powerful**, but open services need sustainable models.
- **Transparency is important**, but so is protecting your time, resources, and work.

Despite the challenges, I don't regret creating or sharing checkdomain. It helped people, sparked discussions, and showed the value of accessible digital tools.

---

## Moving Forward

The project isn't gone - just transitioning. The repository is still available, the tool is still useful, and the door remains open for collaboration or improvements.

If you relied on the free API, thank you for using it and supporting the project. If you were one of the people who reached out with feedback or contributions, I appreciate you deeply. Your engagement made the work meaningful.

This change wasn't easy, but it was necessary. And I hope the community continues to find value in what checkdomain provides.
