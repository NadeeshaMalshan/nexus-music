"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from "react";
import Pusher from "pusher-js";
import { useSession } from "next-auth/react";

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
  action: "play" | "pause" | "skip" | "transfer";
  targetDeviceId: string | null;
  sourceDeviceName: string;
  song?: any | null;
  timestamp: number;
};

interface DeviceSyncContextType {
  lastFriendActivity: FriendActivityUpdate | null;
  crossDeviceState: CrossDevicePlayUpdate | null;
  activeDeviceCount: number;
  clearCrossDeviceState: () => void;
  triggerDeviceControl: (action: string, targetDeviceId?: string, song?: any) => Promise<void>;
}

const DeviceSyncContext = createContext<DeviceSyncContextType | null>(null);

export function DeviceSyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pusherRef = useRef<Pusher | null>(null);
  
  const [lastFriendActivity, setLastFriendActivity] = useState<FriendActivityUpdate | null>(null);
  const [crossDeviceState, setCrossDeviceState] = useState<CrossDevicePlayUpdate | null>(null);
  const [activeDeviceCount, setActiveDeviceCount] = useState<number>(1);

  useEffect(() => {
    if (!session?.user?.email) return;

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
      // The `userChannel.members.count` holds the updated count
      setActiveDeviceCount((userChannel as any).members.count);
    });
    userChannel.bind("pusher:member_removed", () => {
      setActiveDeviceCount((userChannel as any).members.count);
    });

    // We generate a local device ID to ignore our own events
    const localDeviceId = typeof window !== 'undefined' ? (window.localStorage.getItem('nexus_device_id') || Math.random().toString(36).substring(2)) : "unknown";
    if (typeof window !== 'undefined' && !window.localStorage.getItem('nexus_device_id')) {
        window.localStorage.setItem('nexus_device_id', localDeviceId);
    }

    userChannel.bind("cross-device-play", (data: CrossDevicePlayUpdate) => {
      if (data.deviceId !== localDeviceId) {
        if (data.isPlaying === false) {
          setCrossDeviceState(null);
        } else {
          setCrossDeviceState(data);
        }
      }
    });

    // 3. Listen for Device Control events
    userChannel.bind("device-control", (data: DeviceControlEvent) => {
      // Only process if this device is the target or if it's a broadcast action
      if (!data.targetDeviceId || data.targetDeviceId === localDeviceId) {
        // Dispatch custom event for components to listen to
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nexus-device-control', { detail: data }));
        }
      }
    });

    return () => {
      pusher.unsubscribe("private-global-activity");
      pusher.unsubscribe(`presence-user-${emailHash}`);
      pusher.disconnect();
    };
  }, [session?.user?.email]);

  const clearCrossDeviceState = () => setCrossDeviceState(null);

  const triggerDeviceControl = async (action: string, targetDeviceId?: string, song?: any) => {
    try {
      const response = await fetch("/api/device/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          targetDeviceId: targetDeviceId || null,
          song,
        }),
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
    clearCrossDeviceState,
    triggerDeviceControl
  }), [lastFriendActivity, crossDeviceState, activeDeviceCount]);

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
      clearCrossDeviceState: () => {},
      triggerDeviceControl: async () => {}
    };
  }
  return context;
}
