import Link from "next/link";
import { notFound } from "next/navigation";
import { StreamCard } from "@/components/StreamCard";
import { formatViewers } from "@/lib/format";
import { buildMarkets, shortAddress } from "@/lib/markets";
import { getLiveStreams, getVideo } from "@/lib/rumble";
import { TradePanel } from "@/components/wallet/TradePanel";

export const dynamic = "force-dynamic";

export default async function StreamPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const video = await getVideo(decodeURIComponent(key));
  if (!video) notFound();

  let related: Awaited<ReturnType<typeof getLiveStreams>> = [];
  try {
    related = (await getLiveStreams()).filter((s) => s.key !== video.key).slice(0, 6);
  } catch {
    related = [];
  }

  const market = buildMarkets([
    {
      ...video,
      channelPath: video.channelPath || `/c/${video.channel}`,
    },
  ])[0];

  return (
    <div className="px-6 py-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {/* ---------------- player ---------------- */}
          <div className="overflow-hidden rounded-xl border border-pad-line bg-black">
            <div className="relative aspect-video">
              {video.embedId ? (
                <iframe
                  src={`https://rumble.com/embed/${video.embedId}/`}
                  title={video.title}
                  className="absolute inset-0 h-full w-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-pad-muted">
                    Rumble didn&apos;t return an embed for this video.
                  </p>
                  <a
                    href={video.rumbleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-pad-green px-4 py-2 text-sm font-bold text-pad-on-green"
                  >
                    Watch on Rumble ↗
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ---------------- meta ---------------- */}
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {video.live && (
                <span className="rounded bg-pad-live px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                  LIVE
                </span>
              )}
              {video.viewers != null && (
                <span className="text-[12px] font-semibold text-pad-muted">
                  {formatViewers(video.viewers, video.viewersLabel)} watching
                </span>
              )}
            </div>

            <h1 className="text-xl font-extrabold leading-snug">{video.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-3 border-b border-pad-line pb-4">
              {video.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pad-green-soft text-[12px] font-extrabold text-pad-green-text">
                  {market.initials}
                </span>
              )}
              <div className="mr-auto">
                <p className="text-[14px] font-bold">{video.channel}</p>
                <p className="text-[12px] text-pad-muted">{market.handle}</p>
              </div>
              <a
                href={video.rumbleUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-pad-line px-3 py-2 text-[13px] font-semibold text-pad-text hover:border-pad-green hover:text-pad-green-text"
              >
                Open on Rumble ↗
              </a>
            </div>

            {video.description && (
              <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-pad-text">
                {video.description}
              </p>
            )}
          </div>

          {related.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-lg font-extrabold text-pad-green-text">Also live now</h2>
              <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 2xl:grid-cols-3">
                {related.map((s) => (
                  <StreamCard key={s.key} stream={s} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ---------------- right rail ---------------- */}
        <aside className="flex min-w-0 flex-col gap-5">
          <div className="rounded-xl border border-pad-line bg-pad-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-extrabold">Stream market</h2>
              <span className="rounded bg-pad-raised px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-pad-muted">
                DEMO
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-pad-raised p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-pad-green-soft text-[11px] font-extrabold text-pad-green-text">
                {market.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-pad-green-text">{market.ticker}</p>
                <p className="truncate font-mono text-[11px] text-pad-muted">
                  {shortAddress(market.address)}
                </p>
              </div>
              <span
                className={`text-[13px] font-extrabold ${
                  market.change >= 0 ? "text-pad-green-text" : "text-pad-live"
                }`}
              >
                {market.change >= 0 ? "+" : ""}
                {market.change}%
              </span>
            </div>

            <TradePanel ticker={market.ticker} />
          </div>

          <div className="flex min-h-[320px] flex-1 flex-col rounded-xl border border-pad-line bg-pad-surface">
            <div className="border-b border-pad-line px-4 py-3">
              <h2 className="text-[14px] font-extrabold">Chat</h2>
            </div>
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <p className="text-[12px] leading-relaxed text-pad-muted">
                Rumble&apos;s live chat isn&apos;t exposed to third-party clients, so it stays on
                the Rumble page.{" "}
                <a
                  href={video.rumbleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-pad-green-text hover:underline"
                >
                  Join the chat there ↗
                </a>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
