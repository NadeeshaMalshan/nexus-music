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

    // ─── Case 2: Radio Mix (ID starts with RD) ──────────────────────────────
    if (id.startsWith("RD")) {
      // Use internal youtubei next endpoint for radio mixes
      const res = await (api as any).client.post("https://music.youtube.com/youtubei/v1/next", {
        context: {
          client: {
            clientName: "WEB_REMIX",
            clientVersion: "1.20240416.01.00",
            hl: "en",
            gl: "US",
          },
        },
        playlistId: id,
      });

      const contents = res.data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer;
      
      if (!contents) {
        return NextResponse.json({ error: "Radio Mix not found" }, { status: 404 });
      }

      const title = contents.title;
      const songs = (contents.contents || []).map((item: any) => {
        const r = item.playlistPanelVideoRenderer;
        if (!r) return null;
        
        const songTitle = r.title?.runs?.[0]?.text;
        const artist = r.longBylineText?.runs?.map((run: any) => run.text).join('') || "YouTube Music";
        const videoId = r.videoId;
        const thumbnails = r.thumbnail?.thumbnails || [];
        const artwork = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : "";
        const duration = r.lengthText?.runs?.[0]?.text || "0:00";

        return {
          id: videoId,
          title: songTitle,
          artist,
          artwork,
          duration,
          videoId
        };
      }).filter(Boolean);

      return NextResponse.json({
        id: id,
        name: title && title !== "Radio Mix" ? title : undefined,
        description: undefined, // Let the frontend keep its original description
        thumbnails: [{ url: songs[0]?.artwork || "" }],
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
