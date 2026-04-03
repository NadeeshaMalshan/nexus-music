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

    // ─── Case 1: ID is an Artist (Channel ID starting with UC) ───────────────
    if (id.startsWith("UC")) {
       const artist = await api.getArtist(id);
       if (!artist) {
         return NextResponse.json({ error: "Artist not found" }, { status: 404 });
       }
       
       const songs = (artist.topSongs || []).map((s: any) => ({
         id: s.videoId,
         title: s.name,
         artist: artist.name || "YouTube Music",
         artwork: (s.thumbnails || [])[s.thumbnails.length - 1]?.url || (artist.thumbnails || [])[0]?.url || "",
         duration: s.duration ? `${Math.floor(s.duration / 1000 / 60)}:${String(Math.floor((s.duration / 1000) % 60)).padStart(2, "0")}` : "0:00",
         videoId: s.videoId
       }));

       return NextResponse.json({
         id: id,
         name: artist.name,
         description: `Top tracks from ${artist.name}`,
         thumbnails: artist.thumbnails,
         songs
       });
    }

    // ─── Case 2: Standard Playlist ──────────────────────────────────────────
    const playlist = await api.getPlaylist(id);

    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    const songs = (playlist.songs || []).map((s: any) => ({
      id: s.videoId,
      title: s.name,
      artist: s.artist?.name || playlist.author?.name || "YouTube Music",
      artwork: (s.thumbnails || [])[s.thumbnails.length - 1]?.url || (playlist.thumbnails || [])[0]?.url || "",
      duration: s.duration ? `${Math.floor(s.duration / 1000 / 60)}:${String(Math.floor((s.duration / 1000) % 60)).padStart(2, "0")}` : "0:00",
      videoId: s.videoId
    }));

    return NextResponse.json({
      ...playlist,
      songs
    });

  } catch (error: any) {
    console.error("[YT Playlist API] Fatal:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
