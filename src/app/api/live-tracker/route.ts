import { NextResponse } from "next/server";
import { getLiveMetadata } from "@/lib/live-tracker";
import { extractFeaturedArtists } from "@/lib/metadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query   = searchParams.get("query") ?? "";
    const title   = searchParams.get("title") ?? "";
    const videoId = searchParams.get("videoId") ?? undefined;

    if (!query && !title) {
      return NextResponse.json({ artist: "", title: "", source: "" });
    }

    const data = await getLiveMetadata(query, title, videoId);
    if (!data) return NextResponse.json({ artist: "", title: "", source: "" });
    
    const { displayTitle, displayArtist } = extractFeaturedArtists(data.title, data.artist);
    return NextResponse.json({
      ...data,
      title: displayTitle,
      artist: displayArtist
    });
  } catch (error) {
    console.error("[live-tracker] Error:", error);
    return NextResponse.json({ artist: "", title: "", source: "" });
  }
}
