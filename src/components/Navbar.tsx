import React from 'react';
import { Camera, QrCode, Monitor, Sparkles, MessageSquare, ShieldCheck, Cpu, Sliders, Smartphone, Copy } from 'lucide-react';
import { AppMode } from '../types';

interface NavbarProps {
  roomId: string;
  role: AppMode;
  activePeersCount: number;
  onOpenQRPair: () => void;
  onOpenOBSModal: () => void;
  onOpenAIModal: () => void;
  onToggleChat?: () => void;
  showChatBadge?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomId,
  role,
  activePeersCount,
  onOpenQRPair,
  onOpenOBSModal,
  onOpenAIModal,
  onToggleChat,
  showChatBadge,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copyRoomLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/20 backdrop-blur-md px-6 py-3 text-slate-100 shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Brand Logo & Room ID */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
            <Camera className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300 text-lg">StreamLink</span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-blue-300 border border-white/10">
                PRO
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Room: <strong className="text-slate-200">{roomId}</strong></span>
              <button
                onClick={copyRoomLink}
                className="hover:text-blue-400 transition-colors p-0.5"
                title="Copy Room Link"
              >
                <Copy className="h-3 w-3 inline" />
              </button>
              {copied && <span className="text-emerald-400 font-medium">Copied!</span>}
            </div>
          </div>
        </div>

        {/* Center Role Badge */}
        <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-3.5 py-1.5 text-xs text-slate-300 shadow-inner">
          {role === 'director' && (
            <>
              <Sliders className="h-3.5 w-3.5 text-blue-400" />
              <span className="font-medium">Director Studio</span>
            </>
          )}
          {role === 'camera_sender' && (
            <>
              <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-medium">Mobile Camera Mode</span>
            </>
          )}
          {role === 'obs_source' && (
            <>
              <Monitor className="h-3.5 w-3.5 text-indigo-400" />
              <span className="font-medium">OBS Browser Source</span>
            </>
          )}
          {role === 'obs_dock' && (
            <>
              <Cpu className="h-3.5 w-3.5 text-purple-400" />
              <span className="font-medium">OBS Custom Dock</span>
            </>
          )}
          {role === 'guest' && (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-medium">Remote Guest</span>
            </>
          )}
          <span className="h-3 w-[1px] bg-white/15" />
          <span className="text-slate-400 font-mono">{activePeersCount} {activePeersCount === 1 ? 'Peer' : 'Peers'} Active</span>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2">
          {/* Pair Phone Button */}
          <button
            onClick={onOpenQRPair}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-semibold text-white transition-all border border-white/10 shadow-sm backdrop-blur-md active:scale-95"
          >
            <QrCode className="h-4 w-4 text-blue-400" />
            <span className="hidden sm:inline">Connect Phone</span>
          </button>

          {/* OBS Link Setup */}
          <button
            onClick={onOpenOBSModal}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-semibold text-white transition-all border border-white/10 shadow-sm backdrop-blur-md active:scale-95"
          >
            <Monitor className="h-4 w-4 text-indigo-400" />
            <span className="hidden sm:inline">OBS Integration</span>
          </button>

          {/* AI Director Advisor */}
          <button
            onClick={onOpenAIModal}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition-all active:scale-95 border border-white/10"
          >
            <Sparkles className="h-4 w-4 text-blue-200" />
            <span className="hidden sm:inline">AI Director</span>
          </button>

          {/* Toggle Chat */}
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              className="relative p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors border border-white/10 backdrop-blur-md"
              title="Studio Chat"
            >
              <MessageSquare className="h-4 w-4" />
              {showChatBadge && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-400 animate-ping" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
