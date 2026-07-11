import { NextResponse } from "next/server";
import { subscribeToChannel } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { addPendingAction, resolveUserEmail } from "@/lib/userLibrary";
import redis from "@/lib/redis";

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

    const email = await resolveUserEmail(request);

    try {
      await subscribeToChannel(accessToken, channelId);
      
      // Update local Redis cache so status endpoint sees it
      if (email && redis) {
        const artistKey = `user:following_artists:${email}`;
        const member = JSON.stringify({ channelId, name: "", thumbnail: "" });
        await redis.sadd(artistKey, member);
      }

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("[YouTube Subscribe] Error:", error);

      // Save to pending queue (so it syncs later)
      if (email && redis) {
        try {
          await addPendingAction(email, {
            type: "SUBSCRIBE_CHANNEL",
            data: { channelId }
          });
          
          // Also update local cache so the UI stays subscribed immediately in the app
          const artistKey = `user:following_artists:${email}`;
          const member = JSON.stringify({ channelId, name: "", thumbnail: "" });
          await redis.sadd(artistKey, member);

          console.log(`[Subscribe API] Queued pending subscription for ${channelId}`);
          return NextResponse.json({ success: true, pendingSync: true });
        } catch (queueErr) {
          console.error("Failed to queue pending subscription:", queueErr);
        }
      }

      return NextResponse.json(
        { error: "Failed to subscribe to channel", details: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[YouTube Subscribe] Fatal Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
