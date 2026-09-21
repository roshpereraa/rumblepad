"use client";

import { useState } from "react";

export function CopyAddress({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      className="shrink-0 rounded-md bg-pad-raised px-2.5 py-1.5 text-[12px] font-semibold text-pad-text hover:text-pad-green-text"
    >
      {copied ? "Copied" : "Copy CA"}
    </button>
  );
}
