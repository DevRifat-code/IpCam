import React, { useState, useEffect } from 'react';
import {
  Grid,
  Maximize2,
  Tv,
  Zap,
  Volume2,
  VolumeX,
  Smartphone,
  Sliders,
  Activity,
  RotateCw,
  Camera,
  Sun,
  Lock,
  Layers,
  Sparkles,
  Wifi,
  BatteryCharging,
  Radio,
  Eye,
  Settings,
  MessageSquare,
  Copy,
  Check,
  Target,
  Bookmark,
} from 'lucide-react';
import { ConnectedPeer, DeviceSettings, PeerStats, ChatMessage } from '../types';
import { CameraPresetsPanel } from './CameraPresetsPanel';

interface DirectorStudioProps {
  roomId: string;
  socket?: any;
  peers: ConnectedPeer[];
  remoteStreams: Map<string, MediaStream>;
  onSendRemoteCommand: (targetSocketId: string, command: string, payload?: any) => void;
  onLayoutChange: (layout: string, activeSoloPeerId?: string) => void;
  activeLayout: string;
  activeSoloPeerId?: string;
  chatMessages: ChatMessage[];
  onSendChat: (msg: string) => void;
  onOpenQRPair: () => void;
  onOpenOBSModal: () => void;
  onOpenAIModal: () => void;
}

export const DirectorStudio: React.FC<DirectorStudioProps> = ({
  roomId,
  socket,
  peers,
  remoteStreams,
  onSendRemoteCommand,
  onLayoutChange,
  activeLayout,
  activeSoloPeerId,
  chatMessages,
  onSendChat,
  onOpenQRPair,
  onOpenOBSModal,
  onOpenAIModal,
}) => {
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const activePeersList = peers.filter((p) => p.role === 'camera_sender' || p.role === 'guest');

  useEffect(() => {
    if (!selectedPeerId && activePeersList.length > 0) {
      setSelectedPeerId(activePeersList[0].id);
    }
  }, [activePeersList, selectedPeerId]);

  const selectedPeer = peers.find((p) => p.id === selectedPeerId);
  const selectedStream = selectedPeerId ? remoteStreams.get(selectedPeerId) : null;

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}?role=camera_sender`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex h-[calc(100vh-65px)] w-full flex-col bg-[#050508]/80 text-slate-100 overflow-hidden backdrop-blur-sm">
      {/* Top Studio Control Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/20 backdrop-blur-md px-6 py-2.5 text-xs">
        {/* Layout Switchers */}
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-400">Multiview Layout:</span>
          <div className="flex items-center rounded-xl bg-white/5 p-1 border border-white/10 backdrop-blur-md">
            {[
              { id: 'grid', label: 'Grid Multiview', icon: Grid },
              { id: 'solo', label: 'Solo Program', icon: Maximize2 },
              { id: 'pip', label: 'Picture-in-Picture', icon: Tv },
            ].map((layout) => {
              const Icon = layout.icon;
              return (
                <button
                  key={layout.id}
                  onClick={() => onLayoutChange(layout.id, selectedPeerId || undefined)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    activeLayout === layout.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{layout.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyRoomLink}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-1.5 text-xs font-medium text-slate-200 border border-white/10 backdrop-blur-md transition-all"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-blue-400" />}
            <span>{copiedLink ? 'Copied' : 'Copy Camera Link'}</span>
          </button>
          <button
            onClick={onOpenQRPair}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-3.5 py-1.5 text-xs font-semibold border border-blue-500/30 backdrop-blur-md transition-all"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>+ Pair Phone</span>
          </button>
        </div>
      </div>

      {/* Main Workspace split into Video Multiviewer & Control Deck */}
      <div className="grid h-full grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Multiview Video Canvas (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col p-4 overflow-y-auto">
          {activePeersList.length === 0 ? (
            /* Empty State when no camera phone is connected yet */
            <div className="my-auto flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/20 backdrop-blur-xl p-12 text-center shadow-2xl">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 border border-white/10 mb-4 animate-bounce shadow-lg">
                <Smartphone className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Mobile Camera Connected</h3>
              <p className="max-w-md text-xs text-slate-400 mb-6 leading-relaxed">
                Scan the QR code with your iPhone, Android, or tablet camera to instantly stream 1080p/4K low-latency WebRTC video to this PC studio.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={onOpenQRPair}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-all"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Scan QR Code to Connect</span>
                </button>
                <button
                  onClick={onOpenOBSModal}
                  className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2.5 text-xs font-semibold text-slate-200 border border-white/10 transition-all backdrop-blur-md"
                >
                  <Tv className="h-4 w-4 text-indigo-400" />
                  <span>Get OBS Links</span>
                </button>
              </div>
            </div>
          ) : (
            /* Video Multiviewer Grid */
            <div
              className={`grid gap-4 w-full h-full min-h-[400px] ${
                activeLayout === 'solo'
                  ? 'grid-cols-1'
                  : activePeersList.length === 1
                  ? 'grid-cols-1'
                  : activePeersList.length === 2
                  ? 'grid-cols-2'
                  : 'grid-cols-2 md:grid-cols-2'
              }`}
            >
              {activePeersList.map((peer) => {
                const stream = remoteStreams.get(peer.id);
                const isSelected = peer.id === selectedPeerId;
                const isSoloProgram = activeSoloPeerId === peer.id;

                return (
                  <div
                    key={peer.id}
                    onClick={() => setSelectedPeerId(peer.id)}
                    className={`relative group overflow-hidden rounded-3xl border bg-black/40 backdrop-blur-xl transition-all cursor-pointer shadow-2xl ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-blue-500/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Live Stream Video Element */}
                    {stream ? (
                      <video
                        ref={(node) => {
                          if (node) {
                            if (node.srcObject !== stream) {
                              node.srcObject = stream;
                            }
                            node.play().catch((err) => console.warn('Video play policy catch:', err));
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full object-cover bg-black/60"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-500 text-xs font-mono">
                        Connecting WebRTC stream...
                      </div>
                    )}

                    {/* Top Overlay Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 z-10 flex-wrap">
                      <span className="flex items-center gap-1.5 rounded-xl bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/10">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        {peer.deviceName}
                      </span>
                      {peer.settings?.resolution === '4k' && (
                        <span className="rounded-xl bg-amber-500/90 border border-amber-300 backdrop-blur-md px-2.5 py-1 text-[10px] font-extrabold text-slate-950 uppercase tracking-wider shadow-lg shadow-amber-500/30 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-950 animate-ping" />
                          4K ULTRA HD
                        </span>
                      )}
                      {isSoloProgram && (
                        <span className="rounded-xl bg-red-600/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider shadow-lg">
                          PROGRAM OUTPUT
                        </span>
                      )}
                    </div>

                    {/* Stats HUD Banner overlay */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-2xl bg-black/60 backdrop-blur-md p-2.5 text-[11px] font-mono text-slate-300 border border-white/10 opacity-90 group-hover:opacity-100 transition-opacity z-10">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 font-bold">
                          {peer.stats?.bitrateKbps || 2400} kbps
                        </span>
                        <span className="text-slate-400">{peer.stats?.fps || 30} FPS</span>
                        <span className="text-slate-400">{peer.stats?.resolution || '1080p'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onLayoutChange('solo', peer.id);
                          }}
                          className="rounded-lg bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-[10px] font-bold text-white transition-all shadow-md"
                          title="Switch Program output to this camera"
                        >
                          SOLO TO OBS
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Remote Control Panel & Telemetry (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col border-l border-white/10 bg-black/10 backdrop-blur-md p-5 overflow-y-auto space-y-4">
          {/* Selected Device Title */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-400" />
              <span className="font-bold text-sm text-white">Remote Camera Controls</span>
            </div>
            {selectedPeer && (
              <span className="text-xs text-slate-400 font-mono truncate max-w-[120px]">
                {selectedPeer.deviceName}
              </span>
            )}
          </div>

          {selectedPeer ? (
            <>
              {/* Hardware Quick Action Controls */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Torch / Flashlight Toggle */}
                <button
                  onClick={() =>
                    onSendRemoteCommand(selectedPeer.id, 'toggle_torch', {
                      enabled: !selectedPeer.settings?.torch,
                    })
                  }
                  className={`flex items-center justify-center gap-2 rounded-2xl p-3 border font-semibold transition-all backdrop-blur-md ${
                    selectedPeer.settings?.torch
                      ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 shadow-lg shadow-amber-500/10'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span>Flashlight</span>
                </button>

                {/* Flip Camera (Front / Rear) */}
                <button
                  onClick={() =>
                    onSendRemoteCommand(selectedPeer.id, 'switch_facing', {
                      facingMode: selectedPeer.settings?.cameraFacing === 'user' ? 'environment' : 'user',
                    })
                  }
                  className="flex items-center justify-center gap-2 rounded-2xl p-3 border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 font-semibold transition-all backdrop-blur-md"
                >
                  <RotateCw className="h-4 w-4 text-blue-400" />
                  <span>Flip Camera</span>
                </button>

                {/* Mute Video */}
                <button
                  onClick={() =>
                    onSendRemoteCommand(selectedPeer.id, 'mute_video', {
                      muted: !selectedPeer.settings?.videoMuted,
                    })
                  }
                  className={`flex items-center justify-center gap-2 rounded-2xl p-3 border font-semibold transition-all backdrop-blur-md ${
                    selectedPeer.settings?.videoMuted
                      ? 'border-red-500/50 bg-red-500/20 text-red-300'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Camera className="h-4 w-4 text-indigo-400" />
                  <span>{selectedPeer.settings?.videoMuted ? 'Unmute Video' : 'Mute Video'}</span>
                </button>

                {/* Mute Audio */}
                <button
                  onClick={() =>
                    onSendRemoteCommand(selectedPeer.id, 'mute_audio', {
                      muted: !selectedPeer.settings?.audioMuted,
                    })
                  }
                  className={`flex items-center justify-center gap-2 rounded-2xl p-3 border font-semibold transition-all backdrop-blur-md ${
                    selectedPeer.settings?.audioMuted
                      ? 'border-red-500/50 bg-red-500/20 text-red-300'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {selectedPeer.settings?.audioMuted ? (
                    <VolumeX className="h-4 w-4 text-red-400" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                  )}
                  <span>{selectedPeer.settings?.audioMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                </button>
              </div>

              {/* Optical Zoom Slider */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-200 mb-2">
                    <span>Camera Optical Zoom</span>
                    <span className="font-mono text-blue-400">{selectedPeer.settings?.zoom || 1.0}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={selectedPeer.settings?.zoom || 1}
                    onChange={(e) =>
                      onSendRemoteCommand(selectedPeer.id, 'set_zoom', {
                        zoom: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                {/* Exposure Compensation EV Slider */}
                <div className="pt-2 border-t border-white/10">
                  <div className="flex justify-between text-xs font-semibold text-slate-200 mb-2">
                    <span className="flex items-center gap-1">
                      <Sun className="h-3.5 w-3.5 text-amber-400" /> Exposure (EV)
                    </span>
                    <span className="font-mono text-amber-400">
                      {(selectedPeer.settings?.exposureCompensation ?? 0) > 0 ? '+' : ''}
                      {selectedPeer.settings?.exposureCompensation ?? 0} EV
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.5"
                    value={selectedPeer.settings?.exposureCompensation ?? 0}
                    onChange={(e) =>
                      onSendRemoteCommand(selectedPeer.id, 'set_exposure', {
                        exposureCompensation: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Focus Mode & Distance */}
                <div className="pt-2 border-t border-white/10 text-xs">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-slate-200 flex items-center gap-1">
                      <Target className="h-3.5 w-3.5 text-indigo-400" /> Lens Focus
                    </span>
                    <select
                      value={selectedPeer.settings?.focusMode || 'auto'}
                      onChange={(e) =>
                        onSendRemoteCommand(selectedPeer.id, 'set_focus', {
                          focusMode: e.target.value as any,
                        })
                      }
                      className="rounded-lg bg-black/40 border border-white/10 px-2 py-1 text-slate-200 text-[11px] focus:border-blue-500"
                    >
                      <option value="auto">Auto Focus</option>
                      <option value="continuous">Continuous</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>

                  {selectedPeer.settings?.focusMode === 'manual' && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                        <span>Focus Distance</span>
                        <span className="font-mono text-indigo-400">{selectedPeer.settings?.focusDistance ?? 5}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={selectedPeer.settings?.focusDistance ?? 5}
                        onChange={(e) =>
                          onSendRemoteCommand(selectedPeer.id, 'set_focus', {
                            focusMode: 'manual',
                            focusDistance: parseInt(e.target.value),
                          })
                        }
                        className="w-full accent-indigo-500 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Camera Presets Panel */}
              <CameraPresetsPanel
                roomId={roomId}
                socket={socket}
                selectedPeer={selectedPeer}
                activePeers={activePeersList}
                onSendRemoteCommand={onSendRemoteCommand}
              />

              {/* Resolution & Bitrate Controls */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Target Resolution</label>
                    <button
                      onClick={() =>
                        onSendRemoteCommand(selectedPeer.id, 'set_resolution', {
                          resolution: '4k',
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border flex items-center gap-1 ${
                        selectedPeer.settings?.resolution === '4k'
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      }`}
                    >
                      <span>⚡ 4K Ultra HD</span>
                    </button>
                  </div>
                  <select
                    value={selectedPeer.settings?.resolution || '1080p'}
                    onChange={(e) =>
                      onSendRemoteCommand(selectedPeer.id, 'set_resolution', {
                        resolution: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-black/40 border border-white/10 p-2.5 text-slate-200 focus:border-blue-500 focus:outline-none backdrop-blur-md"
                  >
                    <option value="4k">4K Ultra HD (3840x2160)</option>
                    <option value="1080p">1080p Full HD (1920x1080)</option>
                    <option value="1440p">1440p Quad HD (2560x1440)</option>
                    <option value="720p">720p HD (1280x720)</option>
                    <option value="portrait_1080p">Portrait 9:16 (1080x1920)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1 font-semibold">
                    <span>Target Max Bitrate</span>
                    <span className="font-mono text-blue-400">
                      {selectedPeer.settings?.bitrateKbps || 4000} kbps
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="10000"
                    step="500"
                    value={selectedPeer.settings?.bitrateKbps || 4000}
                    onChange={(e) =>
                      onSendRemoteCommand(selectedPeer.id, 'set_bitrate', {
                        bitrateKbps: parseInt(e.target.value),
                      })
                    }
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Telemetry Gauge Cards */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200 border-b border-white/10 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-400" /> Live Stream Telemetry
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    WebRTC Peer
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
                  <div className="rounded-xl bg-black/30 p-2.5 border border-white/10">
                    <span className="text-[10px] text-slate-400 block">Bitrate</span>
                    <span className="font-bold text-blue-400 text-sm">
                      {selectedPeer.stats?.bitrateKbps || 2800}
                    </span>
                    <span className="text-[9px] text-slate-400">kbps</span>
                  </div>

                  <div className="rounded-xl bg-black/30 p-2.5 border border-white/10">
                    <span className="text-[10px] text-slate-400 block">FPS</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      {selectedPeer.stats?.fps || 30}
                    </span>
                    <span className="text-[9px] text-slate-400">fps</span>
                  </div>

                  <div className="rounded-xl bg-black/30 p-2.5 border border-white/10">
                    <span className="text-[10px] text-slate-400 block">Latency</span>
                    <span className="font-bold text-indigo-400 text-sm">
                      {selectedPeer.stats?.latencyMs || 24}
                    </span>
                    <span className="text-[9px] text-slate-400">ms</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-white/5 p-6 text-center text-xs text-slate-400 border border-white/10 backdrop-blur-md">
              Select a connected camera from the multiview canvas to adjust remote settings.
            </div>
          )}

          {/* Realtime Chat Section */}
          <div className="flex-1 flex flex-col rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md overflow-hidden min-h-[180px]">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200 border-b border-white/10 pb-2 mb-2">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-blue-400" /> Studio Chat
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{chatMessages.length} Messages</span>
            </div>

            {/* Message log */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {chatMessages.length > 0 ? (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="rounded-xl bg-black/30 p-2.5 border border-white/10">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5 font-mono">
                      <strong className="text-blue-300">{msg.senderName}</strong>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-slate-200 text-xs">{msg.message}</p>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 text-[11px] pt-8">
                  No studio messages yet. Send a note to connected devices.
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="mt-2 flex gap-1.5">
              <input
                type="text"
                placeholder="Type studio message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none backdrop-blur-md"
              />
              <button
                type="submit"
                className="rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-2 text-xs font-semibold text-white shrink-0 shadow-md transition-all active:scale-95"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
