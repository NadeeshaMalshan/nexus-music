"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from "react";
import Pusher from "pusher-js";
import { useSession } from "next-auth/react";
import type { DeviceState, DeviceControlAction, DeviceControlPayload } from "@/types/deviceSync";

type FriendActivityUpdate = {
  email: string;
  isPlaying: boolean;
  song: any | null;
  timestamp: number;
};

type CrossDevicePlayUpdate = {
  deviceName: string;
  deviceId: string;
  isPlaying?: boolean;
  song?: any;
};

type DeviceControlEvent = {
  action: DeviceControlAction;
  targetDeviceId?: string | null;
  controllerDeviceId?: string | null;
  sourceDeviceName?: string;
  song?: any | null;
  seekTime?: number;
  groupId?: string;
  deviceIds?: string[];
  timestamp: number;
};

interface DeviceSyncContextType {
  lastFriendActivity: FriendActivityUpdate | null;
  crossDeviceState: CrossDevicePlayUpdate | null;
  activeDeviceCount: number;
  activeDevices: DeviceState[];
  localDeviceId: string;
  clearCrossDeviceState: () => void;
  triggerDeviceControl: (payload: DeviceControlPayload) => Promise<void>;
}

const DeviceSyncContext = createContext<DeviceSyncContextType | null>(null);

export function DeviceSyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pusherRef = useRef<Pusher | null>(null);
  
  const [lastFriendActivity, setLastFriendActivity] = useState<FriendActivityUpdate | null>(null);
  const [crossDeviceState, setCrossDeviceState] = useState<CrossDevicePlayUpdate | null>(null);
  const [activeDeviceCount, setActiveDeviceCount] = useState<number>(1);
  const [activeDevices, setActiveDevices] = useState<DeviceState[]>([]);
  const [localDeviceId, setLocalDeviceId] = useState<string>("unknown");

  const fetchActiveDevices = React.useCallback(async () => {
    try {
      const response = await fetch("/api/device/active");
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data)) {
        setActiveDevices(data);
      }
    } catch (error) {
      console.error("Failed to load active devices:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedDeviceId = window.localStorage.getItem("nexus_device_id");
    const generatedId = storedDeviceId || Math.random().toString(36).substring(2);
    if (!storedDeviceId) {
      window.localStorage.setItem("nexus_device_id", generatedId);
    }
    setLocalDeviceId(generatedId);
  }, []);

  useEffect(() => {
    if (!session?.user?.email || localDeviceId === "unknown") return;

    const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "";

    if (!PUSHER_KEY) return;

    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
      },
    });
    pusherRef.current = pusher;

    // 1. Subscribe to Global Activity (Friends)
    const globalChannel = pusher.subscribe("private-global-activity");
    globalChannel.bind("status-update", (data: FriendActivityUpdate) => {
      // Don't process our own global updates here (we know what we're playing)
      if (data.email !== session.user?.email) {
        setLastFriendActivity(data);
      }
    });

    // 2. Subscribe to Cross-Device Sync (Own Account) using presence
    const emailHash = btoa(session.user.email).replace(/[^a-zA-Z0-9]/g, '');
    const userChannel = pusher.subscribe(`presence-user-${emailHash}`);
    
    // Track active connection count
    userChannel.bind("pusher:subscription_succeeded", (members: any) => {
      setActiveDeviceCount(members.count);
    });
    userChannel.bind("pusher:member_added", () => {
      setActiveDeviceCount((userChannel as any).members.count);
    });
    userChannel.bind("pusher:member_removed", () => {
      setActiveDeviceCount((userChannel as any).members.count);
    });

    userChannel.bind("cross-device-play", (data: CrossDevicePlayUpdate) => {
      if (data.deviceId !== localDeviceId) {
        if (data.isPlaying === false) {
          setCrossDeviceState(null);
        } else {
          setCrossDeviceState(data);
        }
      }
      fetchActiveDevices();
    });

    const dispatchIfRelevant = (data: DeviceControlEvent) => {
      if (!data.targetDeviceId || data.targetDeviceId === localDeviceId) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("nexus-device-control", { detail: data }));
        }
      }
      fetchActiveDevices();
    };

    userChannel.bind("device-control", dispatchIfRelevant);
    userChannel.bind("player:play", dispatchIfRelevant);
    userChannel.bind("player:pause", dispatchIfRelevant);
    userChannel.bind("player:seek", dispatchIfRelevant);
    userChannel.bind("device:decouple", dispatchIfRelevant);
    userChannel.bind("device:control-target", dispatchIfRelevant);
    userChannel.bind("device:pull-track", dispatchIfRelevant);
    userChannel.bind("session:sync-all", dispatchIfRelevant);

    fetchActiveDevices();

    return () => {
      pusher.unsubscribe("private-global-activity");
      pusher.unsubscribe(`presence-user-${emailHash}`);
      pusher.disconnect();
    };
  }, [session?.user?.email, localDeviceId, fetchActiveDevices]);

  const clearCrossDeviceState = () => setCrossDeviceState(null);

  const triggerDeviceControl = async (payload: DeviceControlPayload) => {
    try {
      const response = await fetch("/api/device/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error("Failed to trigger device control");
      }
    } catch (error) {
      console.error("Device control trigger failed:", error);
    }
  };

  const value = useMemo(() => ({
    lastFriendActivity,
    crossDeviceState,
    activeDeviceCount,
    activeDevices,
    localDeviceId,
    clearCrossDeviceState,
    triggerDeviceControl,
  }), [lastFriendActivity, crossDeviceState, activeDeviceCount, activeDevices, localDeviceId]);

  return (
    <DeviceSyncContext.Provider value={value}>
      {children}
    </DeviceSyncContext.Provider>
  );
}

export function useDeviceSync() {
  const context = useContext(DeviceSyncContext);
  if (!context) {
    // If wrapped correctly, this shouldn't happen, but provide fallback for safety
    return { 
      lastFriendActivity: null, 
      crossDeviceState: null, 
      activeDeviceCount: 1, 
      activeDevices: [],
      localDeviceId: "unknown",
      clearCrossDeviceState: () => {},
      triggerDeviceControl: async () => {},
    };
  }
  return context;
}
