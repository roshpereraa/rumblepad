import Link from "next/link";
import { formatViewers } from "@/lib/format";
import type { Stream } from "@/lib/rumble";

export function StreamCard({ stream }: { stream: Stream }) {
  return (
    <article className="group">
      <Link href={`/stream/${stream.key}`} className="block">
        <div className="relative aspect-video overflow-hidden rounded-lg border border-pad-line bg-pad-raised transition-all group-hover:border-pad-green">
          {stream.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stream.thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-pad-muted">
              No preview
            </div>
          )}

          {stream.live && (
            <span className="absolute left-2 top-2 rounded bg-pad-live px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
              LIVE
            </span>
          )}

          <span className="absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {formatViewers(stream.viewers, stream.viewersLabel)} {stream.live ? "viewers" : "views"}
          </span>

          {stream.duration && (
            <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {stream.duration}
            </span>
          )}
        </div>
      </Link>

      <div className="mt-2.5 flex gap-2.5">
        {stream.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stream.avatar} alt="" className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-pad-raised" />
        )}
        <div className="min-w-0">
          <Link
            href={`/stream/${stream.key}`}
            className="line-clamp-2 text-[14px] font-bold leading-snug text-pad-text hover:text-pad-green-text"
            title={stream.title}
          >
            {stream.title}
          </Link>
          <p className="mt-0.5 truncate text-[13px] text-pad-muted">{stream.channel}</p>
        </div>
      </div>
    </article>
  );
}

export function StreamGrid({ streams }: { streams: Stream[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {streams.map((s) => (
        <StreamCard key={s.key} stream={s} />
      ))}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-pad-green-text">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-pad-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
