"use client";

import { useEffect, useRef, useState } from "react";
import { chainMeta, truncateAddress } from "@/lib/wallet";
import { useWallet } from "./WalletProvider";

/** Close a popover on Escape or an outside click. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, close]);
  return ref;
}

export function ConnectWallet() {
  const {
    wallets,
    connected,
    address,
    chainId,
    balance,
    connecting,
    restoring,
    error,
    connect,
    disconnect,
    clearError,
  } = useWallet();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const pickerRef = useDismiss(pickerOpen, () => {
    setPickerOpen(false);
    clearError();
  });
  const menuRef = useDismiss(menuOpen, () => setMenuOpen(false));

  const chain = chainMeta(chainId);

  /* ---------------- connected ---------------- */
  if (address) {
    return (
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex items-center gap-2 rounded-md border border-pad-line bg-pad-bg px-3 py-2 text-sm font-bold text-pad-text hover:border-pad-green"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-pad-green" aria-hidden="true" />
          <span className="font-mono text-[13px]">{truncateAddress(address)}</span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+6px)] w-72 overflow-hidden rounded-xl border border-pad-line bg-pad-bg shadow-lg"
          >
            <div className="border-b border-pad-line px-4 py-3">
              <p className="text-[11px] font-bold tracking-wide text-pad-muted">
                {connected?.info.name ?? "Wallet"} · {chain.name}
              </p>
              <p className="mt-1 break-all font-mono text-[12px] text-pad-text">{address}</p>
              {balance !== null && (
                <p className="mt-2 text-[13px] font-bold text-pad-text">
                  {balance} {chain.symbol}
                </p>
              )}
            </div>

            <div className="p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    setCopied(false);
                  }
                }}
                className="w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold text-pad-text hover:bg-pad-raised"
              >
                {copied ? "Address copied" : "Copy address"}
              </button>

              {chain.explorer && (
                <a
                  role="menuitem"
                  href={`${chain.explorer}/address/${address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md px-3 py-2 text-[13px] font-semibold text-pad-text hover:bg-pad-raised"
                >
                  View on explorer ↗
                </a>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  disconnect();
                  setMenuOpen(false);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold text-pad-live hover:bg-pad-raised"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------------- not connected ---------------- */
  return (
    <div className="relative shrink-0" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        disabled={restoring}
        aria-expanded={pickerOpen}
        aria-haspopup="dialog"
        className="rounded-md bg-pad-green px-4 py-2 text-sm font-bold text-pad-on-green transition-colors hover:bg-pad-green-dim disabled:opacity-60"
      >
        {restoring ? "Checking…" : "Connect wallet"}
      </button>

      {pickerOpen && (
        <div
          role="dialog"
          aria-label="Choose a wallet"
          className="absolute right-0 top-[calc(100%+6px)] w-72 overflow-hidden rounded-xl border border-pad-line bg-pad-bg shadow-lg"
        >
          <div className="border-b border-pad-line px-4 py-3">
            <p className="text-[13px] font-extrabold text-pad-text">Connect a wallet</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-pad-muted">
              RumblePad only reads your address. It never asks you to sign or send anything.
            </p>
          </div>

          {wallets.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-[13px] font-semibold text-pad-text">No wallet detected</p>
              <p className="mt-1 text-[11px] leading-relaxed text-pad-muted">
                Install a browser wallet such as MetaMask or Rabby, then reload this page.
              </p>
            </div>
          ) : (
            <div className="p-1.5">
              {wallets.map((w) => (
                <button
                  key={w.info.uuid}
                  type="button"
                  disabled={connecting}
                  onClick={async () => {
                    await connect(w);
                    setPickerOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-pad-raised disabled:opacity-60"
                >
                  {w.info.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.info.icon} alt="" className="h-6 w-6 shrink-0 rounded" />
                  ) : (
                    <span className="h-6 w-6 shrink-0 rounded bg-pad-raised" />
                  )}
                  <span className="flex-1 truncate text-[13px] font-semibold text-pad-text">
                    {w.info.name}
                  </span>
                  {connecting && <span className="text-[11px] text-pad-muted">…</span>}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="border-t border-pad-line bg-pad-surface px-4 py-2.5 text-[11px] leading-relaxed text-pad-live">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
