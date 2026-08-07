export type AppMode = 'director' | 'camera_sender' | 'obs_source' | 'obs_dock' | 'guest';

export type ResolutionPreset = '1080p' | '720p' | '1440p' | '4k' | 'portrait_1080p' | 'portrait_720p';

export interface DeviceSettings {
  cameraFacing: 'user' | 'environment';
  resolution: ResolutionPreset;
  fps: 30 | 60;
  bitrateKbps: number; // e.g. 1000 - 10000
  torch: boolean;
  zoom: number; // 1 to 5
  exposureCompensation: number; // -2.0 to +2.0 EV
  focusMode: 'auto' | 'manual' | 'continuous';
  focusDistance?: number; // 0 to 10
  audioMuted: boolean;
  videoMuted: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  audioGain: number; // 0.0 to 2.0
  backgroundBlur: boolean;
  activeCameraId: string;
  activeMicrophoneId: string;
  landscapeOrientation: boolean;
}

export interface CameraPreset {
  id: string;
  name: string;
  description?: string;
  zoom: number;
  exposureCompensation: number;
  focusMode: 'auto' | 'manual' | 'continuous';
  focusDistance?: number;
  resolution?: ResolutionPreset;
  torch?: boolean;
  isCustom?: boolean;
}

export interface PeerStats {
  bitrateKbps: number;
  fps: number;
  packetLoss: number;
  latencyMs: number;
  resolution: string;
  codec: string;
  timestamp: number;
}

export interface ConnectedPeer {
  id: string; // Socket ID
  peerId: string; // WebRTC Peer ID
  role: AppMode;
  deviceName: string;
  isMobile: boolean;
  batteryLevel?: number;
  isCharging?: boolean;
  settings: Partial<DeviceSettings>;
  stats?: PeerStats;
  joinedAt: number;
}

export interface RoomState {
  roomId: string;
  title: string;
  isProtected: boolean;
  maxGuests: number;
  hostSocketId: string | null;
  activePeerCount: number;
  peers: ConnectedPeer[];
  createdAt: number;
  obsLayout: 'grid' | 'solo' | 'pip' | 'stacked';
  activeSoloPeerId?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
  role: 'host' | 'guest' | 'system';
}

export interface OBSOverlayConfig {
  peerId?: string;
  showNameplate: boolean;
  nameplateText: string;
  transparentBg: boolean;
  chromaKey: 'none' | 'green' | 'blue';
  aspectRatio: '16:9' | '9:16' | '4:3' | 'fill';
  audioDelayMs: number;
  customCSS: string;
}

export interface AICameraAnalysis {
  lightingQuality: 'Optimal' | 'Underexposed' | 'Overexposed' | 'Harsh Backlight';
  framingFeedback: string;
  suggestedAction: string;
  confidence: number;
  timestamp: number;
}

export interface LiveCaption {
  id: string;
  text: string;
  speaker: string;
  timestamp: number;
  isFinal: boolean;
}
