/**
 * RumblePad's mark: a green rounded-triangle play glyph.
 *
 * Swapping in an official brand asset: drop the vector at
 * `public/brand/logo.svg` and replace the <svg> body below with it (or render
 * <img src="/brand/logo.svg" />). Nothing else in the app needs to change.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      role="img"
    >
      <g transform="rotate(-6 50 50)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          fill="var(--color-pad-green)"
          d="M58.4 30.6 L62.6 33 Q92 50 62.6 67 L58.4 69.4 Q29 86.4 29 52.4 L29 47.6 Q29 13.6 58.4 30.6 Z
             M42.6 37 L58.9 46.5 Q65 50 58.9 53.5 L42.6 63 Q36.5 66.5 36.5 59.5 L36.5 40.5 Q36.5 33.5 42.6 37 Z"
        />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`text-[20px] font-extrabold tracking-tight ${className}`}>
      <span className="text-pad-text">Rumble</span>
      <span className="text-pad-green-text">Pad</span>
    </span>
  );
}
