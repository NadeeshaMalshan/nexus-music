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

    // Ensure users can only subscribe to their own private-user-[emailHash] channel
    // and the general private-global-activity channel
    if (channelName.startsWith("private-user-")) {
      const emailHash = Buffer.from(session.user.email).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
      const expectedChannel = `private-user-${emailHash}`;
      if (channelName !== expectedChannel) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
