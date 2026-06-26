import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import redis from "@/lib/redis";
import { DeviceState } from "@/types/deviceSync";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const emailHash = Buffer.from(email).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
    const deviceKey = `user:devices:${emailHash}`;
    const rawDevices = await redis.hgetall(deviceKey);

    if (!rawDevices || Object.keys(rawDevices).length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const devices: DeviceState[] = Object.entries(rawDevices).map(([deviceId, rawValue]) => {
      const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
      return {
        deviceId,
        deviceName: parsed.deviceName || "Unknown Device",
        syncMode: parsed.syncMode || "standalone",
        currentSong: parsed.currentSong || null,
        isPlaying: parsed.isPlaying || false,
        lastUpdated: parsed.lastUpdated || Date.now(),
        groupId: parsed.groupId || null,
        targetDeviceId: parsed.targetDeviceId || null,
        controllerDeviceId: parsed.controllerDeviceId || null,
      };
    });

    devices.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    return NextResponse.json(devices, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch active devices:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
