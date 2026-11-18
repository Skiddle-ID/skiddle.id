# skiddle-covers

Runs Deezer's search for the album art on the music card (`/music.svg`) and [`/listening/`](https://skiddle.id/listening/), from a data center near Singapore.

Deezer isn't open in every country, and answers a search from one where it isn't with nothing. The site's Worker runs in the Cloudflare data center nearest each visitor. For Jeff that's Hong Kong, where Deezer isn't open: there, Deezer's `/infos` answers `"country":"HK","open":false`. So a cover found when GitHub loads the card from the US was never found on skiddle.id from Hong Kong.

So the site (`src/lib/music.ts`) sends the search here, through a service binding (`COVERS` in [`../../wrangler.toml`](../../wrangler.toml)). [Placement](https://developers.cloudflare.com/workers/configuration/placement/) runs this Worker near AWS's Singapore region (`aws:ap-southeast-1`), where Deezer is open, whichever data center calls it. Deezer's ISRC lookup isn't limited by country, so it stays in the site.

- [`covers.mjs`](covers.mjs): what it answers, with Deezer passed in
  - `GET /deezer/search?q=…`: Deezer's results, trimmed to what the site's matcher uses
  - `GET /where`: the data center it runs in (e.g. `SIN`) and the country Deezer sees from there. Cloudflare's `cf-placement` header would say this, but it isn't set on calls through a service binding.
- [`covers.test.mjs`](covers.test.mjs): its tests (`npm run test:unit`, run in CI)
- [`index.mjs`](index.mjs): the Worker
- [`wrangler.toml`](wrangler.toml): placement, no URL, logs on

It has no URL (`workers_dev = false`, no routes), so only the site's Worker can call it. It fits the free plan: it's only called when a track's cover isn't cached yet (once a day per track and data center at most), with one request to Deezer each time, plus two small ones when it starts, to say where it runs.

## Setting it up

Deploy it **before** the site, since the site's binding needs a Worker named `skiddle-covers` to exist. PR previews of the site call this production Worker too: previews don't inherit bindings, so `wrangler.toml` declares it again under `[[previews.services]]`. Either:

- **Workers Builds (recommended, so it redeploys with every merge):**
  - In the Cloudflare dashboard, create a Worker named `skiddle-covers` from this repository.
  - Root directory: `workers/covers`
  - Deploy command: `npx wrangler deploy --config wrangler.toml`
  - Production branch: the one skiddle.id is built from
- **By hand:** `cd workers/covers && npx wrangler deploy --config wrangler.toml`

Its logs (Workers & Pages → skiddle-covers → Logs, or `npx wrangler tail skiddle-covers`) show each search, how many results came back, and where it ran, e.g. `search "…": 2 results (SIN, Deezer SG (open))`.

## Running it locally

Build the site, then run both Workers in one `wrangler dev`, so the binding connects:

```sh
npm run build
npx wrangler dev -c dist/server/wrangler.json -c workers/covers/wrangler.toml
```

With the site's Worker alone, the binding answers 503. The card then falls back to the other sources, and the error isn't cached.
