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

/** Rumble's global live feed, most-watched first. Cached for 45s. */
export async function getLiveStreams(): Promise<Stream[]> {
  return cached("live", 45_000, async () => {
    const html = await get(`${RUMBLE_ORIGIN}/browse/live`, "text/html");
    const streams = parseStreams(html);
    return streams.sort((a, b) => (b.viewers ?? -1) - (a.viewers ?? -1));
  });
}

type OEmbed = {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  html?: string;
  duration?: number;
};

/** Rumble's official oEmbed endpoint. Works for any public video. */
export async function getOEmbed(embedOrPageUrl: string): Promise<OEmbed | null> {
  return cached(`oembed:${embedOrPageUrl}`, 10 * 60_000, async () => {
    const url = `${RUMBLE_ORIGIN}/api/Media/oembed.json?url=${encodeURIComponent(embedOrPageUrl)}`;
    try {
      return JSON.parse(await get(url, "application/json")) as OEmbed;
    } catch {
      return null;
    }
  });
}

/**
 * Load one video by its slug key ("v7fs46y-some-title"), combining the
 * page HTML (for the embed id and description) with oEmbed metadata.
 */
export async function getVideo(key: string): Promise<VideoDetail | null> {
  const clean = key.replace(/^\//, "").replace(/\.html$/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(clean)) return null;

  return cached(`video:${clean}`, 60_000, async () => {
    const rumbleUrl = `${RUMBLE_ORIGIN}/${clean}.html`;
    let html = "";
    try {
      html = await get(rumbleUrl, "text/html");
    } catch {
      return null;
    }

    const embedId = first(/\/embed\/([a-z0-9]+)\//i, html) ?? null;
    const oembed = embedId
      ? await getOEmbed(`${RUMBLE_ORIGIN}/embed/${embedId}/`)
      : await getOEmbed(rumbleUrl);

    const title =
      decode(first(/<title>([^<]+)<\/title>/, html)) || oembed?.title || "Untitled";
    const live = /live-video-view-count-status|"isLiveBroadcast"\s*:\s*true/.test(html);

    // Viewer counts, avatars and thumbnails are rendered client-side on a video
    // page, so they aren't in the HTML we get. The live feed does carry them,
    // so borrow from there whenever this stream is currently listed.
    let fromFeed: Stream | undefined;
    try {
      fromFeed = (await getLiveStreams()).find((s) => s.key === clean);
    } catch {
      fromFeed = undefined;
    }

    return {
      id: first(/data-video-id="(\d+)"/, html) ?? clean,
      slug: `/${clean}.html`,
      key: clean,
      title,
      channel: oembed?.author_name ?? decode(first(/class="channel__name[^"]*"\s*title="([^"]*)"/, html)) ?? "Unknown",
      channelPath: (oembed?.author_url ?? "").replace(RUMBLE_ORIGIN, ""),
      avatar:
        fromFeed?.avatar ??
        first(/class="channel__image"[\s\S]{0,200}?src="([^"]+)"/, html) ??
        null,
      thumbnail: oembed?.thumbnail_url ?? fromFeed?.thumbnail ?? null,
      viewers: fromFeed?.viewers ?? null,
      viewersLabel: fromFeed?.viewersLabel ?? null,
      live: live || Boolean(fromFeed?.live),
      duration: null,
      embedId,
      description:
        decode(first(/<meta name="description" content="([^"]{0,600})"/i, html)).slice(0, 600) ||
        null,
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
