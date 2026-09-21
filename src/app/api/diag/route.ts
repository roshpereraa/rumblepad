import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const TARGETS = [
  ["browse-live", "https://rumble.com/browse/live"],
  ["oembed", "https://rumble.com/api/Media/oembed.json?url=https%3A%2F%2Frumble.com%2Fembed%2Fv7dlr9g%2F"],
  ["video-page", "https://rumble.com/v7fs46y-trump-removes-fake-news-from-wh-greenland-is-ours-illegals-are-rioting-over.html"],
  ["embed-page", "https://rumble.com/embed/v7dlr9g/"],
];

export async function GET() {
  const results = [];
  for (const [name, url] of TARGETS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "*/*", "Accept-Language": "en-US,en;q=0.9" },
        redirect: "manual",
        cache: "no-store",
      });
      const body = await res.text();
      results.push({
        name,
        status: res.status,
        location: res.headers.get("location"),
        server: res.headers.get("server"),
        cfRay: res.headers.get("cf-ray"),
        bytes: body.length,
        head: body.slice(0, 120).replace(/\s+/g, " "),
      });
    } catch (err) {
      results.push({ name, error: String(err) });
    }
  }
  return NextResponse.json({ results });
}
