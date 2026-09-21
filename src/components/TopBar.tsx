"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark, Wordmark } from "./Logo";

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = q.trim();
    if (!value) return;
    router.push(`/?q=${encodeURIComponent(value)}`);
  }

  const tabs = [
    { href: "/", label: "Browse", match: (p: string) => p === "/" || p.startsWith("/stream") },
    { href: "/markets", label: "Markets", match: (p: string) => p.startsWith("/markets") },
  ];

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-pad-line bg-pad-surface px-4 backdrop-blur sm:gap-6">
      <Link href="/" className="flex shrink-0 items-center gap-2.5">
        <LogoMark size={30} />
        {/* The wordmark is the first thing to go when space is tight. */}
        <Wordmark className="hidden sm:inline" />
      </Link>

      {/* Kept visible at every width: the sidebar is hidden below lg, so these
          are the only way to reach Markets on a phone. */}
      <nav className="flex items-center gap-1">
        {tabs.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative px-3 py-2 text-sm font-semibold transition-colors ${
                active ? "text-pad-green-text" : "text-pad-muted hover:text-pad-text"
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-pad-green" />
              )}
            </Link>
          );
        })}
      </nav>

      <form onSubmit={submit} className="ml-auto hidden max-w-md flex-1 md:block">
        <div className="flex h-9 items-center rounded-md border border-pad-line bg-pad-bg focus-within:border-pad-green">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter live streams, or paste a Rumble link"
            aria-label="Search streams"
            className="h-full flex-1 bg-transparent px-3 text-sm text-pad-text placeholder:text-pad-muted/70 outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex h-full w-10 items-center justify-center border-l border-pad-line text-pad-muted hover:text-pad-green-text"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="7" cy="7" r="4.6" />
              <path d="m10.5 10.5 3 3" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => alert("Wallet connection is not implemented — RumblePad's market layer is a UI demo.")}
        className="ml-auto shrink-0 rounded-md bg-pad-green px-4 py-2 text-sm font-bold text-pad-on-green transition-colors hover:bg-pad-green-dim md:ml-0"
      >
        Connect wallet
      </button>
    </header>
  );
}
