import React, { useEffect, useRef } from 'react';

interface OBSBrowserSourceViewProps {
  roomId: string;
  remoteStream?: MediaStream | null;
  transparentBg?: boolean;
  chromaKey?: 'none' | 'green' | 'blue';
  nameplateText?: string;
  showNameplate?: boolean;
}

export const OBSBrowserSourceView: React.FC<OBSBrowserSourceViewProps> = ({
  remoteStream,
  transparentBg = true,
  chromaKey = 'none',
  nameplateText = 'Mobile Cam',
  showNameplate = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  let bgColor = 'bg-transparent';
  if (chromaKey === 'green') bgColor = 'bg-[#00FF00]';
  if (chromaKey === 'blue') bgColor = 'bg-[#0000FF]';

  return (
    <div className={`relative h-screen w-screen overflow-hidden ${bgColor}`}>
      {remoteStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-400 font-mono text-sm">
          [StreamLink OBS Source: Waiting for video feed in room...]
        </div>
      )}

      {/* Lower Third Nameplate Overlay */}
      {showNameplate && nameplateText && (
        <div className="absolute bottom-8 left-8 z-10 flex items-center gap-3 rounded-xl bg-slate-950/90 px-5 py-2.5 backdrop-blur-md border border-cyan-500/30 shadow-2xl animate-fade-in">
          <span className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-sm font-bold tracking-wide text-white font-sans">{nameplateText}</span>
        </div>
      )}
    </div>
  );
};
