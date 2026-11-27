# The timeline

Planned on 2026-11-27 ([ROADMAP.md](../../ROADMAP.md#v43-the-timeline)). Phases 1 (events) and 2 (posts, status changes and notes) are built; phase 3 isn't yet.

A new page, `/timeline/`, shows what Jeff did and has coming up, by day, week and month. It mixes two kinds of entries:
- **events** Jeff adds in the admin app, such as trips, flights, talks, classes, meetings and deadlines
- **entries the site already has:** the posts he publishes, his status changes and his notes

It's separate from About's "So far", which stays as it is. "So far" tells his life in years. The timeline covers days and weeks. `/now/` stays too: it says what he's focused on in general, and the timeline says what actually happened and what's coming.

## Privacy: rough until it's over

Everything in an AT Protocol repo is public. Anyone can read a record, whatever the site shows of it. So the timeline can't hide details on the page and keep them in the record: **what's in the record is public.**

The rule is **rough until it's over**. An upcoming event says only:
- what kind of event it is, such as Trip, Flight, Talk or Personal
- the day or days it runs, with no times
- the city
- a note, if he wants one: a general description, such as "Visiting partners and a few factories" (allowed upcoming since 2026-11-27; it's public as soon as it's saved, so it stays vague)

Once it's over, Jeff can add the rest: the title, the times, the place and a link.

- **The admin app enforces it.** For an event that hasn't ended, the form shows only the rough fields. The detail fields (title, times, place, link) open once the end date has passed.
- **"Fill in the details":** the admin app lists past events that are still rough. Leaving one rough is fine too.
- **Announced events.** A talk, or anything else meant to be public ahead of time, can be ticked **announced**. Its details are then public straight away, and the form says so.
- **Private things stay out.** Nothing private goes on the timeline, rough or not. The form says this too.

Posts, statuses and notes are public already, so they show as they are.

## The record: `id.skiddle.event`

One record per event, keyed by time (TID), in [`lexicons/id/skiddle/event.json`](../../lexicons/id/skiddle/event.json).

| Field | Type | Notes |
|---|---|---|
| `kind` | string, required | One of: `trip`, `flight`, `talk`, `class`, `meeting`, `deadline`, `milestone`, `personal`, `other`. It sets the label, icon and colour |
| `startsOn` | date (`2026-11-26`), required | The first day |
| `endsOn` | date | The last day; a one-day event leaves it out |
| `city` | string, ≤ 64 characters | Rough place, e.g. "Paris" |
| `announced` | boolean | Its details are public before it's over |
| `title` | string, ≤ 100 characters | Detail: once it's over, or when announced |
| `startTime`, `endTime` | time (`18:05`) | Detail: the start time on the first day and the end time on the last, in its time zone; none means all day |
| `timeZone` | IANA name | Detail: the zone its times are in; Bangkok if left out |
| `place` | string, ≤ 100 characters | Detail: the venue, e.g. "Don Mueang airport" |
| `note` | Markdown, ≤ 1,000 characters | Rough: allowed upcoming, kept general |
| `link` | URL or site path | Detail: e.g. the post written about it |
| `createdAt`, `updatedAt` | datetime | Set by the admin app |

Without a title, the page shows the kind ("Trip"). With no times, it's an all-day entry. Times are written as they are where the event happens, so no conversion is needed: the page shows them with the zone's short name, like "18:05 CET". Dates and times are plain strings, since lexicons have no date or time formats; the admin form gives them date and time pickers, and `src/lib/timeline.mjs` checks them.

The site checks it as it's read (`src/lib/timeline.mjs`): an event that hasn't ended and isn't announced shows only its rough fields. That covers a record written by something other than the admin app, though the record itself is still public.

## Entries the site already has

The page reads these and puts them on the timeline:

| Entry | From | Shows |
|---|---|---|
| A post | `sitePosts()`, its publish date | "Post: <title>", linked to the post |
| A status change | `getStatusHistory()` (`id.skiddle.statusLog`) | "Status: <text>", with its emoji or dot and the place |
| A note | `getNotes()` (Bluesky posts tagged #note) | "Note:", the first line of its text, linked to it on Bluesky |

Each shows at its own time, in the time zone it was made in where it has one (a status does), and otherwise in Bangkok time. The music plays stay on `/listening/`: there are too many for a timeline.

How it's built: [`src/lib/timeline-feed.ts`](../../src/lib/timeline-feed.ts) reads them with the readers their own pages use, all cached, and `activitiesOf` in `src/lib/timeline.mjs` turns them into entries. A source that can't be read is left out and logged (`timeline:`), so the rest still shows. On a day, all-day events come first, then everything else by the moment it happened, with an event's start time read in its own zone. A note shows as one line, without its `#note` tag. In the month grid, blue dots are events and grey dots the rest.

## The page

| Address | Shows |
|---|---|
| `/timeline/` | This week, plus Upcoming |
| `/timeline/2026-W48/` | A week, Monday to Sunday |
| `/timeline/2026-11/` | A month |
| `/timeline/2026-11-27/` | A day |

- **Week** (the default): the days in order, each with its entries by time. All-day events come first. An empty day says "nothing".
- **Month:** a calendar grid, Monday first. Each day shows a dot for events and a dot for everything else. A day links to its Day view.
- **Day:** one day's entries in full.
- **Upcoming,** at the top of `/timeline/`: the next few events, rough (kind, days, city).
- **Moving around:** previous and next, plus Day, Week and Month links. Older weeks and months work like a diary going back.
- **Days are Bangkok days,** so the grouping doesn't shift with the reader's zone. Each entry shows its own time and zone, like `/status/`.
- **Rendered on request and cached** like the other pages (fresh for a minute, `pages` tag). `/api/revalidate` forgets the cached events after a save.
- A **timeline** link goes in the sidebar, after notes.

## The admin app

A new section, **Timeline**, after Status:
- **Upcoming:** the events that haven't ended, with New event.
- **Fill in the details:** past events that are still rough.
- **Past:** the rest, newest first.

The editor is made from the lexicon, like the page editors. It hides the detail fields while the event is upcoming and not announced. An event can be deleted, after a confirm. Signing in again adds `id.skiddle.event` to the app's permissions.

## Phases

1. **Events.** The lexicon, the admin section and editor, and `/timeline/` with its Week, Month and Day views and Upcoming, showing events only. The sidebar link. Backups list the collection.
2. **Everything else.** Posts, status changes and notes join the timeline.
3. **Extras,** each optional:
   - `/timeline.ics`: a calendar feed of the events, with the same rough rule, so people can subscribe in Apple or Google Calendar
   - a "This week" card on the home page
   - repeating events (a weekly class), left out until then because they make everything else harder

It all fits Cloudflare's free Workers plan: a page reads a few collections the site already caches.

## Open questions

- **Kinds:** is the list above right?
- **Upcoming on the home page:** in phase 3, or never?
- **The sidebar link:** "timeline", or another word?
