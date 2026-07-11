import { NextResponse } from "next/server";
import { checkSubscriptionStatus } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { resolveUserEmail, getPendingActions } from "@/lib/userLibrary";
import redis from "@/lib/redis";

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

    const email = await resolveUserEmail(request);

    if (email && redis) {
      // 1. Check pending subscriptions
      try {
        const pending = await getPendingActions(email);
        const isPendingSubscribe = pending.some(
          (a: any) => a.type === "SUBSCRIBE_CHANNEL" && a.data.channelId === channelId
        );
        if (isPendingSubscribe) {
          return NextResponse.json({ subscribed: true });
        }
      } catch (err) {
        console.warn("Failed to check pending subscriptions:", err);
      }

      // 2. Check local following artists cache
      try {
        const artistKey = `user:following_artists:${email}`;
        const members = await redis.smembers(artistKey);
        const isCachedSubscribed = members.some((m: string) => {
          try {
            const c = JSON.parse(m);
            return c.channelId === channelId;
          } catch {
            return false;
          }
        });
        if (isCachedSubscribed) {
          return NextResponse.json({ subscribed: true });
        }
      } catch (err) {
        console.warn("Failed to check following artists cache:", err);
      }
    }

    // Fallback to official YouTube API check
    const subscribed = await checkSubscriptionStatus(accessToken, channelId);
    return NextResponse.json({ subscribed });
  } catch (error: any) {
    console.error("[YouTube Subscribe Status] Error:", error);
    return NextResponse.json({ subscribed: false });
  }
}
