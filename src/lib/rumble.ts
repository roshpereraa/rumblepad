/**
 * Server-side Rumble data layer.
 *
 * Rumble has no open public API for browsing, so this module uses the two
 * surfaces that are actually reachable without credentials:
 *
 *   1. https://rumble.com/browse/live   - server-rendered grid of live streams
 *   2. https://rumble.com/api/Media/oembed.json - Rumble's official oEmbed
 *      endpoint, which returns title/author/thumbnail and the sanctioned
 *      <iframe> embed for a video.
 *
 * Playback always goes through Rumble's own embedded player, so we never
 * proxy or re-host their video streams.
 *
 * Category pages (/browse/news etc.) now return 410 and /search is behind a
 * Cloudflare challenge, so neither is used here.
 */

import snapshot from "@/data/live-snapshot.json";

export const RUMBLE_ORIGIN = "https://rumble.com";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export type Stream = {
  /** Rumble's numeric video id, when the markup exposes it. */
  id: string;
  /** Path on rumble.com, e.g. "/v7fs46y-some-title.html" */
  slug: string;
  /** URL-safe key we use in our own routes, e.g. "v7fs46y-some-title" */
  key: string;
  title: string;
  channel: string;
  channelPath: string;
  avatar: string | null;
  thumbnail: string | null;
  viewers: number | null;
  viewersLabel: string | null;
  live: boolean;
  duration: string | null;
};

export type VideoDetail = Stream & {
  embedId: string | null;
  description: string | null;
  rumbleUrl: string;
};

/* ------------------------------------------------------------------ */
/* fetching + cache                                                    */
/* ------------------------------------------------------------------ */

type Entry<T> = { value: T; expires: number };
const cache = new Map<string, Entry<unknown>>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  try {
    const value = await load();
    cache.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  } catch (err) {
    // Serve a stale entry rather than breaking the page when Rumble hiccups.
    if (hit) return hit.value;
    throw err;
  }
}

/**
 * Rumble answers some pages with a 307 that only resolves once you hand back
 * the cookie it just set, so `fetch`’s automatic redirect handling loops
 * forever ("redirect count exceeded"). We follow redirects by hand and keep a
 * tiny per-host cookie jar instead.
 */
const jars = new Map<string, Map<string, string>>();

function jarFor(host: string): Map<string, string> {
  let jar = jars.get(host);
  if (!jar) {
    jar = new Map();
    jars.set(host, jar);
  }
  return jar;
}

function storeCookies(res: Response, host: string) {
  const jar = jarFor(host);
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const pair = raw.split(";", 1)[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(host: string): string {
  return [...jarFor(host)].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function get(url: string, accept: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    let current = url;

    for (let hop = 0; hop < 8; hop++) {
      const host = new URL(current).host;
      const cookie = cookieHeader(host);

      const res = await fetch(current, {
        headers: {
          "User-Agent": UA,
          Accept: accept,
          "Accept-Language": "en-US,en;q=0.9",
          Referer: RUMBLE_ORIGIN + "/",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
      });

      storeCookies(res, host);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error(`Rumble sent ${res.status} without a location for ${current}`);
        current = new URL(location, current).toString();
        continue;
      }

      if (!res.ok) throw new Error(`Rumble responded ${res.status} for ${current}`);
      return await res.text();
    }

    throw new Error(`Too many redirects for ${url}`);
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* parsing helpers                                                     */
/* ------------------------------------------------------------------ */

function decode(input: string | undefined): string {
  if (!input) return "";
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/** "13.1K" -> 13100, "1.94K" -> 1940, "820" -> 820 */
function parseCount(label: string | null): number | null {
  if (!label) return null;
  const m = /^([\d.,]+)\s*([KMB])?$/i.exec(label.trim());
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (Number.isNaN(n)) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || "").toLowerCase()] ?? 1;
  return Math.round(n * mult);
}

function first(re: RegExp, html: string): string | undefined {
  return re.exec(html)?.[1];
}

/** Slice the document into one chunk per video card. */
function splitCards(html: string): string[] {
  const starts = [
    ...html.matchAll(/<div\s+class="videostream[^"]*thumbnail__grid[-–]{1,2}item[^"]*"/g),
  ].map((m) => m.index!);
  if (!starts.length) return [];
  return starts.map((start, i) => html.slice(start, starts[i + 1] ?? start + 8000));
}

export function parseStreams(html: string): Stream[] {
  const out: Stream[] = [];
  for (const card of splitCards(html)) {
    const slug = first(/class="title__link link"\s+href="([^"?#]+)/, card);
    const title = decode(first(/class="thumbnail__title[^"]*"\s*title="([^"]*)"/, card));
    if (!slug || !title) continue;

    const viewersLabel =
      decode(
        first(
          /videostream__views-ppv[\s\S]{0,240}?videostream__number"[^>]*>\s*([\d.,]+\s*[KMB]?)/,
          card,
        ),
      ) || null;

    out.push({
      id: first(/data-video-id="(\d+)"/, card) ?? slug,
      slug,
      key: slug.replace(/^\//, "").replace(/\.html$/, ""),
      title,
      channel: decode(first(/class="channel__name truncate"\s*title="([^"]*)"/, card)) || "Unknown",
      channelPath: first(/class="channel__link link[^"]*"\s*href="([^"?#]+)/, card) ?? "",
      avatar: first(/class="channel__image"[\s\S]{0,200}?src="([^"]+)"/, card) ?? null,
      thumbnail: first(/class="thumbnail__image[^"]*"[\s\S]{0,300}?src="(https?:\/\/[^"]+)"/, card) ?? null,
      viewers: parseCount(viewersLabel),
      viewersLabel,
      live: /videostream__status--live/.test(card),
      duration: decode(first(/class="videostream__status--duration"[^>]*>([^<]+)</, card)) || null,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Where a feed came from.
 *
 * Cloudflare serves rumble.com's browse/channel/RSS pages to residential IPs
 * but challenges datacenter IPs, so live discovery works when RumblePad runs
 * locally or on a residential host and fails on Vercel. `stale` tells the UI
 * to say so rather than silently showing an old list.
 */
export type Feed = { streams: Stream[]; stale: boolean; capturedAt: string | null };

/** Rumble's global live feed, most-watched first. Cached for 45s. */
async function scrapeLive(): Promise<Stream[]> {
  const html = await get(`${RUMBLE_ORIGIN}/browse/live`, "text/html");
  const streams = parseStreams(html);
  if (!streams.length) throw new Error("browse/live returned no parsable cards");
  return streams.sort((a, b) => (b.viewers ?? -1) - (a.viewers ?? -1));
}

export async function getFeed(): Promise<Feed> {
  try {
    return await cached("feed", 45_000, async () => ({
      streams: await scrapeLive(),
      stale: false,
      capturedAt: new Date().toISOString(),
    }));
  } catch {
    // Discovery is blocked from this host - fall back to the committed
    // snapshot so the app still has something real to show.
    return { streams: snapshot.streams as Stream[], stale: true, capturedAt: snapshot.capturedAt };
  }
}

export async function getLiveStreams(): Promise<Stream[]> {
  return (await getFeed()).streams;
}

type OEmbed = {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  html?: string;
  duration?: number;
};

/**
 * Rumble's official oEmbed endpoint. Accepts either a video page URL or an
 * embed URL, and is one of the few endpoints Cloudflare serves to datacenter
 * IPs - so it is the primary metadata source in production.
 */
export async function getOEmbed(pageOrEmbedUrl: string): Promise<OEmbed | null> {
  return cached(`oembed:${pageOrEmbedUrl}`, 10 * 60_000, async () => {
    const url = `${RUMBLE_ORIGIN}/api/Media/oembed.json?url=${encodeURIComponent(pageOrEmbedUrl)}`;
    try {
      const body = await get(url, "application/json");
      return JSON.parse(body) as OEmbed;
    } catch {
      return null;
    }
  });
}

/** Unescape a JSON string fragment captured by regex. */
function unescapeJson(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

type EmbedMeta = {
  title: string | null;
  channel: string | null;
  channelUrl: string | null;
  thumbnail: string | null;
  live: boolean;
  id: string | null;
};

/**
 * The embed page carries a JSON blob with the full player config. It is also
 * reachable from datacenter IPs, so it is our live-status source in production.
 */
export async function getEmbedMeta(embedId: string): Promise<EmbedMeta | null> {
  return cached(`embed:${embedId}`, 60_000, async () => {
    let html = "";
    try {
      html = await get(`${RUMBLE_ORIGIN}/embed/${embedId}/`, "text/html");
    } catch {
      return null;
    }
    const pick = (re: RegExp) => unescapeJson(re.exec(html)?.[1]);
    const liveFlag = /"live":(\d)/.exec(html)?.[1];
    return {
      title: pick(/"title":"((?:[^"\\]|\\.)*)"/),
      channel: pick(/"author":\{"name":"((?:[^"\\]|\\.)*)"/),
      channelUrl: pick(/"author":\{"name":(?:[^"\\]|\\.)*","url":"((?:[^"\\]|\\.)*)"/),
      thumbnail: pick(/"i":"(https?:\\?\/\\?\/[^"]+)"/),
      live: (liveFlag ? Number(liveFlag) > 0 : false) || /"meta":\{"live":true/.test(html),
      id: /"vid":(\d+)/.exec(html)?.[1] ?? null,
    };
  });
}

/**
 * Load one video by its slug key ("v7fs46y-some-title").
 *
 * oEmbed first, because the video page itself is Cloudflare-challenged on
 * datacenter IPs. oEmbed hands us the embed id inside its iframe markup, and
 * the embed page fills in live status.
 */
export async function getVideo(key: string): Promise<VideoDetail | null> {
  const clean = key.replace(/^\//, "").replace(/\.html$/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(clean)) return null;

  return cached(`video:${clean}`, 60_000, async () => {
    const rumbleUrl = `${RUMBLE_ORIGIN}/${clean}.html`;

    const oembed = await getOEmbed(rumbleUrl);
    const embedId =
      /\/embed\/([a-z0-9]+)\//i.exec(oembed?.html ?? "")?.[1] ?? null;
    if (!oembed && !embedId) return null;

    const meta = embedId ? await getEmbedMeta(embedId) : null;

    // Viewer counts only exist on the live feed, which may be unavailable.
    let fromFeed: Stream | undefined;
    try {
      fromFeed = (await getFeed()).streams.find((s) => s.key === clean);
    } catch {
      fromFeed = undefined;
    }

    const channelUrl = meta?.channelUrl ?? oembed?.author_url ?? "";

    return {
      id: meta?.id ?? clean,
      slug: `/${clean}.html`,
      key: clean,
      title: oembed?.title ?? meta?.title ?? "Untitled",
      channel: oembed?.author_name ?? meta?.channel ?? "Unknown",
      channelPath: channelUrl.replace(RUMBLE_ORIGIN, ""),
      avatar: fromFeed?.avatar ?? null,
      thumbnail: oembed?.thumbnail_url ?? meta?.thumbnail ?? fromFeed?.thumbnail ?? null,
      viewers: fromFeed?.viewers ?? null,
      viewersLabel: fromFeed?.viewersLabel ?? null,
      live: meta?.live ?? Boolean(fromFeed?.live),
      duration: null,
      embedId,
      description: null,
      rumbleUrl,
    };
  });
}

/** Accepts a full Rumble URL, a slug, or free text. */
export function extractKey(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fromUrl = /rumble\.com\/([A-Za-z0-9][A-Za-z0-9._-]*?)(?:\.html)?(?:[?#]|$)/i.exec(trimmed);
  if (fromUrl && !/^(c|user|browse|embed|search)$/i.test(fromUrl[1])) return fromUrl[1];
  if (/^v[a-z0-9]{5,}/i.test(trimmed)) return trimmed.replace(/\.html$/, "");
  return null;
}
