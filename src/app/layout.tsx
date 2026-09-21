import type { Metadata } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { getLiveStreams } from "@/lib/rumble";

export const metadata: Metadata = {
  title: "RumblePad — streams meet markets",
  description:
    "Browse live Rumble streams and their (simulated) token markets. An independent client, not affiliated with Rumble.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // A failed upstream fetch should degrade the sidebar, never the whole app.
  let channels: Awaited<ReturnType<typeof getLiveStreams>> = [];
  try {
    channels = (await getLiveStreams()).slice(0, 20);
  } catch {
    channels = [];
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-pad-bg">
        <TopBar />
        <div className="flex h-[calc(100vh-3.5rem)]">
          <Sidebar channels={channels} />
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
