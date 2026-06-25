import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pusherServer from "@/lib/pusherServer";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, targetDeviceId, song } = body;

    if (!action || !["play", "pause", "skip", "transfer"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const emailHash = Buffer.from(session.user.email).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    const userAgent = request.headers.get("user-agent");
    
    let deviceName = "Unknown Device";
    if (userAgent) {
      // Detect OS
      let os = "Unknown";
      if (userAgent.includes("Win")) os = "Windows";
      else if (userAgent.includes("Mac")) os = "Mac";
      else if (userAgent.includes("Android")) os = "Android";
      else if (userAgent.includes("iPhone")) os = "iPhone";
      else if (userAgent.includes("Linux")) os = "Linux";
      
      // Detect Browser
      let browser = "";
      if (userAgent.includes("Edg/")) browser = "Edge";
      else if (userAgent.includes("Chrome/")) browser = "Chrome";
      else if (userAgent.includes("Firefox/")) browser = "Firefox";
      else if (userAgent.includes("Safari/")) browser = "Safari";
      
      deviceName = browser ? `${os} ${browser}` : os;
    }

    // Trigger the device control event via Pusher
    await pusherServer.trigger(`presence-user-${emailHash}`, "device-control", {
      action,
      targetDeviceId: targetDeviceId || null,
      sourceDeviceName: deviceName,
      song: song || null,
      timestamp: Date.now(),
    });

    return NextResponse.json({ 
      success: true, 
      message: `Device control action "${action}" triggered` 
    });
  } catch (error) {
    console.error("Failed to trigger device control:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
