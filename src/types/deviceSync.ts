export type SyncMode = "standalone" | "controller" | "controlled" | "party";

export type DeviceSong = {
  id: string;
  title: string;
  artist: string;
  artwork?: string | null;
  duration?: string | null;
};

export interface DeviceState {
  deviceId: string;
  deviceName: string;
  syncMode: SyncMode;
  currentSong?: DeviceSong | null;
  isPlaying?: boolean;
  lastUpdated: number;
  groupId?: string | null;
  targetDeviceId?: string | null;
  controllerDeviceId?: string | null;
}

export type DeviceControlAction =
  | "device:decouple"
  | "device:control-target"
  | "device:pull-track"
  | "session:sync-all"
  | "play"
  | "pause"
  | "skip"
  | "prev"
  | "transfer"
  | "player:play"
  | "player:pause"
  | "player:seek";

export interface DeviceControlPayload {
  action: DeviceControlAction;
  deviceId?: string;
  controllerDeviceId?: string;
  targetDeviceId?: string;
  groupId?: string;
  deviceIds?: string[];
  song?: DeviceSong | null;
  seekTime?: number;
  queueSongs?: any[];
  upNextQueue?: any[];
  previousQueue?: any[];
}

export interface PlaybackAction {
  action: DeviceControlAction;
  controllerDeviceId?: string;
  targetDeviceId?: string;
  groupId?: string;
  deviceIds?: string[];
  song?: DeviceSong | null;
  seekTime?: number;
  queueSongs?: any[];
  upNextQueue?: any[];
  previousQueue?: any[];
  timestamp: number;
}
