import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkSubscriptionStatus } from "@/lib/youtubeData";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json({ subscribed: false });
    }

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
    }

    const subscribed = await checkSubscriptionStatus(session.accessToken, channelId);
    return NextResponse.json({ subscribed });
  } catch (error: any) {
    console.error("[YouTube Subscribe Status] Error:", error);
    return NextResponse.json({ subscribed: false });
  }
}
