import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, X, Copy, Check, ExternalLink, Zap, Shield, Camera } from 'lucide-react';

interface QRPairModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const QRPairModal: React.FC<QRPairModalProps> = ({ isOpen, onClose, roomId }) => {
  const [qrCanvas, setQrCanvas] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<'1080p' | '4k' | 'portrait_1080p'>('1080p');

  const cameraUrl = `${window.location.origin}/room/${roomId}?role=camera_sender&res=${selectedResolution}`;

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(cameraUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCanvas(url))
        .catch((err) => console.error('[QR Code] Generation error:', err));
    }
  }, [isOpen, cameraUrl]);

  if (!isOpen) return null;

  const copyUrl = () => {
    navigator.clipboard.writeText(cameraUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-black/30 p-6 text-slate-100 shadow-2xl backdrop-blur-xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors border border-transparent hover:border-white/10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400 border border-white/10 shadow-lg">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Connect Phone as PC Camera</h3>
            <p className="text-xs text-slate-400">Scan QR Code with your smartphone camera</p>
          </div>
        </div>

        {/* Resolution Preset Picker */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-400 block mb-1.5">Target Preset:</label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: '1080p', label: '1080p HD' },
                { id: '4k', label: '4K Ultra' },
                { id: 'portrait_1080p', label: '9:16 Vertical' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                onClick={() => setSelectedResolution(preset.id)}
                className={`rounded-xl px-2.5 py-2 text-xs font-semibold border backdrop-blur-md transition-all ${
                  selectedResolution === preset.id
                    ? 'border-blue-500 bg-blue-600/30 text-white shadow-md'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white p-4 my-2 shadow-2xl">
          {qrCanvas ? (
            <img src={qrCanvas} alt="Phone Camera Pair QR Code" className="h-56 w-56 object-contain" />
          ) : (
            <div className="h-56 w-56 flex items-center justify-center text-slate-500 text-xs">
              Generating QR Code...
            </div>
          )}
          <span className="mt-2 text-[11px] font-mono text-slate-600">Scan to launch mobile camera interface</span>
        </div>

        {/* Features Checklist */}
        <div className="my-4 space-y-1.5 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Ultra Low Latency WebRTC Direct Peer Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <Camera className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span>Full Remote Control of Torch, Zoom, Exposure & Lenses</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>No App Download Required — Works in iOS Safari & Android Chrome</span>
          </div>
        </div>

        {/* Direct Link Copy */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-black/40 p-2.5 border border-white/10 backdrop-blur-md">
            <input
              type="text"
              readOnly
              value={cameraUrl}
              className="w-full bg-transparent text-xs font-mono text-slate-300 focus:outline-none truncate"
            />
            <button
              onClick={copyUrl}
              className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors shrink-0 shadow-md active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy URL</span>
                </>
              )}
            </button>
            <a
              href={cameraUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 border border-white/10 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
