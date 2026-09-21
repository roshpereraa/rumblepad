import Link from "next/link";
import { SectionHeading, StreamCard, StreamGrid } from "@/components/StreamCard";
import { formatViewers } from "@/lib/format";
import { buildMarkets, shortAddress } from "@/lib/markets";
import { extractKey, getFeed, type Stream } from "@/lib/rumble";

export const dynamic = "force-dynamic";

/** The video the brief asked to surface, pinned to the hero when it is live. */
const FEATURED_KEY =
  "v7fs46y-trump-removes-fake-news-from-wh-greenland-is-ours-illegals-are-rioting-over";

function matches(s: Stream, q: string) {
  const needle = q.toLowerCase();
  return (
    s.title.toLowerCase().includes(needle) ||
    s.channel.toLowerCase().includes(needle) ||
    s.key.toLowerCase().includes(needle)
  );
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  let streams: Stream[] = [];
  let stale = false;
  let capturedAt: string | null = null;
  let error: string | null = null;
  try {
    const feed = await getFeed();
    streams = feed.streams;
    stale = feed.stale;
    capturedAt = feed.capturedAt;
  } catch {
    error = "Couldn't reach Rumble just now. Refresh to try again.";
  }

  // A pasted Rumble link jumps straight to that video.
  if (q) {
    const key = extractKey(q);
    if (key) {
      return (
        <div className="px-6 py-8">
          <p className="text-sm text-pad-muted">
            That looks like a Rumble link —{" "}
            <Link href={`/stream/${key}`} className="font-bold text-pad-green-text underline">
              open {key} in the player
            </Link>
            .
          </p>
        </div>
      );
    }
  }

  const filtered = q ? streams.filter((s) => matches(s, q)) : streams;
  const featured =
    filtered.find((s) => s.key === FEATURED_KEY) ?? filtered[0] ?? null;
  const rest = filtered.filter((s) => s.key !== featured?.key);
  const markets = buildMarkets(streams.slice(0, 6));

  return (
    <div className="px-6 py-6">
      {error && (
        <div className="mb-6 rounded-lg border border-pad-line bg-pad-surface px-4 py-3 text-sm text-pad-text">
          {error}
        </div>
      )}

      {stale && (
        <div className="mb-6 rounded-lg border border-pad-line bg-pad-surface px-4 py-3 text-[13px] leading-relaxed text-pad-muted">
          <span className="font-bold text-pad-text">Showing a saved snapshot.</span>{" "}
          Rumble&apos;s live directory is served to home connections but blocked for
          datacenter IPs, so this deployment can&apos;t refresh it. These streams were
          captured
          {capturedAt ? ` ${new Date(capturedAt).toUTCString()}` : ""} and their viewer
          counts are frozen — the players themselves still open live. Run RumblePad
          locally for a live-updating feed.
        </div>
      )}

      {q && (
        <p className="mb-5 text-sm text-pad-muted">
          {filtered.length} live {filtered.length === 1 ? "stream" : "streams"} matching{" "}
          <span className="font-semibold text-pad-text">“{q}”</span> ·{" "}
          <Link href="/" className="text-pad-green-text hover:underline">
            clear
          </Link>
        </p>
      )}

      {/* ---------------- hero ---------------- */}
      {featured && (
        <section className="mb-10">
          <SectionHeading
            title="Live right now"
            subtitle="Rumble's most-watched broadcast at this moment"
          />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <Link
              href={`/stream/${featured.key}`}
              className="group relative block aspect-video overflow-hidden rounded-xl border border-pad-line hover:border-pad-green"
            >
              {featured.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featured.thumbnail}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="mb-2 flex items-center gap-2">
                  {featured.live && (
                    <span className="rounded bg-pad-live px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                      LIVE
                    </span>
                  )}
                  <span className="rounded bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {formatViewers(featured.viewers, featured.viewersLabel)} viewers
                  </span>
                </div>
                <h3 className="line-clamp-2 text-xl font-extrabold text-white">{featured.title}</h3>
                <p className="mt-1 text-sm text-white/70">{featured.channel}</p>
              </div>
            </Link>

            <div className="flex flex-col gap-4">
              {rest.slice(0, 2).map((s) => (
                <StreamCard key={s.key} stream={s} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- grid ---------------- */}
      {rest.length > 2 && (
        <section className="mb-12">
          <SectionHeading
            title="More live streams"
            subtitle="Pulled live from rumble.com/browse/live"
          />
          <StreamGrid streams={rest.slice(2)} />
        </section>
      )}

      {filtered.length === 0 && !error && (
        <p className="py-16 text-center text-sm text-pad-muted">
          No live streams matched. <Link href="/" className="text-pad-green-text hover:underline">Show everything</Link>
        </p>
      )}

      {/* ---------------- markets teaser ---------------- */}
      <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <SectionHeading
            title="Recently paired"
            subtitle="Streams with a market of their own"
            action={
              <Link href="/markets" className="text-[13px] font-semibold text-pad-green-text hover:underline">
                View markets ↗
              </Link>
            }
          />
          <div className="divide-y divide-pad-line overflow-hidden rounded-xl border border-pad-line bg-pad-surface">
            {markets.map((m) => (
              <Link
                key={m.ticker + m.rank}
                href={`/stream/${m.streamKey}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-pad-raised"
              >
                <span className="w-5 text-[12px] font-semibold text-pad-muted">
                  {String(m.rank).padStart(2, "0")}
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-pad-green-soft text-[11px] font-extrabold text-pad-green-text">
                  {m.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{m.channel}</span>
                  <span className="block truncate text-[11px] text-pad-muted">{m.handle}</span>
                </span>
                <span className="hidden shrink-0 text-[12px] font-bold text-pad-green-text sm:block">
                  {m.ticker}
                </span>
                <span className="hidden shrink-0 font-mono text-[11px] text-pad-muted md:block">
                  {shortAddress(m.address)}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <SectionHeading title="Trending markets" subtitle="Recent activity across the newest pairs" />
          <div className="flex items-start gap-3 rounded-xl border border-pad-line bg-pad-surface p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pad-green-soft text-pad-green-text">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6.5 9.5 9.5 6.5" strokeLinecap="round" />
                <path d="M7 4.5 8.6 3a3 3 0 1 1 4.3 4.3L11.4 8.8" strokeLinecap="round" />
                <path d="M9 11.5 7.4 13A3 3 0 1 1 3 8.7l1.5-1.5" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <h3 className="text-[15px] font-bold">The next move starts on stream</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-pad-muted">
                Pairs with confirmed trading activity appear here. RumblePad&apos;s market layer is a
                UI demo — wallet connection is real, but there is no chain or contract
                behind these pairs.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-pad-line pt-5 text-[12px] leading-relaxed text-pad-muted">
        RumblePad is an independent viewer for publicly available Rumble streams. Not affiliated
        with, endorsed by, or connected to Rumble. Video is played through Rumble&apos;s own embedded
        player; all content belongs to its creators.
      </footer>
    </div>
  );
}
