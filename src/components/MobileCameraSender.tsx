import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  RotateCw,
  Zap,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  Activity,
  Maximize2,
  Sliders,
  BatteryCharging,
  Wifi,
  Lock,
  Sun,
  Layers,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Video,
} from 'lucide-react';
import { DeviceSettings, ResolutionPreset, CameraPreset } from '../types';
import {
  getCameraStream,
  getPhysicalCameraDevices,
  setTorchState,
  setCameraZoom,
  setCameraExposure,
  setCameraFocus,
  applyCameraPreset,
  createAudioLevelMeter,
} from '../lib/webrtc';

interface MobileCameraSenderProps {
  roomId: string;
  onStreamCreated: (stream: MediaStream) => void;
  onSettingsChange: (settings: Partial<DeviceSettings>) => void;
  remoteCommand?: { command: string; payload?: any } | null;
  bitrateKbps: number;
  fps: number;
}

export const MobileCameraSender: React.FC<MobileCameraSenderProps> = ({
  roomId,
  onStreamCreated,
  onSettingsChange,
  remoteCommand,
  bitrateKbps,
  fps,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hardwareCameras, setHardwareCameras] = useState<MediaDeviceInfo[]>([]);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean>(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isUsingSynthetic, setIsUsingSynthetic] = useState<boolean>(false);

  const [settings, setSettings] = useState<DeviceSettings>({
    cameraFacing: 'environment',
    resolution: '1080p',
    fps: 30,
    bitrateKbps: 4000,
    torch: false,
    zoom: 1,
    exposureCompensation: 0,
    focusMode: 'auto',
    focusDistance: 5,
    audioMuted: false,
    videoMuted: false,
    noiseSuppression: true,
    echoCancellation: true,
    audioGain: 1.0,
    backgroundBlur: false,
    activeCameraId: '',
    activeMicrophoneId: '',
    landscapeOrientation: true,
  });

  const [audioLevel, setAudioLevel] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Camera Initializing...');

  // Request Screen Wake Lock so phone doesn't sleep while streaming
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake lock error:', err);
      }
    };
    requestWakeLock();

    // Check Battery status if available
    if ('getBattery' in navigator) {
      (navigator as any).getBattery?.().then((batt: any) => {
        setBatteryLevel(Math.round(batt.level * 100));
        batt.addEventListener('levelchange', () => setBatteryLevel(Math.round(batt.level * 100)));
      });
    }

    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, []);

  // Refresh physical hardware camera list
  const refreshHardwareDevices = async () => {
    const devices = await getPhysicalCameraDevices();
    setHardwareCameras(devices);
    return devices;
  };

  // Initialize Media Stream
  const initStream = async (updatedSettings: DeviceSettings, targetDeviceId?: string) => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const newStream = await getCameraStream({
        facingMode: updatedSettings.cameraFacing,
        resolution: updatedSettings.resolution,
        fps: updatedSettings.fps,
        audioMuted: updatedSettings.audioMuted,
        videoMuted: updatedSettings.videoMuted,
        noiseSuppression: updatedSettings.noiseSuppression,
        echoCancellation: updatedSettings.echoCancellation,
        deviceId: targetDeviceId || updatedSettings.activeCameraId || undefined,
      });

      // Check if synthetic or real track
      const videoTrack = newStream.getVideoTracks()[0];
      const isSyntheticTrack = videoTrack ? videoTrack.label.includes('Synthetic') : true;

      setIsUsingSynthetic(isSyntheticTrack);
      setHasCameraPermission(!isSyntheticTrack);
      setPermissionError(null);

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch((err) => console.warn('[MobileCamera] Video play catch:', err));
      }

      onStreamCreated(newStream);

      if (!isSyntheticTrack) {
        setStatusMessage('Live Phone Camera Active');
        await refreshHardwareDevices();
      } else {
        setStatusMessage('Virtual Camera (Grant Permission for Original Camera)');
      }

      // Setup audio level meter
      const cleanupMeter = createAudioLevelMeter(newStream, (lvl) => setAudioLevel(lvl));
      return cleanupMeter;
    } catch (err: any) {
      console.error('[MobileCamera] Camera initialization error:', err);
      setPermissionError(err.message || 'Camera permission denied or blocked');
      setStatusMessage(`Camera Error: ${err.message || 'Permission required'}`);
    }
  };

  // Explicit user gesture to request original camera permission
  const requestOriginalCameraPermission = async () => {
    setIsRequestingPermission(true);
    setPermissionError(null);
    try {
      // First attempt direct prompt
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: settings.cameraFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      });

      // Stop prompt tracks so initStream can bind properly
      media.getTracks().forEach((t) => t.stop());

      setHasCameraPermission(true);
      setIsUsingSynthetic(false);

      const devs = await refreshHardwareDevices();
      const firstDeviceId = devs.length > 0 ? devs[0].deviceId : undefined;

      await initStream({
        ...settings,
        activeCameraId: firstDeviceId || '',
      });
    } catch (err: any) {
      console.warn('[MobileCamera] Direct user permission request failed:', err);
      setPermissionError('Camera permission request denied or blocked in iframe. Open in full tab.');
    } finally {
      setIsRequestingPermission(false);
    }
  };

  useEffect(() => {
    initStream(settings);
  }, []);

  // Handle incoming remote commands from PC Director
  useEffect(() => {
    if (!remoteCommand || !stream) return;

    const { command, payload } = remoteCommand;
    console.log(`[MobileCamera] Executing remote command: ${command}`, payload);

    if (command === 'toggle_torch') {
      const targetState = payload?.enabled ?? !settings.torch;
      setTorchState(stream, targetState).then((success) => {
        if (success) {
          setSettings((prev) => {
            const next = { ...prev, torch: targetState };
            onSettingsChange(next);
            return next;
          });
        }
      });
    } else if (command === 'switch_facing') {
      const nextFacing = payload?.facingMode || (settings.cameraFacing === 'user' ? 'environment' : 'user');
      const nextSettings = { ...settings, cameraFacing: nextFacing as any };
      setSettings(nextSettings);
      initStream(nextSettings);
      onSettingsChange(nextSettings);
    } else if (command === 'set_zoom') {
      const zoomVal = payload?.zoom || 1;
      setCameraZoom(stream, zoomVal).then(() => {
        setSettings((prev) => {
          const next = { ...prev, zoom: zoomVal };
          onSettingsChange(next);
          return next;
        });
      });
    } else if (command === 'set_exposure') {
      const evVal = payload?.exposureCompensation ?? 0;
      setCameraExposure(stream, evVal).then(() => {
        setSettings((prev) => {
          const next = { ...prev, exposureCompensation: evVal };
          onSettingsChange(next);
          return next;
        });
      });
    } else if (command === 'set_focus') {
      const mode = payload?.focusMode || 'auto';
      const dist = payload?.focusDistance;
      setCameraFocus(stream, mode, dist).then(() => {
        setSettings((prev) => {
          const next = { ...prev, focusMode: mode, focusDistance: dist ?? prev.focusDistance };
          onSettingsChange(next);
          return next;
        });
      });
    } else if (command === 'apply_preset') {
      const preset: Partial<CameraPreset> = payload?.preset || payload || {};
      const resChanged = preset.resolution && preset.resolution !== settings.resolution;
      applyCameraPreset(stream, preset).then(() => {
        setSettings((prev) => {
          const next: DeviceSettings = {
            ...prev,
            zoom: preset.zoom ?? prev.zoom,
            exposureCompensation: preset.exposureCompensation ?? prev.exposureCompensation,
            focusMode: preset.focusMode ?? prev.focusMode,
            focusDistance: preset.focusDistance ?? prev.focusDistance,
            torch: preset.torch !== undefined ? preset.torch : prev.torch,
            resolution: preset.resolution ?? prev.resolution,
          };
          onSettingsChange(next);
          if (resChanged) {
            initStream(next);
          }
          return next;
        });
        setStatusMessage(`Preset Applied: ${preset.name || 'Custom'} (${preset.resolution?.toUpperCase() || '1080P'})`);
      });
    } else if (command === 'set_resolution') {
      const resVal = payload?.resolution || '1080p';
      const nextSettings = { ...settings, resolution: resVal };
      setSettings(nextSettings);
      initStream(nextSettings);
      onSettingsChange(nextSettings);
    } else if (command === 'mute_audio') {
      const muted = payload?.muted ?? !settings.audioMuted;
      stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
      setSettings((prev) => {
        const next = { ...prev, audioMuted: muted };
        onSettingsChange(next);
        return next;
      });
    } else if (command === 'mute_video') {
      const muted = payload?.muted ?? !settings.videoMuted;
      stream.getVideoTracks().forEach((t) => (t.enabled = !muted));
      setSettings((prev) => {
        const next = { ...prev, videoMuted: muted };
        onSettingsChange(next);
        return next;
      });
    }
  }, [remoteCommand]);

  // Flip Camera locally
  const flipCamera = () => {
    const nextFacing = settings.cameraFacing === 'user' ? 'environment' : 'user';
    const nextSettings = { ...settings, cameraFacing: nextFacing as any };
    setSettings(nextSettings);
    initStream(nextSettings);
    onSettingsChange(nextSettings);
  };

  // Toggle Flashlight locally
  const toggleFlashlight = async () => {
    if (!stream) return;
    const targetState = !settings.torch;
    const ok = await setTorchState(stream, targetState);
    if (ok) {
      const next = { ...settings, torch: targetState };
      setSettings(next);
      onSettingsChange(next);
    }
  };

  // Toggle Mute Audio
  const toggleMuteAudio = () => {
    if (!stream) return;
    const nextMuted = !settings.audioMuted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    const next = { ...settings, audioMuted: nextMuted };
    setSettings(next);
    onSettingsChange(next);
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden select-none touch-none">
      {/* High-Res Video Viewport */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
        onClick={() => setShowControls(!showControls)}
      />

      {/* Top Status Bar HUD */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent text-white text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold tracking-wide">STREAMLINK LIVE</span>
          {settings.resolution === '4k' ? (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-mono font-bold border border-amber-500/50 shadow-lg shadow-amber-500/20 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
              4K ULTRA HD
            </span>
          ) : (
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono border border-cyan-500/30">
              {settings.resolution.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-300 font-mono text-[11px]">
          {batteryLevel !== null && (
            <span className="flex items-center gap-1">
              <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
              {batteryLevel}%
            </span>
          )}
          <span className="flex items-center gap-1">
            <Wifi className="h-3.5 w-3.5 text-cyan-400" />
            {bitrateKbps || 3200} kbps
          </span>
        </div>
      </div>

      {/* Audio Level Meter Bar */}
      <div className="absolute top-14 left-4 right-4 z-20 h-1.5 rounded-full bg-slate-900/80 overflow-hidden border border-slate-800">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-500 transition-all duration-75"
          style={{ width: `${audioLevel}%` }}
        />
      </div>

      {/* Center On-Screen Notification Banner */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 rounded-full bg-slate-950/80 px-4 py-1.5 text-xs font-semibold text-emerald-300 backdrop-blur-md border border-emerald-500/30 shadow-lg flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-emerald-400 animate-spin" />
        <span>{statusMessage}</span>
      </div>

      {/* Original Camera Permission Prompt Overlay */}
      {(!hasCameraPermission || isUsingSynthetic) && (
        <div className="absolute inset-x-4 top-28 z-40 flex flex-col items-center justify-center p-5 rounded-3xl bg-slate-950/95 border border-cyan-500/40 text-white backdrop-blur-2xl shadow-2xl animate-fade-in text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400">
            <Camera className="h-6 w-6 animate-pulse" />
          </div>

          <div>
            <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              অরিজিনাল মোবাইল ক্যামেরা চালুর অনুমতি দিন
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xs leading-relaxed">
              Enable full physical HD camera access on your mobile device to stream live video to PC Studio.
            </p>
          </div>

          {permissionError && (
            <div className="w-full bg-red-950/60 border border-red-800 text-red-200 text-[11px] p-2.5 rounded-xl flex items-center gap-2 text-left">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{permissionError}</span>
            </div>
          )}

          <button
            onClick={requestOriginalCameraPermission}
            disabled={isRequestingPermission}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 font-bold text-sm text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
          >
            <Video className="h-4 w-4" />
            <span>
              {isRequestingPermission ? 'অনুমতি নেওয়া হচ্ছে...' : '📸 Allow Original Phone Camera / পারমিশন দিন'}
            </span>
          </button>

          {/* Physical camera selection dropdown if available */}
          {hardwareCameras.length > 0 && (
            <div className="w-full mt-1">
              <label className="text-[10px] text-slate-400 font-mono block text-left mb-1">
                SELECT PHYSICAL CAMERA HARDWARE:
              </label>
              <select
                value={settings.activeCameraId}
                onChange={(e) => {
                  const devId = e.target.value;
                  setSettings((prev) => ({ ...prev, activeCameraId: devId }));
                  initStream({ ...settings, activeCameraId: devId }, devId);
                }}
                className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 outline-none focus:border-cyan-400"
              >
                {hardwareCameras.map((cam, idx) => (
                  <option key={cam.deviceId || idx} value={cam.deviceId}>
                    📷 {cam.label || `Mobile Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* If inside iframe on preview mode, option to open full tab */}
          {window.self !== window.top && (
            <a
              href={window.location.href}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-400 underline hover:text-cyan-300 flex items-center gap-1 mt-1 font-semibold"
            >
              <span>Frame permission issues? Open in New Browser Tab</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* Floating Bottom Quick Action Controls (Fades on tap) */}
      {showControls && (
        <div className="absolute bottom-6 left-4 right-4 z-30 flex flex-col items-center gap-4 bg-slate-950/85 backdrop-blur-xl p-4 rounded-3xl border border-slate-800/80 text-white animate-fade-in shadow-2xl">
          {/* Zoom Slider */}
          <div className="w-full flex items-center gap-3 px-2 text-xs">
            <span className="text-slate-400 font-mono">1x</span>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={settings.zoom}
              onChange={(e) => {
                const z = parseFloat(e.target.value);
                setCameraZoom(stream!, z);
                setSettings({ ...settings, zoom: z });
              }}
              className="w-full accent-cyan-400"
            />
            <span className="text-slate-400 font-mono">5x</span>
            <span className="font-bold text-cyan-400 font-mono w-8">{settings.zoom}x</span>
          </div>

          {/* Core Buttons */}
          <div className="grid grid-cols-4 gap-3 w-full">
            {/* Flip Camera */}
            <button
              onClick={flipCamera}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-slate-900 hover:bg-slate-800 p-3 text-xs font-semibold text-slate-200 border border-slate-800"
            >
              <RotateCw className="h-5 w-5 text-cyan-400" />
              <span>Flip</span>
            </button>

            {/* Flashlight */}
            <button
              onClick={toggleFlashlight}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl p-3 text-xs font-semibold border transition-all ${
                settings.torch
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Zap className="h-5 w-5 text-amber-400" />
              <span>Torch</span>
            </button>

            {/* Mute Audio */}
            <button
              onClick={toggleMuteAudio}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl p-3 text-xs font-semibold border transition-all ${
                settings.audioMuted
                  ? 'bg-red-500/20 border-red-500 text-red-300'
                  : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {settings.audioMuted ? (
                <VolumeX className="h-5 w-5 text-red-400" />
              ) : (
                <Volume2 className="h-5 w-5 text-emerald-400" />
              )}
              <span>{settings.audioMuted ? 'Muted' : 'Mic On'}</span>
            </button>

            {/* Resolution Selector */}
            <button
              onClick={() => {
                const nextRes: ResolutionPreset =
                  settings.resolution === '1080p'
                    ? '4k'
                    : settings.resolution === '4k'
                    ? '1440p'
                    : settings.resolution === '1440p'
                    ? 'portrait_1080p'
                    : '1080p';
                const next = { ...settings, resolution: nextRes };
                setSettings(next);
                initStream(next);
                onSettingsChange(next);
              }}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl p-3 text-xs font-semibold border transition-all ${
                settings.resolution === '4k'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className={`h-5 w-5 ${settings.resolution === '4k' ? 'text-amber-400 animate-pulse' : 'text-purple-400'}`} />
              <span className="text-[10px] font-bold font-mono">
                {settings.resolution === '4k' ? '4K 2160p' : settings.resolution.toUpperCase()}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
