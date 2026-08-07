import React from 'react';
import { ConnectedPeer } from '../types';
import { Zap, RotateCw, Volume2, VolumeX, Grid, Maximize2, Tv, Smartphone, Radio } from 'lucide-react';

interface OBSDockViewProps {
  roomId: string;
  peers: ConnectedPeer[];
  onSendRemoteCommand: (targetSocketId: string, command: string, payload?: any) => void;
  onLayoutChange: (layout: string, activeSoloPeerId?: string) => void;
  activeLayout: string;
  activeSoloPeerId?: string;
}

export const OBSDockView: React.FC<OBSDockViewProps> = ({
  roomId,
  peers,
  onSendRemoteCommand,
  onLayoutChange,
  activeLayout,
  activeSoloPeerId,
}) => {
  const cameraPeers = peers.filter((p) => p.role === 'camera_sender' || p.role === 'guest');

  return (
    <div className="flex h-screen w-full flex-col bg-slate-950 p-3 text-slate-100 select-none overflow-y-auto font-sans text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-white text-xs">StreamLink Dock</span>
        </div>
        <span className="font-mono text-[10px] text-cyan-400">Room: {roomId}</span>
      </div>

      {/* Quick Layout Switchers */}
      <div className="mb-3">
        <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">OBS Scene Layout</span>
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'grid', label: 'Grid', icon: Grid },
            { id: 'solo', label: 'Solo', icon: Maximize2 },
            { id: 'pip', label: 'PiP', icon: Tv },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onLayoutChange(item.id)}
                className={`flex items-center justify-center gap-1 rounded p-2 text-[11px] font-semibold border transition-all ${
                  activeLayout === item.id
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Connected Mobile Cameras List */}
      <div className="space-y-2">
        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Connected Cameras ({cameraPeers.length})</span>
        {cameraPeers.length > 0 ? (
          cameraPeers.map((peer) => {
            const isSolo = activeSoloPeerId === peer.id;
            return (
              <div
                key={peer.id}
                className="rounded-lg border border-slate-800 bg-slate-900 p-2 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-1">
                    <Smartphone className="h-3.5 w-3.5 text-cyan-400" /> {peer.deviceName}
                  </span>
                  <button
                    onClick={() => onLayoutChange('solo', peer.id)}
                    className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                      isSolo ? 'bg-red-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {isSolo ? 'SOLO ACTIVE' : 'SET SOLO'}
                  </button>
                </div>

                {/* Quick Hardware Controls */}
                <div className="grid grid-cols-3 gap-1 pt-1">
                  <button
                    onClick={() =>
                      onSendRemoteCommand(peer.id, 'toggle_torch', { enabled: !peer.settings?.torch })
                    }
                    className="flex items-center justify-center gap-1 rounded bg-slate-950 p-1.5 border border-slate-800 text-[10px] text-amber-300 hover:bg-slate-800"
                  >
                    <Zap className="h-3 w-3 text-amber-400" />
                    <span>Torch</span>
                  </button>

                  <button
                    onClick={() =>
                      onSendRemoteCommand(peer.id, 'switch_facing', {
                        facingMode: peer.settings?.cameraFacing === 'user' ? 'environment' : 'user',
                      })
                    }
                    className="flex items-center justify-center gap-1 rounded bg-slate-950 p-1.5 border border-slate-800 text-[10px] text-cyan-300 hover:bg-slate-800"
                  >
                    <RotateCw className="h-3 w-3 text-cyan-400" />
                    <span>Flip</span>
                  </button>

                  <button
                    onClick={() =>
                      onSendRemoteCommand(peer.id, 'mute_audio', {
                        muted: !peer.settings?.audioMuted,
                      })
                    }
                    className="flex items-center justify-center gap-1 rounded bg-slate-950 p-1.5 border border-slate-800 text-[10px] text-emerald-300 hover:bg-slate-800"
                  >
                    {peer.settings?.audioMuted ? (
                      <VolumeX className="h-3 w-3 text-red-400" />
                    ) : (
                      <Volume2 className="h-3 w-3 text-emerald-400" />
                    )}
                    <span>Mic</span>
                  </button>
                </div>

                {/* Quick Preset Buttons */}
                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/60">
                  <button
                    onClick={() =>
                      onSendRemoteCommand(peer.id, 'apply_preset', {
                        preset: { name: 'Wide', zoom: 1.0, exposureCompensation: 0, focusMode: 'auto' },
                      })
                    }
                    className="rounded bg-indigo-950/40 border border-indigo-500/20 py-1 text-[9px] font-semibold text-indigo-300 hover:bg-indigo-900/40"
                  >
                    1.0x Wide
                  </button>

                  <button
                    onClick={() =>
                      onSendRemoteCommand(peer.id, 'apply_preset', {
                        preset: { name: 'Portrait', zoom: 2.5, exposureCompensation: 0.5, focusMode: 'continuous' },
                      })
                    }
                    className="rounded bg-indigo-950/40 border border-indigo-500/20 py-1 text-[9px] font-semibold text-indigo-300 hover:bg-indigo-900/40"
                  >
                    2.5x Close
                  </button>

                  <button
                    onClick={() =>
                      onSendRemoteCommand(peer.id, 'apply_preset', {
                        preset: { name: 'Night', zoom: 1.0, exposureCompensation: 1.5, torch: true },
                      })
                    }
                    className="rounded bg-indigo-950/40 border border-indigo-500/20 py-1 text-[9px] font-semibold text-indigo-300 hover:bg-indigo-900/40"
                  >
                    Night Boost
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg bg-slate-900/50 p-4 text-center text-slate-500 text-[11px] border border-slate-800">
            No phone cameras connected to dock yet.
          </div>
        )}
      </div>
    </div>
  );
};
