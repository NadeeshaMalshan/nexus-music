import { NextResponse } from "next/server";
import { rateVideo } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";

export async function POST(req: Request) {
  const accessToken = await getRequestAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId, rating } = (await req.json()) as { videoId: string; rating: "like" | "none" };

  if (!videoId || !["like", "none"].includes(rating)) {
    return NextResponse.json({ error: "Invalid videoId or rating" }, { status: 400 });
  }

  try {
    await rateVideo(accessToken, videoId, rating);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Rate Video Error:", error);
    return NextResponse.json({ error: "Failed to rate video" }, { status: 500 });
  }
}
