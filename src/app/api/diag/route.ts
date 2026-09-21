import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const TARGETS: [string, string][] = [
  ["embedJS", "https://rumble.com/embedJS/u3/?request=video&ver=2&v=v7dlr9g"],
  ["sitemap", "https://rumble.com/sitemap.xml"],
  ["channel-rss", "https://rumble.com/c/GrahamAllen/rss"],
  ["oembed-channel", "https://rumble.com/api/Media/oembed.json?url=https%3A%2F%2Frumble.com%2Fc%2FGrahamAllen"],
  ["browse-live-nohdr", "https://rumble.com/browse/live"],
  ["embed-live-check", "https://rumble.com/embed/v7dlr9g/"],
];

export async function GET() {
  const results = [];
  for (const [name, url] of TARGETS) {
    try {
      const headers: Record<string, string> =
        name === "browse-live-nohdr" ? {} : { "User-Agent": UA, Accept: "*/*" };
      const res = await fetch(url, { headers, redirect: "manual", cache: "no-store" });
      const body = await res.text();
      results.push({
        name,
        status: res.status,
        bytes: body.length,
        head: body.slice(0, 150).replace(/\s+/g, " "),
      });
    } catch (err) {
      results.push({ name, error: String(err).slice(0, 120) });
    }
  }
  return NextResponse.json({ results });
}
