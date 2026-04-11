import { NextResponse } from "next/server";
import { subscribeToChannel } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";

export async function POST(request: Request) {
  try {
    const accessToken = await getRequestAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { channelId } = await request.json();
    if (!channelId) {
      return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
    }

    await subscribeToChannel(accessToken, channelId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[YouTube Subscribe] Error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe to channel", details: error.message },
      { status: 500 }
    );
  }
}
