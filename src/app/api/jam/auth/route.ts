import { NextResponse } from "next/server";
import Pusher from "pusher";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || "",
  secret: process.env.PUSHER_SECRET || "",
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "",
  useTLS: true,
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.formData();
    const socketId = body.get("socket_id") as string;
    const channelName = body.get("channel_name") as string;

    if (!socketId || !channelName) {
      return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
    }

    // Generate unique user data for Presence Channel
    const userId = session?.user?.email || `user-${Math.random().toString(36).substring(7)}`;
    const presenceData = {
      user_id: userId,
      user_info: {
        name: session?.user?.name || "Anonymous",
        image: session?.user?.image || null,
      },
    };

    const authResponse = pusher.authenticate(socketId, channelName, presenceData);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("[Pusher Auth Error]:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
