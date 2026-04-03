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
    // We add a random suffix to ensure multiple tabs/devices from the same account count as unique members
    const uniqueSuffix = Math.random().toString(36).substring(7);
    
    // Check for custom name in headers (passed when joining without login)
    const customName = request.headers.get("X-Jam-Name");
    const isHost = request.headers.get("X-Jam-Host") === "true";
    const decodedName = customName ? decodeURIComponent(customName) : null;
    
    const userId = session?.user?.email ? `${session.user.email}-${uniqueSuffix}` : `anon-${uniqueSuffix}`;
    
    const presenceData = {
      user_id: userId,
      user_info: {
        name: decodedName || session?.user?.name || "Guest",
        image: session?.user?.image || null,
        isHost: isHost,
        socketId: socketId
      },
    };

    const authResponse = pusher.authenticate(socketId, channelName, presenceData);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("[Pusher Auth Error]:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
