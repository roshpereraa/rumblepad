"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  formatEther,
  rpcErrorMessage,
  type EIP1193Provider,
  type ProviderDetail,
} from "@/lib/wallet";

const LAST_WALLET_KEY = "rumblepad:last-wallet";

type WalletState = {
  /** Every wallet that announced itself via EIP-6963. */
  wallets: ProviderDetail[];
  connected: ProviderDetail | null;
  address: string | null;
  chainId: string | null;
  balance: string | null;
  connecting: boolean;
  /** True until the silent reconnect attempt has finished. */
  restoring: boolean;
  error: string | null;
  connect: (detail: ProviderDetail) => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(LAST_WALLET_KEY);
  } catch {
    return null;
  }
}

function writeStored(rdns: string | null) {
  try {
    if (rdns) window.localStorage.setItem(LAST_WALLET_KEY, rdns);
    else window.localStorage.removeItem(LAST_WALLET_KEY);
  } catch {
    /* private mode / blocked storage - connection still works for this tab */
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<ProviderDetail[]>([]);
  const [connected, setConnected] = useState<ProviderDetail | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [restoring, setRestoring] = useState(true);
  /** EIP-6963 announcements are fire-and-forget, so we give them a beat to arrive. */
  const [discoverySettled, setDiscoverySettled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Keeps the event listeners we attached so we can detach them cleanly. */
  const listeners = useRef<{ provider: EIP1193Provider; off: () => void } | null>(null);

  /* ---------------- EIP-6963 discovery ---------------- */
  useEffect(() => {
    const seen = new Map<string, ProviderDetail>();

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<ProviderDetail>).detail;
      if (!detail?.info?.rdns || seen.has(detail.info.rdns)) return;
      seen.set(detail.info.rdns, detail);
      setWallets([...seen.values()]);
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Wallets answer synchronously in practice, but nothing guarantees it —
    // and if none answer at all we still have to stop showing "Checking…".
    const settle = setTimeout(() => setDiscoverySettled(true), 300);

    // Wallets that predate EIP-6963 only expose window.ethereum.
    const legacy = (window as { ethereum?: EIP1193Provider }).ethereum;
    if (legacy && !seen.size) {
      const detail: ProviderDetail = {
        info: {
          uuid: "legacy-injected",
          name: "Browser wallet",
          icon: "",
          rdns: "legacy.injected",
        },
        provider: legacy,
      };
      seen.set(detail.info.rdns, detail);
      setWallets([...seen.values()]);
    }

    return () => {
      clearTimeout(settle);
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
    };
  }, []);

  const refreshBalance = useCallback(async (provider: EIP1193Provider, account: string) => {
    try {
      const wei = (await provider.request({
        method: "eth_getBalance",
        params: [account, "latest"],
      })) as string;
      setBalance(formatEther(wei));
    } catch {
      setBalance(null);
    }
  }, []);

  const detach = useCallback(() => {
    listeners.current?.off();
    listeners.current = null;
  }, []);

  /** Wire up a provider's account/chain events so the UI tracks the wallet. */
  const attach = useCallback(
    (detail: ProviderDetail) => {
      detach();
      const { provider } = detail;
      if (!provider.on || !provider.removeListener) return;

      const onAccounts = (...args: never[]) => {
        const accounts = args[0] as unknown as string[];
        if (!accounts?.length) {
          // The person disconnected RumblePad from inside their wallet.
          setConnected(null);
          setAddress(null);
          setBalance(null);
          writeStored(null);
          detach();
          return;
        }
        setAddress(accounts[0]);
        void refreshBalance(provider, accounts[0]);
      };

      const onChain = (...args: never[]) => {
        const id = args[0] as unknown as string;
        setChainId(id);
        setBalance(null);
      };

      const onDisconnect = () => {
        setConnected(null);
        setAddress(null);
        setBalance(null);
        writeStored(null);
        detach();
      };

      provider.on("accountsChanged", onAccounts);
      provider.on("chainChanged", onChain);
      provider.on("disconnect", onDisconnect);

      listeners.current = {
        provider,
        off: () => {
          provider.removeListener?.("accountsChanged", onAccounts);
          provider.removeListener?.("chainChanged", onChain);
          provider.removeListener?.("disconnect", onDisconnect);
        },
      };
    },
    [detach, refreshBalance],
  );

  /* ---------------- connect ---------------- */
  const connect = useCallback(
    async (detail: ProviderDetail) => {
      setConnecting(true);
      setError(null);
      try {
        const accounts = (await detail.provider.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (!accounts?.length) throw new Error("Your wallet returned no accounts.");

        const id = (await detail.provider.request({ method: "eth_chainId" })) as string;

        setConnected(detail);
        setAddress(accounts[0]);
        setChainId(id);
        writeStored(detail.info.rdns);
        attach(detail);
        void refreshBalance(detail.provider, accounts[0]);
      } catch (err) {
        setError(rpcErrorMessage(err));
      } finally {
        setConnecting(false);
      }
    },
    [attach, refreshBalance],
  );

  /* ---------------- silent reconnect ---------------- */
  useEffect(() => {
    if (!discoverySettled || connected) return;
    let cancelled = false;

    (async () => {
      const rdns = readStored();
      const detail = rdns ? wallets.find((w) => w.info.rdns === rdns) : undefined;
      if (!detail) {
        // Nothing to restore — either no wallet is installed, or none was
        // previously approved. Either way the button must become usable.
        setRestoring(false);
        return;
      }
      try {
        // eth_accounts never prompts: it only reports an existing approval.
        const accounts = (await detail.provider.request({ method: "eth_accounts" })) as string[];
        if (cancelled) return;
        if (accounts?.length) {
          const id = (await detail.provider.request({ method: "eth_chainId" })) as string;
          if (cancelled) return;
          setConnected(detail);
          setAddress(accounts[0]);
          setChainId(id);
          attach(detail);
          void refreshBalance(detail.provider, accounts[0]);
        } else {
          writeStored(null);
        }
      } catch {
        writeStored(null);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [discoverySettled, connected, wallets, attach, refreshBalance]);

  useEffect(() => detach, [detach]);

  /**
   * EIP-1193 has no "disconnect" method — permission lives in the wallet, so
   * this clears our own state and the wallet keeps its grant until revoked
   * there. Wallets that support wallet_revokePermissions get a real revoke.
   */
  const disconnect = useCallback(() => {
    const provider = connected?.provider;
    if (provider) {
      void provider
        .request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] })
        .catch(() => {
          /* not supported by this wallet - local disconnect still applies */
        });
    }
    detach();
    setConnected(null);
    setAddress(null);
    setChainId(null);
    setBalance(null);
    setError(null);
    writeStored(null);
  }, [connected, detach]);

  const value = useMemo<WalletState>(
    () => ({
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
      clearError: () => setError(null),
    }),
    [wallets, connected, address, chainId, balance, connecting, restoring, error, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
