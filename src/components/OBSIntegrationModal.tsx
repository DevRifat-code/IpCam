import React, { useState } from 'react';
import { Monitor, X, Copy, Check, ExternalLink, Sliders, Layers, Sparkles, Volume2 } from 'lucide-react';
import { OBSOverlayConfig } from '../types';

interface OBSIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const OBSIntegrationModal: React.FC<OBSIntegrationModalProps> = ({ isOpen, onClose, roomId }) => {
  const [copiedBrowser, setCopiedBrowser] = useState(false);
  const [copiedDock, setCopiedDock] = useState(false);

  const [config, setConfig] = useState<OBSOverlayConfig>({
    showNameplate: true,
    nameplateText: 'Mobile Cam 1',
    transparentBg: true,
    chromaKey: 'none',
    aspectRatio: '16:9',
    audioDelayMs: 0,
    customCSS: '',
  });

  if (!isOpen) return null;

  const obsSourceUrl = `${window.location.origin}/room/${roomId}?role=obs_source&transparent=${config.transparentBg}&chroma=${config.chromaKey}&name=${encodeURIComponent(config.nameplateText)}&showName=${config.showNameplate}`;
  const obsDockUrl = `${window.location.origin}/room/${roomId}?role=obs_dock`;

  const copyBrowserUrl = () => {
    navigator.clipboard.writeText(obsSourceUrl);
    setCopiedBrowser(true);
    setTimeout(() => setCopiedBrowser(false), 2000);
  };

  const copyDockUrl = () => {
    navigator.clipboard.writeText(obsDockUrl);
    setCopiedDock(true);
    setTimeout(() => setCopiedDock(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-black/30 p-6 text-slate-100 shadow-2xl backdrop-blur-xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors border border-transparent hover:border-white/10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 border border-white/10 shadow-lg">
            <Monitor className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">OBS Studio & vMix Integration</h3>
            <p className="text-xs text-slate-400">Zero-latency Browser Source & Custom Control Dock</p>
          </div>
        </div>

        {/* Browser Source Link Section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">1. OBS Browser Source URL</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              1080p / 60FPS Ready
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 bg-black/40 p-2.5 rounded-xl border border-white/10 my-2 backdrop-blur-md">
            <input
              type="text"
              readOnly
              value={obsSourceUrl}
              className="w-full bg-transparent text-xs font-mono text-blue-300 focus:outline-none truncate"
            />
            <button
              onClick={copyBrowserUrl}
              className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors shrink-0 shadow-md active:scale-95"
            >
              {copiedBrowser ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedBrowser ? 'Copied' : 'Copy'}</span>
            </button>
            <a
              href={obsSourceUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 border border-white/10 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Quick Customization Toggles */}
          <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-semibold">Chroma Key Background</label>
              <select
                value={config.chromaKey}
                onChange={(e) => setConfig({ ...config, chromaKey: e.target.value as any })}
                className="w-full rounded-xl bg-black/40 border border-white/10 p-2.5 text-slate-200 focus:border-blue-500 focus:outline-none backdrop-blur-md"
              >
                <option value="none">None (Transparent)</option>
                <option value="green">Green Screen (#00FF00)</option>
                <option value="blue">Blue Screen (#0000FF)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-semibold">Lower Third Nameplate</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={config.nameplateText}
                  onChange={(e) => setConfig({ ...config, nameplateText: e.target.value })}
                  placeholder="Cam Label"
                  className="w-full rounded-xl bg-black/40 border border-white/10 p-2.5 text-slate-200 focus:border-blue-500 focus:outline-none backdrop-blur-md"
                />
                <button
                  onClick={() => setConfig({ ...config, showNameplate: !config.showNameplate })}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                    config.showNameplate
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm'
                      : 'bg-black/30 border-white/10 text-slate-500'
                  }`}
                >
                  {config.showNameplate ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* OBS Custom Dock Link Section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-semibold text-white">2. OBS Custom Browser Dock URL</span>
            </div>
            <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
              Interactive Dock
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-2 leading-relaxed">
            Add this dock into OBS Studio (<code className="text-purple-300">Docks → Custom Browser Docks...</code>) to control remote phone camera torch, switcher, and audio meters directly inside OBS!
          </p>

          <div className="flex items-center justify-between gap-2 bg-black/40 p-2.5 rounded-xl border border-white/10 backdrop-blur-md">
            <input
              type="text"
              readOnly
              value={obsDockUrl}
              className="w-full bg-transparent text-xs font-mono text-purple-300 focus:outline-none truncate"
            />
            <button
              onClick={copyDockUrl}
              className="flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors shrink-0 shadow-md active:scale-95"
            >
              {copiedDock ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedDock ? 'Copied' : 'Copy'}</span>
            </button>
            <a
              href={obsDockUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 border border-white/10 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-2xl bg-black/30 p-4 border border-white/10 text-xs space-y-2 text-slate-300 backdrop-blur-md">
          <h4 className="font-bold text-white flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" /> Setup Guide for OBS Studio:
          </h4>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400 leading-relaxed">
            <li>In OBS, click <strong className="text-slate-200">+ Sources → Browser</strong></li>
            <li>Paste the <strong className="text-blue-400">Browser Source URL</strong> copied above</li>
            <li>Set Width: <strong className="text-slate-200">1920</strong> and Height: <strong className="text-slate-200">1080</strong> (or 1080x1920 for vertical)</li>
            <li>Check <strong className="text-slate-200">Control audio via OBS</strong> if using phone mic in OBS</li>
            <li>To add Dock: Go to <strong className="text-purple-300">Docks → Custom Browser Docks</strong>, type name "StreamLink", and paste Dock URL</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
