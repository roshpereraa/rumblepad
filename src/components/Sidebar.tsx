"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatViewers } from "@/lib/format";
import type { Stream } from "@/lib/rumble";
import { LogoMark } from "./Logo";

function NavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-pad-green-soft text-pad-green-text"
          : "text-pad-text hover:bg-pad-raised hover:text-pad-text"
      }`}
    >
      <span className="text-pad-muted">{icon}</span>
      {label}
    </Link>
  );
}

export function Sidebar({ channels }: { channels: Stream[] }) {
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-pad-line bg-pad-surface lg:flex">
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <span className="text-[13px] font-bold tracking-wide text-pad-muted">For you</span>
      </div>

      <div className="space-y-1 px-2">
        <NavItem
          href="/"
          label="Browse streams"
          icon={
            <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="6" height="6" rx="1.5" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" />
            </svg>
          }
        />
        <NavItem
          href="/markets"
          label="Token markets"
          icon={
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M8 1.5 14.5 5 8 8.5 1.5 5 8 1.5Z" />
              <path d="M1.5 8.5 8 12l6.5-3.5" />
            </svg>
          }
        />
      </div>

      <div className="mt-6 flex items-center justify-between px-4 pb-2">
        <span className="text-[13px] font-bold tracking-wide text-pad-muted">Live channels</span>
        <span className="pad-pulse h-1.5 w-1.5 rounded-full bg-pad-live" aria-hidden="true" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {channels.length === 0 && (
          <p className="px-3 py-2 text-xs text-pad-muted">No live channels right now.</p>
        )}
        {channels.map((s) => (
          <Link
            key={s.key}
            href={`/stream/${s.key}`}
            className="flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-pad-raised"
          >
            {s.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="h-8 w-8 shrink-0 rounded-full bg-pad-raised" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-pad-text">
                {s.channel}
              </span>
              <span className="block truncate text-[11px] text-pad-muted">{s.title}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-pad-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-pad-live" />
              {formatViewers(s.viewers, s.viewersLabel)}
            </span>
          </Link>
        ))}
      </div>

      <div className="border-t border-pad-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <LogoMark size={26} />
          <span className="leading-tight">
            <span className="block text-[13px] font-bold">RumblePad</span>
            <span className="block text-[11px] text-pad-muted">Streams meet markets.</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
