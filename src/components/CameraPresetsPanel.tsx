import React, { useState, useEffect } from 'react';
import {
  Camera,
  Sliders,
  Sparkles,
  Zap,
  Sun,
  Target,
  Plus,
  Trash2,
  Radio,
  Check,
  Bookmark,
  Video,
  Maximize2,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  Layers,
} from 'lucide-react';
import { CameraPreset, ConnectedPeer, ResolutionPreset } from '../types';

export const DEFAULT_CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'preset_wide',
    name: 'Wide Studio',
    description: '4K Ultra HD • 1.0x Zoom • 0 EV • Auto Focus',
    zoom: 1.0,
    exposureCompensation: 0.0,
    focusMode: 'auto',
    resolution: '4k',
    torch: false,
  },
  {
    id: 'preset_portrait',
    name: 'Portrait Talent',
    description: '1080p Full HD • 2.5x Zoom • +0.5 EV • Continuous Focus',
    zoom: 2.5,
    exposureCompensation: 0.5,
    focusMode: 'continuous',
    resolution: '1080p',
    torch: false,
  },
  {
    id: 'preset_cinematic',
    name: 'Cinematic Mood',
    description: '4K Ultra HD • 1.8x Zoom • -0.5 EV • Manual Focus',
    zoom: 1.8,
    exposureCompensation: -0.5,
    focusMode: 'manual',
    focusDistance: 6,
    resolution: '4k',
    torch: false,
  },
  {
    id: 'preset_lowlight',
    name: 'Night / Low Light',
    description: '1080p Full HD • 1.0x Zoom • +1.5 EV • Torch ON',
    zoom: 1.0,
    exposureCompensation: 1.5,
    focusMode: 'auto',
    resolution: '1080p',
    torch: true,
  },
  {
    id: 'preset_product',
    name: 'Product Macro',
    description: '1440p Quad HD • 3.5x Zoom • +0.2 EV • Close Focus',
    zoom: 3.5,
    exposureCompensation: 0.2,
    focusMode: 'manual',
    focusDistance: 2,
    resolution: '1440p',
    torch: false,
  },
];

interface CameraPresetsPanelProps {
  roomId?: string;
  socket?: any;
  selectedPeer?: ConnectedPeer;
  activePeers: ConnectedPeer[];
  onSendRemoteCommand: (targetSocketId: string, command: string, payload?: any) => void;
}

export const CameraPresetsPanel: React.FC<CameraPresetsPanelProps> = ({
  roomId,
  socket,
  selectedPeer,
  activePeers,
  onSendRemoteCommand,
}) => {
  const [presets, setPresets] = useState<CameraPreset[]>(() => {
    try {
      const saved = localStorage.getItem('streamlink_camera_presets');
      if (saved) {
        const custom = JSON.parse(saved);
        return [...DEFAULT_CAMERA_PRESETS, ...custom];
      }
    } catch (e) {
      console.warn('Failed to load presets from localStorage', e);
    }
    return DEFAULT_CAMERA_PRESETS;
  });

  const [newPresetName, setNewPresetName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  // Form states for creating custom preset manually
  const [customResolution, setCustomResolution] = useState<ResolutionPreset>('4k');
  const [customZoom, setCustomZoom] = useState(1.5);
  const [customEV, setCustomEV] = useState(0.0);
  const [customFocus, setCustomFocus] = useState<'auto' | 'manual' | 'continuous'>('auto');
  const [customFocusDist, setCustomFocusDist] = useState(5);
  const [customTorch, setCustomTorch] = useState(false);

  // Fetch initial room presets from backend REST API
  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/rooms/${roomId}/presets`)
      .then((res) => res.json())
      .then((data) => {
        if (data.presets && Array.isArray(data.presets) && data.presets.length > 0) {
          setPresets(data.presets);
        }
      })
      .catch((err) => console.warn('Error fetching room presets:', err));
  }, [roomId]);

  // Real-time preset synchronization over Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handlePresetsUpdated = (data: { roomId?: string; presets?: CameraPreset[] }) => {
      if (data.presets && Array.isArray(data.presets)) {
        setPresets(data.presets);
      }
    };

    const handlePresetsSynced = (data: { presets?: CameraPreset[] }) => {
      if (data.presets && Array.isArray(data.presets)) {
        setPresets(data.presets);
      }
    };

    socket.on('camera-presets-updated', handlePresetsUpdated);
    socket.on('camera-presets-synced', handlePresetsSynced);

    return () => {
      socket.off('camera-presets-updated', handlePresetsUpdated);
      socket.off('camera-presets-synced', handlePresetsSynced);
    };
  }, [socket]);

  const triggerToast = (msg: string) => {
    setActiveToast(msg);
    setTimeout(() => setActiveToast(null), 2500);
  };

  const handleApplyPreset = (preset: CameraPreset, broadcastAll = false) => {
    if (broadcastAll) {
      activePeers.forEach((peer) => {
        onSendRemoteCommand(peer.id, 'apply_preset', { preset });
        if (socket && roomId) {
          socket.emit('apply-camera-preset', { roomId, targetSocketId: peer.id, preset });
        }
      });
      triggerToast(`Broadcast "${preset.name}" (${preset.resolution?.toUpperCase() || '1080P'}) to all ${activePeers.length} camera(s)`);
    } else if (selectedPeer) {
      onSendRemoteCommand(selectedPeer.id, 'apply_preset', { preset });
      if (socket && roomId) {
        socket.emit('apply-camera-preset', { roomId, targetSocketId: selectedPeer.id, preset });
      }
      triggerToast(`Applied "${preset.name}" (${preset.resolution?.toUpperCase() || '1080P'}) to ${selectedPeer.deviceName}`);
    }
  };

  const handleSaveCurrentAsPreset = () => {
    if (!selectedPeer) return;
    const settings = selectedPeer.settings || {};
    const name = newPresetName.trim() || `Look Preset ${presets.length + 1}`;
    const resName = settings.resolution ? settings.resolution.toUpperCase() : '1080P';

    const newPreset: CameraPreset = {
      id: `custom_${Date.now()}`,
      name,
      description: `${resName} • ${settings.zoom || 1.0}x Zoom • ${settings.exposureCompensation || 0} EV • ${settings.focusMode || 'auto'} focus`,
      resolution: (settings.resolution as ResolutionPreset) || '1080p',
      zoom: settings.zoom || 1.0,
      exposureCompensation: settings.exposureCompensation || 0.0,
      focusMode: (settings.focusMode as any) || 'auto',
      focusDistance: settings.focusDistance,
      torch: !!settings.torch,
      isCustom: true,
    };

    savePreset(newPreset);
  };

  const handleSaveCustomPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPresetName.trim() || `Custom Preset ${presets.length + 1}`;
    const resName = customResolution.toUpperCase();
    const newPreset: CameraPreset = {
      id: `custom_${Date.now()}`,
      name,
      description: `${resName} • ${customZoom}x Zoom • ${customEV > 0 ? '+' : ''}${customEV} EV • ${customFocus}`,
      resolution: customResolution,
      zoom: customZoom,
      exposureCompensation: customEV,
      focusMode: customFocus,
      focusDistance: customFocusDist,
      torch: customTorch,
      isCustom: true,
    };

    savePreset(newPreset);
  };

  const savePreset = (preset: CameraPreset) => {
    const updated = [...presets, preset];
    setPresets(updated);

    // Save custom ones to localStorage
    const customOnly = updated.filter((p) => p.isCustom);
    try {
      localStorage.setItem('streamlink_camera_presets', JSON.stringify(customOnly));
    } catch (e) {
      console.warn('Failed to save preset to localStorage', e);
    }

    // Emit Socket.IO event to sync with PostgreSQL / Room state on backend
    if (socket && roomId) {
      socket.emit('save-camera-preset', { roomId, preset });
    }

    setNewPresetName('');
    setShowAddModal(false);
    triggerToast(`Saved preset "${preset.name}"`);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);

    const customOnly = updated.filter((p) => p.isCustom);
    try {
      localStorage.setItem('streamlink_camera_presets', JSON.stringify(customOnly));
    } catch (err) {
      console.warn('Failed to save updated presets to localStorage', err);
    }

    // Emit Socket.IO event to delete from backend
    if (socket && roomId) {
      socket.emit('delete-camera-preset', { roomId, presetId: id });
    }

    triggerToast('Preset removed');
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur-xl space-y-3">
      {/* Toast Notification */}
      {activeToast && (
        <div className="fixed top-20 right-8 z-50 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xl shadow-blue-600/30 animate-fade-in border border-white/20 flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span>{activeToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-blue-400" />
          <span className="font-bold text-xs text-white">Camera Presets Panel</span>
        </div>
        <button
          onClick={() => setShowAddModal(!showAddModal)}
          className="flex items-center gap-1 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-2.5 py-1 text-[11px] font-semibold border border-blue-500/30 transition-all backdrop-blur-md"
        >
          <Plus className="h-3 w-3" />
          <span>Define Preset</span>
        </button>
      </div>

      {/* Save current camera state quick button if camera is selected */}
      {selectedPeer && !showAddModal && (
        <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
          <input
            type="text"
            placeholder="Preset name (e.g. 4K Talent Closeup)"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSaveCurrentAsPreset}
            className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition-all shadow-md active:scale-95 flex items-center gap-1"
          >
            <Bookmark className="h-3 w-3" />
            <span>Save Current</span>
          </button>
        </div>
      )}

      {/* Define Custom Preset Form Modal */}
      {showAddModal && (
        <form
          onSubmit={handleSaveCustomPreset}
          className="rounded-2xl border border-blue-500/30 bg-blue-950/30 p-3.5 text-xs space-y-3 backdrop-blur-md animate-fade-in shadow-xl"
        >
          <div className="flex items-center justify-between font-bold text-blue-300 border-b border-blue-500/20 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-blue-400" />
              Define New Camera Preset
            </span>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-slate-400 hover:text-white font-bold text-base"
            >
              ×
            </button>
          </div>

          <div>
            <label className="text-slate-300 block text-[10px] font-semibold mb-1">Preset Name</label>
            <input
              type="text"
              placeholder="e.g. 4K Stage Spot, Macro Closeup"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full rounded-xl bg-black/50 border border-white/15 p-2 text-slate-200 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-300 block text-[10px] font-semibold mb-1 flex items-center gap-1">
                <Layers className="h-3 w-3 text-amber-400" /> Target Resolution
              </label>
              <select
                value={customResolution}
                onChange={(e) => setCustomResolution(e.target.value as ResolutionPreset)}
                className="w-full rounded-xl bg-black/50 border border-white/15 p-2 text-amber-300 font-mono text-[11px] focus:outline-none focus:border-amber-400"
              >
                <option value="4k">⚡ 4K Ultra HD (2160p)</option>
                <option value="1080p">1080p Full HD</option>
                <option value="1440p">1440p Quad HD</option>
                <option value="720p">720p HD</option>
                <option value="portrait_1080p">Portrait 9:16 (1080p)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 block text-[10px] font-semibold mb-1 flex items-center gap-1">
                <Maximize2 className="h-3 w-3 text-purple-400" /> Zoom Level ({customZoom}x)
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.1"
                value={customZoom}
                onChange={(e) => setCustomZoom(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-300 block text-[10px] font-semibold mb-1 flex items-center gap-1">
                <Sun className="h-3 w-3 text-amber-400" /> Exposure ({customEV > 0 ? '+' : ''}{customEV} EV)
              </label>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.5"
                value={customEV}
                onChange={(e) => setCustomEV(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer mt-1"
              />
            </div>

            <div>
              <label className="text-slate-300 block text-[10px] font-semibold mb-1 flex items-center gap-1">
                <Target className="h-3 w-3 text-indigo-400" /> Focus Mode
              </label>
              <select
                value={customFocus}
                onChange={(e) => setCustomFocus(e.target.value as any)}
                className="w-full rounded-xl bg-black/50 border border-white/15 p-2 text-slate-200 text-[11px]"
              >
                <option value="auto">Auto Focus</option>
                <option value="continuous">Continuous</option>
                <option value="manual">Manual Focus</option>
              </select>
            </div>
          </div>

          {customFocus === 'manual' && (
            <div>
              <label className="text-slate-300 block text-[10px] font-semibold mb-1">
                Focus Distance ({customFocusDist})
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={customFocusDist}
                onChange={(e) => setCustomFocusDist(parseInt(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <label className="text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
              <input
                type="checkbox"
                checked={customTorch}
                onChange={(e) => setCustomTorch(e.target.checked)}
                className="rounded border-white/20 bg-black/40 accent-amber-400"
              />
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-amber-400" /> Torch Flashlight ON
              </span>
            </label>

            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-4 py-2 font-bold text-xs text-white shadow-lg transition-all active:scale-95"
            >
              Save Preset
            </button>
          </div>
        </form>
      )}

      {/* Preset Cards List */}
      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className="group relative rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-3 transition-all backdrop-blur-md flex items-center justify-between"
          >
            <div className="space-y-1 pr-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs text-white">{preset.name}</span>
                {preset.resolution === '4k' ? (
                  <span className="text-[9px] font-extrabold font-mono text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/40 shadow-sm flex items-center gap-0.5">
                    <span className="h-1 w-1 rounded-full bg-amber-400 animate-ping" /> 4K ULTRA HD
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/30">
                    {preset.resolution ? preset.resolution.toUpperCase() : '1080P'}
                  </span>
                )}
                {preset.torch && (
                  <span className="flex items-center gap-0.5 text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                    <Zap className="h-2.5 w-2.5" /> Torch
                  </span>
                )}
                {preset.isCustom && (
                  <span className="text-[9px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
                    Custom
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono leading-tight">{preset.description}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Apply to Selected Camera */}
              <button
                onClick={() => handleApplyPreset(preset, false)}
                disabled={!selectedPeer}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-md transition-all active:scale-95"
                title={selectedPeer ? `Apply to ${selectedPeer.deviceName}` : 'Select a camera first'}
              >
                Apply
              </button>

              {/* Broadcast to All Cameras */}
              <button
                onClick={() => handleApplyPreset(preset, true)}
                disabled={activePeers.length === 0}
                className="rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white disabled:opacity-30 px-2 py-1.5 text-[10px] font-bold border border-purple-500/30 transition-all active:scale-95"
                title="Broadcast look preset to ALL connected mobile cameras"
              >
                All
              </button>

              {/* Delete Custom Preset */}
              {preset.isCustom && (
                <button
                  onClick={(e) => handleDeletePreset(preset.id, e)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete custom preset"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

