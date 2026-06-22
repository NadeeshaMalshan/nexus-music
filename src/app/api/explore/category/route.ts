import { NextResponse } from "next/server";
import { getYTMusic } from "@/lib/ytmClient";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const browseId = searchParams.get("browseId");
    const params = searchParams.get("params");

    if (!browseId) {
      return NextResponse.json({ error: "Missing browseId" }, { status: 400 });
    }

    const ytm = await getYTMusic();
    
    // Hit the internal browse endpoint with the provided category browseId and params
    const res = await (ytm as any).client.post("https://music.youtube.com/youtubei/v1/browse", {
      context: {
        client: {
          clientName: "WEB_REMIX",
          clientVersion: "1.20240416.01.00",
          hl: "en",
          gl: "US",
        },
      },
      browseId,
      params,
    });

    const sections = res.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    const parsedShelves = sections.map((s: any) => {
      const shelf = s.musicCarouselShelfRenderer;
      if (!shelf) return null;
      
      const title = shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text;
      
      const items = shelf.contents?.map((c: any) => {
        const r = c.musicTwoRowItemRenderer;
        if (!r) return null;
        
        const itemTitle = r.title?.runs?.[0]?.text;
        const subtitle = r.subtitle?.runs?.map((run: any) => run.text).join('') || '';
        const playlistId = r.playNavigationEndpoint?.watchPlaylistEndpoint?.playlistId || r.navigationEndpoint?.browseEndpoint?.browseId;
        
        // Pick the best thumbnail
        const thumbnails = r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        const thumbnail = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';

        // If it starts with VL, strip it to get the raw playlist ID
        const cleanPlaylistId = playlistId?.startsWith("VL") ? playlistId.slice(2) : playlistId;

        return { title: itemTitle, subtitle, playlistId: cleanPlaylistId, thumbnail };
      }).filter(Boolean);

      return { title, items };
    }).filter((s: any) => s && s.title && s.items && s.items.length > 0);

    return NextResponse.json({ shelves: parsedShelves });
  } catch (error) {
    console.error("[Explore Category API] Error fetching category data:", error);
    return NextResponse.json({ error: "Failed to fetch category data" }, { status: 500 });
  }
}
