/**
 * Minimal EIP-1193 / EIP-6963 helpers.
 *
 * Deliberately dependency-free: wagmi + WalletConnect would pull ~200kB and
 * need a hosted project id, and nothing here needs more than the injected
 * provider. Read-only account access only — RumblePad never asks a wallet to
 * sign or send anything.
 */

export type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

/** EIP-6963: wallets announce themselves instead of fighting over window.ethereum. */
export type ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

export type ProviderDetail = {
  info: ProviderInfo;
  provider: EIP1193Provider;
};

/** Errors an EIP-1193 provider returns, per spec. */
export const RPC_ERRORS = {
  /** The person clicked "reject" in their wallet. */
  USER_REJECTED: 4001,
  /** A connect prompt is already open and waiting. */
  REQUEST_PENDING: -32002,
  /** The wallet has no such chain configured. */
  UNRECOGNIZED_CHAIN: 4902,
} as const;

export function rpcErrorCode(err: unknown): number | null {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === "number") return code;
  }
  return null;
}

export function rpcErrorMessage(err: unknown): string {
  switch (rpcErrorCode(err)) {
    case RPC_ERRORS.USER_REJECTED:
      return "Connection rejected in your wallet.";
    case RPC_ERRORS.REQUEST_PENDING:
      return "Your wallet already has a connection request open — check it.";
    default:
      if (typeof err === "object" && err !== null && "message" in err) {
        return String((err as { message: unknown }).message);
      }
      return "Couldn't connect to that wallet.";
  }
}

type ChainMeta = { name: string; symbol: string; explorer: string | null };

const CHAINS: Record<string, ChainMeta> = {
  "0x1": { name: "Ethereum", symbol: "ETH", explorer: "https://etherscan.io" },
  "0xa": { name: "OP Mainnet", symbol: "ETH", explorer: "https://optimistic.etherscan.io" },
  "0x38": { name: "BNB Chain", symbol: "BNB", explorer: "https://bscscan.com" },
  "0x89": { name: "Polygon", symbol: "POL", explorer: "https://polygonscan.com" },
  "0x2105": { name: "Base", symbol: "ETH", explorer: "https://basescan.org" },
  "0xa4b1": { name: "Arbitrum One", symbol: "ETH", explorer: "https://arbiscan.io" },
  "0xaa36a7": { name: "Sepolia", symbol: "ETH", explorer: "https://sepolia.etherscan.io" },
};

export function chainMeta(chainId: string | null): ChainMeta {
  if (!chainId) return { name: "Unknown network", symbol: "", explorer: null };
  return (
    CHAINS[chainId.toLowerCase()] ?? {
      name: `Chain ${parseInt(chainId, 16) || chainId}`,
      symbol: "",
      explorer: null,
    }
  );
}

export function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** wei (hex) -> decimal string, without pulling in a bignum library. */
export function formatEther(weiHex: string, digits = 4): string {
  let wei: bigint;
  try {
    wei = BigInt(weiHex);
  } catch {
    return "0";
  }
  const base = 10n ** 18n;
  const whole = wei / base;
  const frac = (wei % base).toString().padStart(18, "0").slice(0, digits).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
