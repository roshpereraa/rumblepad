/**
 * Simulated token-market layer.
 *
 * RumblePad's stream data is real (pulled from Rumble). The market side is
 * NOT: there is no chain, no wallet and no order book behind this. Every
 * value below is derived deterministically from the channel name so the UI
 * is stable across reloads and obviously demo-grade.
 */

import type { Stream } from "./rumble";

export type Market = {
  rank: number;
  channel: string;
  channelPath: string;
  handle: string;
  ticker: string;
  address: string;
  initials: string;
  avatar: string | null;
  viewers: number | null;
  /** Percent change, simulated. */
  change: number;
  streamKey: string;
};

/** Small deterministic string hash (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function fakeAddress(seed: string): string {
  let out = "";
  let h = hash(seed);
  while (out.length < 40) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    out += h.toString(16).padStart(8, "0");
  }
  return "0x" + out.slice(0, 40);
}

function tickerFor(channel: string): string {
  const cleaned = channel.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return "$" + (cleaned.slice(0, 10) || "STREAM");
}

function initialsFor(channel: string): string {
  const parts = channel.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return channel.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "RP";
}

export function buildMarkets(streams: Stream[]): Market[] {
  return streams.map((s, i) => {
    const seed = s.channel + "|" + s.channelPath;
    const h = hash(seed);
    return {
      rank: i + 1,
      channel: s.channel,
      channelPath: s.channelPath,
      handle: "@" + (s.channelPath.split("/").filter(Boolean).pop() ?? s.channel).toLowerCase(),
      ticker: tickerFor(s.channel),
      address: fakeAddress(seed),
      initials: initialsFor(s.channel),
      avatar: s.avatar,
      viewers: s.viewers,
      // Deterministic pseudo-change in roughly [-35, +65]
      change: Math.round((((h % 10_000) / 10_000) * 100 - 35) * 10) / 10,
      streamKey: s.key,
    };
  });
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
