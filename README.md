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

Rumble has no open browse API, and **Cloudflare treats hosts differently**: it
serves rumble.com's HTML to residential IPs but challenges datacenter IPs. That
single fact shapes the whole data layer.

| Endpoint | Used for | From home | From Vercel |
| --- | --- | --- | --- |
| `api/Media/oembed.json` | Title, author, thumbnail, embed id | 200 | **200** |
| `rumble.com/embed/<id>/` | Live status, poster, player config JSON | 200 | **200** |
| `rumble.com/browse/live` | The live directory | 200 | **403** |
| `rumble.com/<slug>.html` | Video page | 200 | **403** |
| `rumble.com/c/<ch>`, `/rss`, `embedJS` | Channel / feed discovery | mixed | **403** |

So:

- **Stream pages work everywhere.** `getVideo` is oEmbed-first — oEmbed accepts a
  video *page* URL and hands back the embed id inside its iframe markup, which
  avoids the challenged page entirely. Live status comes from the embed page.
- **Live discovery only works from a residential connection.** Nothing reachable
  from a datacenter can enumerate what is live. In production the feed falls back
  to `src/data/live-snapshot.json` and the UI says so rather than pretending.

Regenerate the snapshot from a home connection:

```bash
node scripts/snapshot.mjs
```

Category pages (`/browse/news`) return `410` and `/search` is challenged even
from home, so there are no category rails; search filters the feed and resolves
pasted Rumble links.

### Two non-obvious gotchas

1. Rumble answers some pages with a `307` that only resolves once you send back
   the cookie it just set. `fetch`'s automatic redirect handling loops until it
   throws `redirect count exceeded`, so `get()` follows redirects manually with a
   small per-host cookie jar.
2. Viewer counts, descriptions and chat are client-rendered on video pages, so
   they are absent from the HTML. Viewer counts come from the feed instead.

## What's real and what isn't

- **Real:** every stream, title, channel, avatar, thumbnail, viewer count and the player.
- **Simulated:** the entire market layer. Tickers, contract addresses and percentage
  moves are derived deterministically from the channel name (`src/lib/markets.ts`).
  There is no chain and no contract, so "Trade" stays disabled.
- **Real:** the wallet connection. `Connect wallet` is a working EIP-1193 client with
  EIP-6963 multi-wallet discovery, silent reconnect, and live account/chain tracking.
  It is strictly read-only — RumblePad calls `eth_requestAccounts`, `eth_chainId` and
  `eth_getBalance`, and never requests a signature or a transaction.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Browse — hero + live grid + markets teaser |
| `/stream/[key]` | Player, stream metadata, market panel, related live streams |
| `/markets` | Market directory |
| `/api/live` | JSON: the parsed live feed |
| `/api/video/[key]` | JSON: one video's metadata + embed id |
