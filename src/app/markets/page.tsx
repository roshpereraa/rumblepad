import Link from "next/link";
import { SectionHeading } from "@/components/StreamCard";
import { formatViewers } from "@/lib/format";
import { buildMarkets } from "@/lib/markets";
import { getLiveStreams } from "@/lib/rumble";
import { CopyAddress } from "@/components/CopyAddress";

export const dynamic = "force-dynamic";

const PLATFORM_ADDRESS = "0x0168cbd3de1d0ca4033cce4d15ab57c41d7e96bf";

export default async function MarketsPage() {
  let streams: Awaited<ReturnType<typeof getLiveStreams>> = [];
  try {
    streams = await getLiveStreams();
  } catch {
    streams = [];
  }
  const markets = buildMarkets(streams);
  const trending = [...markets].sort((a, b) => b.change - a.change).slice(0, 5);

  return (
    <div className="px-6 py-6">
      <div className="mb-8 inline-flex max-w-full items-center gap-3 rounded-xl border border-pad-line bg-pad-surface px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pad-green text-[11px] font-extrabold text-pad-on-green">
          RP
        </span>
        <span className="text-[13px] font-bold">RumblePad</span>
        <span className="rounded bg-pad-raised px-1.5 py-0.5 text-[10px] font-bold text-pad-muted">
          CA
        </span>
        <code className="hidden truncate font-mono text-[12px] text-pad-muted sm:block">
          {PLATFORM_ADDRESS}
        </code>
        <CopyAddress value={PLATFORM_ADDRESS} />
      </div>

      <div className="mb-10 max-w-2xl">
        <p className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-widest text-pad-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-pad-green" />
          THE MARKET DIRECTORY
        </p>
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
          Your next market is live.
        </h1>
        <p className="mt-3 text-[15px] text-pad-muted">
          Pair a stream. Create a coin. Trade the streamer.
        </p>
        <p className="mt-4 rounded-lg border border-pad-line bg-pad-surface px-4 py-3 text-[12px] leading-relaxed text-pad-muted">
          <span className="font-bold text-pad-text">Heads up:</span> the streams and channels on
          this page are real, pulled live from Rumble. Every ticker, contract address and price
          move below is generated locally for demonstration. Wallet connection is real and
          read-only; there is no chain or contract behind these pairs, so nothing here can be
          traded.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section>
          <SectionHeading title="Recently paired" subtitle="Streams with a market of their own" />
          {markets.length === 0 ? (
            <p className="rounded-xl border border-pad-line bg-pad-surface px-4 py-8 text-center text-sm text-pad-muted">
              No live streams available to pair right now.
            </p>
          ) : (
            <div className="divide-y divide-pad-line overflow-hidden rounded-xl border border-pad-line bg-pad-surface">
              {markets.map((m) => (
                <Link
                  key={m.rank}
                  href={`/stream/${m.streamKey}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-pad-raised"
                >
                  <span className="w-6 shrink-0 text-[12px] font-semibold text-pad-muted">
                    {String(m.rank).padStart(2, "0")}
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-pad-green-soft text-[11px] font-extrabold text-pad-green-text">
                    {m.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold">
                      {m.channel} <span className="text-pad-muted">via RumblePad</span>
                    </span>
                    <span className="block truncate text-[11.5px] text-pad-muted">{m.handle}</span>
                  </span>
                  <span className="hidden shrink-0 text-[12.5px] font-bold text-pad-green-text sm:block">
                    {m.ticker}
                  </span>
                  <span className="hidden w-24 shrink-0 text-right font-mono text-[11px] text-pad-muted lg:block">
                    {m.address.slice(0, 6)}…{m.address.slice(-4)}
                  </span>
                  <span className="shrink-0 text-pad-muted">↗</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeading title="Trending markets" subtitle="Recent activity across the newest pairs" />
          {trending.length === 0 ? (
            <div className="rounded-xl border border-pad-line bg-pad-surface p-6">
              <h3 className="text-[15px] font-bold">The next move starts on stream</h3>
              <p className="mt-1 text-[13px] text-pad-muted">
                Pairs with confirmed trading activity appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-pad-line overflow-hidden rounded-xl border border-pad-line bg-pad-surface">
              {trending.map((m) => (
                <Link
                  key={m.rank}
                  href={`/stream/${m.streamKey}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-pad-raised"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-pad-green-soft text-[11px] font-extrabold text-pad-green-text">
                    {m.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold">{m.ticker}</span>
                    <span className="block truncate text-[11.5px] text-pad-muted">
                      {formatViewers(m.viewers, null)} watching · {m.channel}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-[13px] font-extrabold ${
                      m.change >= 0 ? "text-pad-green-text" : "text-pad-live"
                    }`}
                  >
                    {m.change >= 0 ? "+" : ""}
                    {m.change}%
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
