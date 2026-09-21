/**
 * Regenerate src/data/live-snapshot.json from rumble.com/browse/live.
 *
 * Run this from a residential connection: Cloudflare challenges datacenter
 * IPs, so it will fail from CI or a cloud box.
 *
 *   node scripts/snapshot.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";

const ORIGIN = "https://rumble.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const jar = new Map();

async function get(url) {
  let current = url;
  for (let hop = 0; hop < 8; hop++) {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(current, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: ORIGIN + "/",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      redirect: "manual",
    });
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const pair = raw.split(";", 1)[0];
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (res.status >= 300 && res.status < 400) {
      current = new URL(res.headers.get("location"), current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${current}`);
    return res.text();
  }
  throw new Error("too many redirects");
}

const decode = (s) =>
  (s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/\s+/g, " ").trim();

function parseCount(label) {
  if (!label) return null;
  const m = /^([\d.,]+)\s*([KMB])?$/i.exec(label.trim());
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (Number.isNaN(n)) return null;
  return Math.round(n * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || "").toLowerCase()] ?? 1));
}

const first = (re, h) => re.exec(h)?.[1];

const html = await get(`${ORIGIN}/browse/live`);
const starts = [
  ...html.matchAll(/<div\s+class="videostream[^"]*thumbnail__grid[-–]{1,2}item[^"]*"/g),
].map((m) => m.index);

const streams = [];
for (let i = 0; i < starts.length; i++) {
  const card = html.slice(starts[i], starts[i + 1] ?? starts[i] + 8000);
  const slug = first(/class="title__link link"\s+href="([^"?#]+)/, card);
  const title = decode(first(/class="thumbnail__title[^"]*"\s*title="([^"]*)"/, card));
  if (!slug || !title) continue;
  const viewersLabel =
    decode(first(/videostream__views-ppv[\s\S]{0,240}?videostream__number"[^>]*>\s*([\d.,]+\s*[KMB]?)/, card)) || null;
  streams.push({
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

if (!streams.length) throw new Error("parsed 0 streams - markup may have changed");
streams.sort((a, b) => (b.viewers ?? -1) - (a.viewers ?? -1));

mkdirSync("src/data", { recursive: true });
writeFileSync(
  "src/data/live-snapshot.json",
  JSON.stringify({ capturedAt: new Date().toISOString(), streams }, null, 2) + "\n",
);
console.log(`wrote src/data/live-snapshot.json with ${streams.length} streams`);
