import { NextResponse } from "next/server";
import { checkSubscriptionStatus } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";

export async function GET(request: Request) {
  try {
    const accessToken = await getRequestAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ subscribed: false });
    }

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
    }

    const subscribed = await checkSubscriptionStatus(accessToken, channelId);
    return NextResponse.json({ subscribed });
  } catch (error: any) {
    console.error("[YouTube Subscribe Status] Error:", error);
    return NextResponse.json({ subscribed: false });
  }
}
