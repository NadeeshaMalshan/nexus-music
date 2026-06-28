import { NextResponse } from "next/server";
import pusherServer from "@/lib/pusherServer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.formData();
    const socketId = body.get("socket_id") as string;
    const channelName = body.get("channel_name") as string;

    if (!socketId || !channelName) {
      return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
    }

    // Ensure users can only subscribe to their own private-user-[emailHash],
    // presence-user-[emailHash], and the general private-global-activity channel
    if (channelName.startsWith("private-user-") || channelName.startsWith("presence-user-")) {
      const emailHash = Buffer.from(session.user.email).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
      const expectedPrivateChannel = `private-user-${emailHash}`;
      const expectedPresenceChannel = `presence-user-${emailHash}`;
      
      if (channelName !== expectedPrivateChannel && channelName !== expectedPresenceChannel) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (channelName.startsWith("presence-")) {
        const deviceId = request.headers.get("x-device-id") || body.get("device_id") as string || `unknown-${Math.random().toString(36).substring(2, 10)}`;
        const presenceData = {
          user_id: deviceId, // unique per connection / device
          user_info: {
            email: session.user.email,
          }
        };
        const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData);
        return NextResponse.json(authResponse);
      }
    } else if (channelName !== "private-global-activity") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const authResponse = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("[Pusher Auth Error]:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
