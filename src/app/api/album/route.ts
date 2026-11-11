import { NextResponse } from "next/server";
import { getYTMusic } from "@/lib/ytmClient";

function extractAlbumDescription(raw: any): string | null {
  if (!raw) return null;

  // 1. Standard two-column responsive header
  const runs1 =
    raw?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
      ?.musicResponsiveHeaderRenderer?.description?.musicDescriptionShelfRenderer?.description?.runs;
  if (Array.isArray(runs1) && runs1.length) {
    const text = runs1.map((r: any) => r.text || "").join("").trim();
    if (text) return text;
  }

  // 2. Single-column responsive header
  const runs2 =
    raw?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
      ?.musicResponsiveHeaderRenderer?.description?.musicDescriptionShelfRenderer?.description?.runs;
  if (Array.isArray(runs2) && runs2.length) {
    const text = runs2.map((r: any) => r.text || "").join("").trim();
    if (text) return text;
  }

  // 3. musicDetailHeaderRenderer
  const runs3 = raw?.header?.musicDetailHeaderRenderer?.description?.runs;
  if (Array.isArray(runs3) && runs3.length) {
    const text = runs3.map((r: any) => r.text || "").join("").trim();
    if (text) return text;
  }

  // 4. Recursive search fallback
  try {
    let result: string | null = null;
    function walk(node: any) {
      if (!node || result) return;
      if (node?.musicDescriptionShelfRenderer?.description?.runs) {
        const found = node.musicDescriptionShelfRenderer.description.runs.map((r: any) => r.text || "").join("").trim();
        if (found) {
          result = found;
          return;
        }
      }
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
      } else if (typeof node === "object") {
        for (const val of Object.values(node)) walk(val);
      }
    }
    walk(raw);
    if (result) return result;
  } catch {}

  return null;
}

function extractIsExplicit(raw: any): boolean {
  if (!raw) return false;
  try {
    let found = false;
    function walk(node: any) {
      if (!node || found) return;
      if (node?.iconType === "MUSIC_EXPLICIT_BADGE" || node?.icon?.iconType === "MUSIC_EXPLICIT_BADGE") {
        found = true;
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
      } else if (typeof node === "object") {
        for (const val of Object.values(node)) walk(val);
      }
    }
    walk(raw);
    return found;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const api = await getYTMusic();

    let rawBrowse: any = null;
    try {
      rawBrowse = await (api as any).constructRequest("browse", { browseId: id });
    } catch (e) {
      console.warn("[Album API] Could not fetch raw browse payload:", e);
    }

    const album = await api.getAlbum(id);

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const description = extractAlbumDescription(rawBrowse);
    const isExplicit = extractIsExplicit(rawBrowse);

    const songs = (album.songs || []).map((s: any) => {
      const durationSeconds = s.duration || 0;
      const mins = Math.floor(durationSeconds / 60);
      const secs = Math.floor(durationSeconds % 60);
      const durationStr = `${mins}:${secs.toString().padStart(2, "0")}`;

      return {
        id: s.videoId,
        title: s.name,
        artist: s.artist?.name || album.artist?.name || "Unknown",
        artwork: (s.thumbnails || [])[s.thumbnails.length - 1]?.url || (album.thumbnails || [])[0]?.url || "",
        duration: durationStr,
        videoId: s.videoId,
      };
    });

    return NextResponse.json(
      {
        ...album,
        description: description || (album as any).description || null,
        isExplicit: isExplicit || (album as any).isExplicit || false,
        songs,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error: any) {
    console.error("[Album API] Fatal:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
