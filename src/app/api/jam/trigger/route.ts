import { NextResponse } from "next/server";
import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || "",
  secret: process.env.PUSHER_SECRET || "",
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "",
  useTLS: true,
});

export async function POST(request: Request) {
  try {
    const { roomId, type, payload } = await request.json();

    if (!roomId || !type) {
      return NextResponse.json({ error: "Missing roomId or type" }, { status: 400 });
    }

    // Trigger event on the room's channel
    await pusher.trigger(`jam-${roomId}`, "sync-event", {
      type,
      payload,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Pusher Trigger Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
