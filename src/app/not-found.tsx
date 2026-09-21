import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-extrabold">Stream not found</h1>
      <p className="max-w-md text-sm text-pad-muted">
        Rumble didn&apos;t return a video for that link. It may have ended, been made private, or
        the slug may be wrong.
      </p>
      <Link href="/" className="mt-2 rounded-md bg-pad-green px-4 py-2 text-sm font-bold text-pad-on-green">
        Back to browse
      </Link>
    </div>
  );
}
