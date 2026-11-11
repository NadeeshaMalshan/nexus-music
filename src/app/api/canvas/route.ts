import { NextResponse } from "next/server";
import { canvasService } from "@/lib/canvas/canvasService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawTitle = params.get("title")?.trim() ?? "";
  const rawArtist = params.get("artist")?.trim() ?? "";
  const album = params.get("album")?.trim() || undefined;

  if (!rawTitle || !rawArtist) {
    return NextResponse.json(
      {
        error: "title and artist are required",
        hasCanvas: false,
        animatedCover: null,
        fallbackRequired: true,
        source: null,
      },
      { status: 400 }
    );
  }

  if (rawTitle.length > 180 || rawArtist.length > 180 || (album && album.length > 180)) {
    return NextResponse.json(
      {
        error: "query is too long",
        hasCanvas: false,
        animatedCover: null,
        fallbackRequired: true,
        source: null,
      },
      { status: 400 }
    );
  }

  const result = await canvasService.getCanvas({
    title: rawTitle,
    artist: rawArtist,
    album,
  });

  const cacheHeaders = result.hasCanvas
    ? { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" }
    : { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" };

  return NextResponse.json(result, { headers: cacheHeaders });
}
