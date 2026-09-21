"use client";

import { chainMeta } from "@/lib/wallet";
import { useWallet } from "./WalletProvider";

/**
 * The wallet connection is real; the market is not. This panel is explicit
 * about which half is which, and stays disabled either way — there is no
 * contract to trade against.
 */
export function TradePanel({ ticker }: { ticker: string }) {
  const { address, chainId, connected } = useWallet();
  const chain = chainMeta(chainId);

  return (
    <>
      <button
        type="button"
        disabled
        title="RumblePad has no market contract — nothing to trade against."
        className="mt-3 w-full cursor-not-allowed rounded-md border border-pad-line bg-pad-raised py-2.5 text-[13px] font-bold text-pad-muted"
      >
        Trade {ticker}
      </button>

      <p className="mt-2 text-[11px] leading-relaxed text-pad-muted">
        {address ? (
          <>
            <span className="font-bold text-pad-text">
              {connected?.info.name ?? "Wallet"} connected on {chain.name}.
            </span>{" "}
            That part is real — RumblePad reads your address and nothing else. This pair
            isn&apos;t: the ticker and price move are generated locally, so there&apos;s no
            contract to trade against.
          </>
        ) : (
          <>Simulated pair. The ticker and price move are generated locally — there is no
          chain or contract behind this panel.</>
        )}
      </p>
    </>
  );
}
