import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { subscribeToChannel } from "@/lib/youtubeData";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { channelId } = await request.json();
    if (!channelId) {
      return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
    }

    await subscribeToChannel(session.accessToken, channelId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[YouTube Subscribe] Error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe to channel", details: error.message },
      { status: 500 }
    );
  }
}
