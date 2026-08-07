import { CameraPreset, ResolutionPreset } from '../types';

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export function getResolutionConstraints(preset: ResolutionPreset): { width: number; height: number; aspectRatio?: number } {
  switch (preset) {
    case '4k':
      return { width: 3840, height: 2160, aspectRatio: 16 / 9 };
    case '1440p':
      return { width: 2560, height: 1440, aspectRatio: 16 / 9 };
    case '1080p':
      return { width: 1920, height: 1080, aspectRatio: 16 / 9 };
    case '720p':
      return { width: 1280, height: 720, aspectRatio: 16 / 9 };
    case 'portrait_1080p':
      return { width: 1080, height: 1920, aspectRatio: 9 / 16 };
    case 'portrait_720p':
      return { width: 720, height: 1280, aspectRatio: 9 / 16 };
    default:
      return { width: 1920, height: 1080, aspectRatio: 16 / 9 };
  }
}

export async function getPhysicalCameraDevices(): Promise<MediaDeviceInfo[]> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput');
  } catch (err) {
    console.warn('[WebRTC] Failed to enumerate camera devices:', err);
    return [];
  }
}

export function createSyntheticCameraStream(label = 'Studio Synthetic Camera'): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  let frame = 0;
  const draw = () => {
    if (!ctx) return;
    frame++;

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Animated Grid Pattern
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    const offset = (frame * 0.6) % gridStep;
    for (let x = offset; x < canvas.width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = offset; y < canvas.height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Outer Target Reticle
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 130 + Math.sin(frame * 0.04) * 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 70 + Math.cos(frame * 0.05) * 8, 0, Math.PI * 2);
    ctx.stroke();

    // Center Crosshair
    ctx.strokeStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy);
    ctx.lineTo(cx + 20, cy);
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx, cy + 20);
    ctx.stroke();

    // Text Display
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy - 30);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('STREAMLINK LIVE • VIRTUAL CAMERA ACTIVE', cx, cy + 20);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px monospace';
    ctx.fillText(`FRAME: ${frame} • TIME: ${new Date().toLocaleTimeString()}`, cx, cy + 60);

    requestAnimationFrame(draw);
  };

  draw();

  const canvasStream = canvas.captureStream(30);

  // Audio track generator
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const dst = audioCtx.createMediaStreamDestination();
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.connect(dst);
    osc.start();
    const audioTrack = dst.stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = false; // Muted by default
      canvasStream.addTrack(audioTrack);
    }
  } catch (e) {
    console.warn('Audio synth track error:', e);
  }

  return canvasStream;
}

export async function getCameraStream(options: {
  facingMode?: 'user' | 'environment';
  resolution?: ResolutionPreset;
  fps?: 30 | 60;
  audioMuted?: boolean;
  videoMuted?: boolean;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  deviceId?: string;
}): Promise<MediaStream> {
  const {
    facingMode = 'environment',
    resolution = '1080p',
    fps = 30,
    audioMuted = false,
    videoMuted = false,
    noiseSuppression = true,
    echoCancellation = true,
    deviceId,
  } = options;

  // Tier 1: Try with requested ideal constraints
  try {
    const res = getResolutionConstraints(resolution);
    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: res.width },
      height: { ideal: res.height },
      frameRate: { ideal: fps, max: fps },
    };

    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId };
    } else if (facingMode) {
      videoConstraints.facingMode = { ideal: facingMode };
    }

    const constraints: MediaStreamConstraints = {
      video: videoMuted ? false : videoConstraints,
      audio: audioMuted
        ? false
        : {
            echoCancellation,
            noiseSuppression,
            autoGainControl: true,
          },
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err1) {
    console.warn('[WebRTC] High-res camera request failed, trying simple constraints...', err1);
  }

  // Tier 2: Try basic video & audio constraints
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: !videoMuted,
      audio: !audioMuted,
    });
  } catch (err2) {
    console.warn('[WebRTC] Basic camera request failed, attempting video-only...', err2);
  }

  // Tier 3: Try video-only constraints
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
  } catch (err3) {
    console.warn('[WebRTC] All physical camera access failed/denied. Launching Virtual Studio Camera...', err3);
  }

  // Tier 4: Fallback to high-res animated synthetic camera stream
  return createSyntheticCameraStream('StreamLink Studio Virtual Camera');
}

// Set maximum bitrate on RTCPeerConnection sender
export async function setMaxBitrate(peerConnection: RTCPeerConnection, maxBitrateKbps: number) {
  const senders = peerConnection.getSenders();
  for (const sender of senders) {
    if (sender.track && sender.track.kind === 'video') {
      const parameters = sender.getParameters();
      if (!parameters.encodings || parameters.encodings.length === 0) {
        parameters.encodings = [{}];
      }
      parameters.encodings[0].maxBitrate = maxBitrateKbps * 1000;
      try {
        await sender.setParameters(parameters);
        console.log(`[WebRTC] Set video maxBitrate to ${maxBitrateKbps} kbps`);
      } catch (e) {
        console.warn('[WebRTC] Failed setting bitrate parameter:', e);
      }
    }
  }
}

// Toggle flashlight / torch on mobile camera
export async function setTorchState(stream: MediaStream, enabled: boolean): Promise<boolean> {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return false;

  const capabilities = videoTrack.getCapabilities?.() as any;
  if (capabilities && capabilities.torch) {
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: enabled } as any],
      });
      return true;
    } catch (err) {
      console.warn('[WebRTC] Torch control error:', err);
      return false;
    }
  }
  return false;
}

// Set camera zoom level
export async function setCameraZoom(stream: MediaStream, zoomLevel: number): Promise<boolean> {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return false;

  const capabilities = videoTrack.getCapabilities?.() as any;
  if (capabilities && capabilities.zoom) {
    try {
      const min = capabilities.zoom.min || 1;
      const max = capabilities.zoom.max || 5;
      const targetZoom = Math.min(Math.max(zoomLevel, min), max);
      await videoTrack.applyConstraints({
        advanced: [{ zoom: targetZoom } as any],
      });
      return true;
    } catch (err) {
      console.warn('[WebRTC] Zoom control error:', err);
      return false;
    }
  }
  return false;
}

// Set camera exposure compensation (-2.0 to +2.0 EV)
export async function setCameraExposure(stream: MediaStream, exposureCompensation: number): Promise<boolean> {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return false;

  const capabilities = videoTrack.getCapabilities?.() as any;
  if (capabilities && capabilities.exposureCompensation) {
    try {
      const min = capabilities.exposureCompensation.min ?? -2;
      const max = capabilities.exposureCompensation.max ?? 2;
      const targetEV = Math.min(Math.max(exposureCompensation, min), max);
      await videoTrack.applyConstraints({
        advanced: [{ exposureCompensation: targetEV } as any],
      });
      return true;
    } catch (err) {
      console.warn('[WebRTC] Exposure control error:', err);
      return false;
    }
  }
  return false;
}

// Set camera focus mode and optional focus distance
export async function setCameraFocus(
  stream: MediaStream,
  focusMode: 'auto' | 'manual' | 'continuous',
  focusDistance?: number
): Promise<boolean> {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return false;

  const capabilities = videoTrack.getCapabilities?.() as any;
  if (capabilities) {
    try {
      const advancedConstraint: any = {};
      if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes(focusMode)) {
        advancedConstraint.focusMode = focusMode;
      }
      if (focusDistance !== undefined && capabilities.focusDistance) {
        const min = capabilities.focusDistance.min ?? 0;
        const max = capabilities.focusDistance.max ?? 10;
        advancedConstraint.focusDistance = Math.min(Math.max(focusDistance, min), max);
      }
      if (Object.keys(advancedConstraint).length > 0) {
        await videoTrack.applyConstraints({
          advanced: [advancedConstraint],
        });
        return true;
      }
    } catch (err) {
      console.warn('[WebRTC] Focus control error:', err);
      return false;
    }
  }
  return false;
}

// Apply full CameraPreset to MediaStream
export async function applyCameraPreset(stream: MediaStream, preset: Partial<CameraPreset>): Promise<boolean> {
  let ok = true;
  if (preset.zoom !== undefined) {
    const res = await setCameraZoom(stream, preset.zoom);
    if (!res) ok = false;
  }
  if (preset.exposureCompensation !== undefined) {
    await setCameraExposure(stream, preset.exposureCompensation);
  }
  if (preset.focusMode) {
    await setCameraFocus(stream, preset.focusMode, preset.focusDistance);
  }
  if (preset.torch !== undefined) {
    await setTorchState(stream, preset.torch);
  }
  return ok;
}

// Collect peer connection telemetry stats
export async function collectPeerStats(
  peerConnection: RTCPeerConnection,
  prevBytesSent: number,
  prevTimestamp: number
): Promise<{
  bitrateKbps: number;
  fps: number;
  packetLoss: number;
  latencyMs: number;
  bytesSent: number;
  timestamp: number;
  resolution: string;
}> {
  let bitrateKbps = 0;
  let fps = 0;
  let packetLoss = 0;
  let latencyMs = 0;
  let bytesSent = prevBytesSent;
  let resolution = '1920x1080';
  const now = Date.now();

  try {
    const stats = await peerConnection.getStats();
    stats.forEach((report) => {
      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        if (report.bytesSent && prevTimestamp) {
          const deltaBytes = report.bytesSent - prevBytesSent;
          const deltaSec = (now - prevTimestamp) / 1000;
          if (deltaSec > 0) {
            bitrateKbps = Math.round((deltaBytes * 8) / (deltaSec * 1000));
          }
        }
        bytesSent = report.bytesSent || prevBytesSent;
        fps = report.framesPerSecond || fps;
        if (report.frameWidth && report.frameHeight) {
          resolution = `${report.frameWidth}x${report.frameHeight}`;
        }
      }

      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        latencyMs = Math.round(report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0);
      }

      if (report.type === 'remote-inbound-rtp') {
        if (report.packetsLost && report.packetsReceived) {
          const total = report.packetsLost + report.packetsReceived;
          packetLoss = total > 0 ? Number(((report.packetsLost / total) * 100).toFixed(1)) : 0;
        }
      }
    });
  } catch (err) {
    console.warn('[WebRTC] Error gathering stats:', err);
  }

  return {
    bitrateKbps,
    fps,
    packetLoss,
    latencyMs,
    bytesSent,
    timestamp: now,
    resolution,
  };
}

// Create Audio Meter Analyser node
export function createAudioLevelMeter(stream: MediaStream, callback: (level: number) => void): () => void {
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) return () => {};

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrameId: number;

    const checkLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalized = Math.min(Math.round((average / 128) * 100), 100);
      callback(normalized);
      animationFrameId = requestAnimationFrame(checkLevel);
    };

    checkLevel();

    return () => {
      cancelAnimationFrame(animationFrameId);
      audioContext.close();
    };
  } catch (e) {
    console.warn('[WebRTC] Audio meter initialization failed:', e);
    return () => {};
  }
}
