import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import redis from "@/lib/redis";
import pusherServer from "@/lib/pusherServer";

function getDeviceName(userAgent: string | null) {
  if (!userAgent) return "Unknown Device";
  let os = "Unknown";
  let browser = "";

  if (userAgent.includes("Win")) os = "Windows";
  else if (userAgent.includes("Mac")) os = "Mac";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone")) os = "iPhone";
  else if (userAgent.includes("Linux")) os = "Linux";

  if (userAgent.includes("Edg")) browser = "Edge";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) browser = "Chrome";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";

  return browser ? `${os} ${browser}` : os;
}

function normalizeDeviceState(state: any) {
  return {
    deviceId: state.deviceId || "unknown",
    deviceName: state.deviceName || "Unknown Device",
    syncMode: state.syncMode || "standalone",
    currentSong: state.currentSong || null,
    isPlaying: typeof state.isPlaying === "boolean" ? state.isPlaying : false,
    lastUpdated: state.lastUpdated || Date.now(),
    groupId: state.groupId || null,
    targetDeviceId: state.targetDeviceId || null,
    controllerDeviceId: state.controllerDeviceId || null,
  };
}

async function upsertDeviceState(emailHash: string, deviceId: string, state: Record<string, any>) {
  const deviceKey = `user:devices:${emailHash}`;
  await redis?.hset(deviceKey, { [deviceId]: JSON.stringify(state) });
}

async function getDeviceState(emailHash: string, deviceId: string) {
  const deviceKey = `user:devices:${emailHash}`;
  const raw = await redis?.hget(deviceKey, deviceId);
  if (!raw) return null;
  try {
    return normalizeDeviceState(typeof raw === "string" ? JSON.parse(raw) : raw);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!redis) {
      return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
    }

    const body = await request.json();
    const {
      action,
      deviceId,
      targetDeviceId,
      controllerDeviceId,
      deviceIds,
      song,
      seekTime,
      queueSongs,
      upNextQueue,
      previousQueue,
    } = body;

    const emailHash = Buffer.from(session.user.email).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
    const userAgent = request.headers.get("user-agent");
    const deviceName = getDeviceName(userAgent);
    const timestamp = Date.now();

    const deviceKey = `user:devices:${emailHash}`;

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    const broadcast = async (event: string, payload: Record<string, any>) => {
      await pusherServer.trigger(`presence-user-${emailHash}`, event, {
        ...payload,
        timestamp,
      });
    };

    const getAllDeviceIds = async () => {
      const redisClient = redis;
      if (!redisClient) return [];
      const rawDevices = await redisClient.hgetall(deviceKey);
      return rawDevices ? Object.keys(rawDevices) : [];
    };

    if (action === "device:decouple") {
      if (!deviceId) {
        return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
      }

      const existingState = (await getDeviceState(emailHash, deviceId)) || {
        deviceId,
        deviceName,
      };

      const updatedState = {
        ...existingState,
        syncMode: "standalone",
        groupId: null,
        targetDeviceId: null,
        controllerDeviceId: null,
        lastUpdated: timestamp,
      };

      await upsertDeviceState(emailHash, deviceId, updatedState);
      await broadcast("device:decouple", { deviceId, deviceName: updatedState.deviceName });

      return NextResponse.json({ success: true, updatedState });
    }

    if (action === "device:control-target") {
      if (!controllerDeviceId || !targetDeviceId) {
        return NextResponse.json({ error: "Missing controllerDeviceId or targetDeviceId" }, { status: 400 });
      }

      const controllerState = (await getDeviceState(emailHash, controllerDeviceId)) || {
        deviceId: controllerDeviceId,
        deviceName,
      };
      const targetState = (await getDeviceState(emailHash, targetDeviceId)) || {
        deviceId: targetDeviceId,
        deviceName: "Unknown Device",
      };

      const updatedController = {
        ...controllerState,
        syncMode: "controller",
        targetDeviceId,
        controllerDeviceId: null,
        groupId: null,
        lastUpdated: timestamp,
      };
      const updatedTarget = {
        ...targetState,
        syncMode: "controlled",
        controllerDeviceId,
        targetDeviceId: null,
        groupId: null,
        currentSong: song || null,
        isPlaying: true,
        seekTime: seekTime || 0,
        lastUpdated: timestamp,
      };

      await upsertDeviceState(emailHash, controllerDeviceId, updatedController);
      await upsertDeviceState(emailHash, targetDeviceId, updatedTarget);
      await broadcast("device:control-target", {
        controllerDeviceId,
        targetDeviceId,
        song,
        seekTime,
        queueSongs,
        upNextQueue,
        previousQueue,
      });

      return NextResponse.json({ success: true, updatedController, updatedTarget });
    }

    if (action === "device:pull-track") {
      if (!controllerDeviceId || !targetDeviceId) {
        return NextResponse.json({ error: "Missing controllerDeviceId or targetDeviceId" }, { status: 400 });
      }

      const targetState = await getDeviceState(emailHash, targetDeviceId);
      if (!targetState || !targetState.currentSong) {
        return NextResponse.json({ error: "Target device song state not available" }, { status: 400 });
      }

      const controllerState = (await getDeviceState(emailHash, controllerDeviceId)) || {
        deviceId: controllerDeviceId,
        deviceName,
      };

      const updatedController = {
        ...controllerState,
        syncMode: "controlled",
        controllerDeviceId: targetDeviceId,
        targetDeviceId: null,
        groupId: null,
        currentSong: targetState.currentSong,
        isPlaying: true,
        lastUpdated: timestamp,
      };
      const updatedTarget = {
        ...targetState,
        syncMode: "controller",
        targetDeviceId: controllerDeviceId,
        controllerDeviceId: null,
        groupId: null,
        lastUpdated: timestamp,
      };

      await upsertDeviceState(emailHash, controllerDeviceId, updatedController);
      await upsertDeviceState(emailHash, targetDeviceId, updatedTarget);
      await broadcast("device:pull-track", {
        controllerDeviceId,
        targetDeviceId,
        song: targetState.currentSong,
        seekTime,
        queueSongs,
        upNextQueue,
        previousQueue,
      });
      await broadcast("player:play", {
        targetDeviceId: controllerDeviceId,
        song: targetState.currentSong,
        seekTime,
        queueSongs,
        upNextQueue,
        previousQueue,
      });

      return NextResponse.json({ success: true, updatedController, updatedTarget });
    }

    if (action === "session:sync-all") {
      const activeDeviceIds: string[] = Array.isArray(deviceIds) && deviceIds.length > 0 ? deviceIds : await getAllDeviceIds();
      if (activeDeviceIds.length === 0) {
        return NextResponse.json({ error: "No devices to sync" }, { status: 400 });
      }

      const groupId = `party-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const groupKey = `session:group:${groupId}`;
      await redis.del(groupKey);
      await redis.sadd(groupKey, activeDeviceIds);
      await redis.expire(groupKey, 3600);

      const upserts = activeDeviceIds.map(async (id: string) => {
        const existing = (await getDeviceState(emailHash, id)) || { deviceId: id, deviceName: "Unknown Device" };
        const updated = {
          ...existing,
          syncMode: "party",
          groupId,
          controllerDeviceId: null,
          targetDeviceId: null,
          currentSong: song || null,
          isPlaying: true,
          lastUpdated: timestamp,
        };
        return upsertDeviceState(emailHash, id, updated);
      });
      await Promise.all(upserts);

      await broadcast("session:sync-all", {
        groupId,
        deviceIds: activeDeviceIds,
        song,
        seekTime,
        queueSongs,
        upNextQueue,
        previousQueue,
      });
      return NextResponse.json({ success: true, groupId, deviceIds: activeDeviceIds });
    }

    const broadcastActions = [
      "play", "pause", "skip", "prev", "transfer",
      "player:play", "player:pause", "player:seek"
    ];
    if (broadcastActions.includes(action)) {
      const payload = {
        action,
        targetDeviceId: targetDeviceId || null,
        song: song || null,
        seekTime: typeof seekTime === "number" ? seekTime : null,
        queueSongs: queueSongs || null,
        upNextQueue: upNextQueue || null,
        previousQueue: previousQueue || null,
        sourceDeviceName: deviceName,
      };
      await broadcast(action.includes(":") ? action : "device-control", payload);
      return NextResponse.json({ success: true, payload });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to trigger device control:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
