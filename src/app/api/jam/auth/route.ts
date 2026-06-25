import { NextResponse } from "next/server";
import Pusher from "pusher";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MAX_JAM_PARTICIPANTS } from "@/lib/jamConstants";

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

    const isHost = request.headers.get("X-Jam-Host") === "true";

    // Enforce participant cap for guests joining an existing room
    if (!isHost && channelName.startsWith("presence-jam-")) {
      try {
        const channelInfo = await pusher.get({
          path: `/channels/${encodeURIComponent(channelName)}`,
          params: { info: "user_count" },
        });
        const rawBody = channelInfo.body;
        const bodyText =
          typeof rawBody === "string"
            ? rawBody
            : await new Response(rawBody as unknown as BodyInit).text();
        const { user_count: userCount = 0 } = JSON.parse(bodyText);
        if (userCount >= MAX_JAM_PARTICIPANTS) {
          return NextResponse.json(
            { error: "Room is full", code: "ROOM_FULL", max: MAX_JAM_PARTICIPANTS },
            { status: 403 }
          );
        }
      } catch {
        // Room may not exist yet — allow the first guest through
      }
    }

    // Generate unique user data for Presence Channel
    // We add a random suffix to ensure multiple tabs/devices from the same account count as unique members
    const uniqueSuffix = Math.random().toString(36).substring(7);
    
    // Check for custom name in headers (passed when joining without login)
    const customName = request.headers.get("X-Jam-Name");
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
