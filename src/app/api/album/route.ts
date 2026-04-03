import { NextResponse } from "next/server";
import YTMusic from "ytmusic-api";

let ytmusicInstance: any = null;

async function getYTMusic() {
  if (!ytmusicInstance) {
    ytmusicInstance = new YTMusic();
    await ytmusicInstance.initialize();
  }
  return ytmusicInstance;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const api = await getYTMusic();
    const album = await api.getAlbum(id);

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

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
        videoId: s.videoId
      };
    });

    return NextResponse.json({
      ...album,
      songs
    });

  } catch (error: any) {
    console.error("[Album API] Fatal:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
