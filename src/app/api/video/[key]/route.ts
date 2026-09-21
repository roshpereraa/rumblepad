import { NextResponse } from "next/server";
import { getVideo } from "@/lib/rumble";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const video = await getVideo(decodeURIComponent(key));
  if (!video) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(video);
}
