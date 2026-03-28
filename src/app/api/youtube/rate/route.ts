import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { rateVideo } from "@/lib/youtubeData";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId, rating } = (await req.json()) as { videoId: string; rating: "like" | "none" };

  if (!videoId || !["like", "none"].includes(rating)) {
    return NextResponse.json({ error: "Invalid videoId or rating" }, { status: 400 });
  }

  try {
    await rateVideo(session.accessToken as string, videoId, rating);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Rate Video Error:", error);
    return NextResponse.json({ error: "Failed to rate video" }, { status: 500 });
  }
}
