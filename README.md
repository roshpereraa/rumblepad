# RumblePad

A TwitchPad-style front end — Browse, a player page, and a token-market directory —
built on **real, live Rumble streams**.

RumblePad is an independent viewer for publicly available Rumble content. It is not
affiliated with, endorsed by, or connected to Rumble. Playback always runs through
Rumble's own embedded player, so no video is proxied or re-hosted.

## Run it

```bash
npm install
npm run dev
```

## Where the data comes from

Rumble has no open public browse API, so the data layer (`src/lib/rumble.ts`) uses the
two surfaces that are reachable without credentials:

| Source | Used for | Status |
| --- | --- | --- |
| `rumble.com/browse/live` | The live grid: title, channel, avatar, thumbnail, viewer count | Works — ~25 streams per load |
| `rumble.com/api/Media/oembed.json` | Official oEmbed: title, author, thumbnail, embed iframe | Works — public, no auth |
| `rumble.com/<slug>.html` | Resolving a video's embed id | Works |
| `rumble.com/embed/<id>/` | Playback | Works — Rumble's sanctioned embed |

Two things that **do not** work, and why the UI is shaped around them:

- **Category pages** (`/browse/news`, `/browse/gaming`, …) now return `410 Gone`, and
  `/search` sits behind a Cloudflare challenge. So there are no category rails and
  search is a client-side filter over the live feed, plus paste-a-Rumble-link resolution.
- **Viewer counts, descriptions and live chat on a video page** are rendered client-side,
  so they aren't in the HTML. Viewer counts and avatars are borrowed from the live feed
  instead; chat links out to Rumble.

### One non-obvious gotcha

Rumble answers some pages with a `307` that only resolves once you send back the cookie
it just set. `fetch`'s automatic redirect handling loops until it throws
`redirect count exceeded`. `get()` therefore follows redirects manually with a small
per-host cookie jar.

## What's real and what isn't

- **Real:** every stream, title, channel, avatar, thumbnail, viewer count and the player.
- **Simulated:** the entire market layer. Tickers, contract addresses and percentage
  moves are derived deterministically from the channel name (`src/lib/markets.ts`).
  There is no chain, no wallet and no trading. "Connect wallet" and "Trade" are stubs.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Browse — hero + live grid + markets teaser |
| `/stream/[key]` | Player, stream metadata, market panel, related live streams |
| `/markets` | Market directory |
| `/api/live` | JSON: the parsed live feed |
| `/api/video/[key]` | JSON: one video's metadata + embed id |
