import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, Send, Radio } from 'lucide-react';
import { getCameraStream } from '../lib/webrtc';

interface RemoteGuestViewProps {
  roomId: string;
  onStreamCreated: (stream: MediaStream) => void;
  chatMessages: { id: string; senderName: string; message: string; timestamp: number }[];
  onSendChat: (msg: string) => void;
}

export const RemoteGuestView: React.FC<RemoteGuestViewProps> = ({
  roomId,
  onStreamCreated,
  chatMessages,
  onSendChat,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);
  const [guestName, setGuestName] = useState('Guest Speaker');
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    getCameraStream({ facingMode: 'user', resolution: '1080p' }).then((s) => {
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      onStreamCreated(s);
    });
  }, []);

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = micMuted));
      setMicMuted(!micMuted);
    }
  };

  const toggleCam = () => {
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = camMuted));
      setCamMuted(!camMuted);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 p-4">
      <div className="mx-auto flex w-full max-w-4xl flex-col h-full gap-4">
        {/* Top Header */}
        <div className="flex items-center justify-between rounded-xl bg-slate-900 p-4 border border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">StreamLink Guest Studio</h2>
            <p className="text-xs text-slate-400">You are live as a guest speaker in Room: <strong className="text-cyan-400">{roomId}</strong></p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400">Connected</span>
          </div>
        </div>

        {/* Video Preview & Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-hidden">
          <div className="md:col-span-2 relative flex flex-col items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {/* Control bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-slate-950/80 px-4 py-2 border border-slate-800 backdrop-blur-md">
              <button
                onClick={toggleMic}
                className={`p-2.5 rounded-full ${micMuted ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200'}`}
              >
                {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={toggleCam}
                className={`p-2.5 rounded-full ${camMuted ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200'}`}
              >
                {camMuted ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Guest Chat */}
          <div className="flex flex-col rounded-2xl bg-slate-900 border border-slate-800 p-3 overflow-hidden">
            <h3 className="font-bold text-xs text-slate-300 mb-2 pb-2 border-b border-slate-800">
              Studio Guest Chat
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 text-xs">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                  <span className="text-[10px] text-cyan-400 font-bold block">{msg.senderName}</span>
                  <p className="text-slate-300">{msg.message}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} className="mt-2 flex gap-1">
              <input
                type="text"
                placeholder="Message director..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
              />
              <button type="submit" className="rounded-lg bg-cyan-500 text-slate-950 px-3 font-bold text-xs">
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
