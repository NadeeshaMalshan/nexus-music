import { NextResponse } from "next/server";
import { getYTMusic } from "@/lib/ytmClient";

export async function GET() {
  try {
    const ytm = await getYTMusic();
    
    // Use the internal axios client from ytmusic-api to hit the browse endpoint directly
    const res = await (ytm as any).client.post("https://music.youtube.com/youtubei/v1/browse", {
      context: {
        client: {
          clientName: "WEB_REMIX",
          clientVersion: "1.20240416.01.00",
          hl: "en",
          gl: "US",
        },
      },
      browseId: "FEmusic_moods_and_genres",
    });

    const sections = res.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    const parsedSections = sections.map((s: any) => {
      const title = s.gridRenderer?.header?.gridHeaderRenderer?.title?.runs?.[0]?.text;
      const items = s.gridRenderer?.items?.map((item: any) => {
        const btn = item.musicNavigationButtonRenderer;
        if (!btn) return null;

        const name = btn.buttonText?.runs?.[0]?.text;
        const colorInt = btn.solid?.leftStripeColor;
        let colorHex = "#ffffff"; // default

        if (colorInt) {
          // Convert ARGB integer to HEX string
          const hexString = (colorInt >>> 0).toString(16).padStart(8, '0');
          // Format is AARRGGBB, we extract RRGGBB
          colorHex = `#${hexString.slice(2, 8)}`;
        }

        const browseId = btn.clickCommand?.browseEndpoint?.browseId;
        const params = btn.clickCommand?.browseEndpoint?.params;

        return { name, color: colorHex, browseId, params };
      }).filter(Boolean);

      return { title, items };
    }).filter((s: any) => s.title && s.items && s.items.length > 0);

    return NextResponse.json({ sections: parsedSections });
  } catch (error) {
    console.error("[Explore API] Error fetching explore data:", error);
    return NextResponse.json({ error: "Failed to fetch explore data" }, { status: 500 });
  }
}
