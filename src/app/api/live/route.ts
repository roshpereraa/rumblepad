import { NextResponse } from "next/server";
import { getLiveStreams } from "@/lib/rumble";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const streams = await getLiveStreams();
    return NextResponse.json({ count: streams.length, streams });
  } catch (err) {
    return NextResponse.json(
      { error: "upstream_unavailable", message: String(err) },
      { status: 502 },
    );
  }
}
