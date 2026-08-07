import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppMode, ConnectedPeer, ChatMessage, DeviceSettings, PeerStats } from './types';
import { Navbar } from './components/Navbar';
import { QRPairModal } from './components/QRPairModal';
import { OBSIntegrationModal } from './components/OBSIntegrationModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { DirectorStudio } from './components/DirectorStudio';
import { MobileCameraSender } from './components/MobileCameraSender';
import { OBSBrowserSourceView } from './components/OBSBrowserSourceView';
import { OBSDockView } from './components/OBSDockView';
import { RemoteGuestView } from './components/RemoteGuestView';
import { ICE_SERVERS, collectPeerStats, setMaxBitrate } from './lib/webrtc';
import { Camera, Smartphone, Monitor, Cpu, Sparkles, Shield, ArrowRight, Video, Zap, CheckCircle2, Tv } from 'lucide-react';

export default function App() {
  // Parse URL search params & path
  const pathParts = window.location.pathname.split('/');
  const rawRoomId = pathParts[2] || '';
  const searchParams = new URLSearchParams(window.location.search);

  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const defaultRole: AppMode = isMobileDevice ? 'camera_sender' : 'director';
  const role: AppMode = (searchParams.get('role') as AppMode) || (rawRoomId ? defaultRole : 'director');

  const [roomId, setRoomId] = useState<string>(rawRoomId);
  const [inRoom, setInRoom] = useState<boolean>(!!rawRoomId);

  // Modals state
  const [isQROpen, setIsQROpen] = useState(false);
  const [isOBSOpen, setIsOBSOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);

  // Realtime state
  const socketRef = useRef<Socket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [peers, setPeers] = useState<ConnectedPeer[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeLayout, setActiveLayout] = useState<string>('grid');
  const [activeSoloPeerId, setActiveSoloPeerId] = useState<string | undefined>(undefined);
  const [remoteCommand, setRemoteCommand] = useState<{ command: string; payload?: any } | null>(null);

  // Local camera stream for camera_sender
  const localStreamRef = useRef<MediaStream | null>(null);

  // OBS parameters
  const transparentBg = searchParams.get('transparent') !== 'false';
  const chromaKey = (searchParams.get('chroma') as any) || 'none';
  const nameplateText = searchParams.get('name') || 'Mobile Cam';
  const showNameplate = searchParams.get('showName') !== 'false';

  // Home Screen Create Room State
  const [roomTitle, setRoomTitle] = useState('');
  const [joinRoomInput, setJoinRoomInput] = useState('');

  // Global listener to suppress unhandled WebSocket errors during dev/preview network blips
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonStr = event.reason ? String(event.reason) : '';
      const messageStr = event.reason?.message ? String(event.reason.message) : '';
      if (
        reasonStr.toLowerCase().includes('websocket') ||
        messageStr.toLowerCase().includes('websocket') ||
        reasonStr.toLowerCase().includes('closed without opened') ||
        messageStr.toLowerCase().includes('closed without opened')
      ) {
        console.warn('[App] Handled WebSocket connection rejection gracefully:', event.reason);
        event.preventDefault();
      }
    };

    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event.message ? String(event.message).toLowerCase() : '';
      if (msg.includes('websocket') || msg.includes('closed without opened')) {
        console.warn('[App] Caught global WebSocket connection error:', event.message);
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleGlobalError);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleGlobalError);
    };
  }, []);

  // Socket.IO Initialization with Exponential Backoff Retry Logic
  useEffect(() => {
    if (!inRoom || !roomId) return;

    let retryCount = 0;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;

    const socket = io(window.location.origin, {
      transports: ['polling', 'websocket'], // Starts with HTTP long-polling and upgrades to WebSocket cleanly
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000, // Initial 1s backoff delay
      reconnectionDelayMax: 10000, // Cap maximum delay at 10s
      randomizationFactor: 0.5, // Jitter to smooth reconnect spikes
      timeout: 20000,
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[App] Socket connected successfully: ${socket.id}`);
      retryCount = 0; // Reset retry counter on successful connection
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      socket.emit('join-room', {
        roomId,
        peerId: socket.id,
        role,
        deviceName: isMobileDevice ? 'Mobile Camera' : 'Studio Director PC',
        isMobile: isMobileDevice,
      });
    });

    socket.on('connect_error', (err) => {
      const errorMsg = err?.message || String(err);
      console.warn(`[App] Socket connection error (Retry #${retryCount + 1}):`, errorMsg);

      // Handle 'WebSocket closed without opened' or initial transport handshake drops
      if (
        errorMsg.includes('WebSocket closed') ||
        errorMsg.includes('closed without opened') ||
        errorMsg.includes('websocket') ||
        !socket.connected
      ) {
        retryCount++;
        // Exponential backoff calculation: min(1000 * 2^retryCount, 10000) + random jitter
        const backoffDelay = Math.min(1000 * Math.pow(2, Math.min(retryCount, 6)), 10000) + Math.random() * 500;
        console.log(`[App] Retrying Socket.IO connection in ${Math.round(backoffDelay)}ms via exponential backoff...`);

        if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = setTimeout(() => {
          if (socketRef.current && !socketRef.current.connected) {
            console.log('[App] Attempting explicit Socket.IO manual reconnect...');
            socketRef.current.connect();
          }
        }, backoffDelay);
      }
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log(`[App] Socket auto-reconnecting (Attempt #${attempt}) via exponential backoff...`);
    });

    socket.on('reconnect', (attempt) => {
      console.log(`[App] Socket reconnected after ${attempt} attempt(s). Re-joining room...`);
      retryCount = 0;
      socket.emit('join-room', {
        roomId,
        peerId: socket.id,
        role,
        deviceName: isMobileDevice ? 'Mobile Camera' : 'Studio Director PC',
        isMobile: isMobileDevice,
      });
    });

    socket.on('reconnect_error', (err) => {
      console.warn('[App] Socket reconnection attempt error:', err.message);
    });

    socket.on('room-state', (data: { roomId: string; obsLayout: string; activeSoloPeerId?: string; peers: ConnectedPeer[] }) => {
      setActiveLayout(data.obsLayout || 'grid');
      setActiveSoloPeerId(data.activeSoloPeerId);
      setPeers(data.peers);

      // Connect WebRTC to existing peers
      data.peers.forEach((peer) => {
        if (peer.id !== socket.id) {
          createPeerConnection(peer.id, socket, true);
        }
      });
    });

    socket.on('peer-joined', (peer: ConnectedPeer) => {
      setPeers((prev) => [...prev.filter((p) => p.id !== peer.id), peer]);
      createPeerConnection(peer.id, socket, false);
    });

    socket.on('peer-left', (data: { socketId: string }) => {
      setPeers((prev) => prev.filter((p) => p.id !== data.socketId));
      if (peerConnections.current.has(data.socketId)) {
        peerConnections.current.get(data.socketId)?.close();
        peerConnections.current.delete(data.socketId);
      }
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(data.socketId);
        return next;
      });
    });

    socket.on('webrtc-offer', async (data: { fromSocketId: string; offer: any }) => {
      const pc = getOrCreatePeerConnection(data.fromSocketId, socket);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { targetPeerId: data.fromSocketId, answer });
    });

    socket.on('webrtc-answer', async (data: { fromSocketId: string; answer: any }) => {
      const pc = peerConnections.current.get(data.fromSocketId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    socket.on('ice-candidate', async (data: { fromSocketId: string; candidate: any }) => {
      const pc = peerConnections.current.get(data.fromSocketId);
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn('ICE candidate error:', e);
        }
      }
    });

    socket.on('remote-device-command', (data: { command: string; payload?: any }) => {
      setRemoteCommand({ command: data.command, payload: data.payload });
    });

    socket.on('device-status-update', (data: { socketId: string; stats: PeerStats; settings: DeviceSettings }) => {
      setPeers((prev) =>
        prev.map((p) =>
          p.id === data.socketId
            ? { ...p, stats: data.stats, settings: { ...p.settings, ...data.settings } }
            : p
        )
      );
    });

    socket.on('obs-layout-changed', (data: { layout: string; activeSoloPeerId?: string }) => {
      setActiveLayout(data.layout);
      setActiveSoloPeerId(data.activeSoloPeerId);
    });

    socket.on('chat-message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
    };
  }, [inRoom, roomId, role]);

  // Peer Connection helper
  const getOrCreatePeerConnection = (targetSocketId: string, socket: Socket): RTCPeerConnection => {
    if (peerConnections.current.has(targetSocketId)) {
      return peerConnections.current.get(targetSocketId)!;
    }
    return createPeerConnection(targetSocketId, socket, false);
  };

  const createPeerConnection = (targetSocketId: string, socket: Socket, isInitiator: boolean): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current.set(targetSocketId, pc);

    // Add local stream tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('ice-candidate', { targetPeerId: targetSocketId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        setRemoteStreams((prev) => new Map(prev).set(targetSocketId, e.streams[0]));
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('webrtc-offer', {
            targetPeerId: targetSocketId,
            offer: pc.localDescription,
            senderRole: role,
            deviceName: isMobileDevice ? 'Mobile Camera' : 'Studio PC',
          });
        })
        .catch((err) => console.error('Offer error:', err));
    }

    return pc;
  };

  // Remote command dispatcher
  const handleSendRemoteCommand = (targetSocketId: string, command: string, payload?: any) => {
    if (socketRef.current) {
      socketRef.current.emit('remote-device-command', { targetSocketId, command, payload });
    }
  };

  // Layout change dispatcher
  const handleLayoutChange = (layout: string, activeSoloPeerId?: string) => {
    setActiveLayout(layout);
    setActiveSoloPeerId(activeSoloPeerId);
    if (socketRef.current) {
      socketRef.current.emit('change-obs-layout', { layout, activeSoloPeerId });
    }
  };

  // Chat sender
  const handleSendChat = (message: string) => {
    if (socketRef.current) {
      socketRef.current.emit('send-chat', {
        message,
        senderName: isMobileDevice ? 'Mobile Camera' : 'Director',
        role,
      });
    }
  };

  // Create room handler
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: roomTitle }),
      });
      const data = await res.json();
      window.history.pushState({}, '', `/room/${data.roomId}?role=director`);
      setRoomId(data.roomId);
      setInRoom(true);
    } catch (err) {
      console.error('Failed creating room:', err);
    }
  };

  // Join room handler
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomInput.trim()) return;
    const cleanId = joinRoomInput.trim().toLowerCase();
    window.history.pushState({}, '', `/room/${cleanId}?role=${defaultRole}`);
    setRoomId(cleanId);
    setInRoom(true);
  };

  // -------------------------------------------------------------
  // LANDING PAGE (If not inside a room)
  // -------------------------------------------------------------
  if (!inRoom) {
    return (
      <div className="min-h-screen w-full bg-[#050508] text-slate-100 flex flex-col justify-between relative overflow-hidden selection:bg-blue-500 selection:text-white">
        {/* Luminous Ambient Background Glow Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-600/20 blur-[130px] rounded-full"></div>
          <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-purple-600/20 blur-[130px] rounded-full"></div>
          <div className="absolute top-[40%] right-[20%] w-[25%] h-[25%] bg-indigo-500/10 blur-[100px] rounded-full"></div>
        </div>

        {/* Top Frosted Glass Header */}
        <header className="border-b border-white/10 bg-black/20 backdrop-blur-md px-6 py-4 z-10 relative">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">StreamLink <span className="font-normal opacity-70 text-sm">PRO</span></span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">System Live</span>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="mx-auto max-w-5xl px-6 py-12 flex-1 flex flex-col justify-center z-10 relative">
          <div className="text-center space-y-4 mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-md px-4 py-1.5 text-xs font-semibold text-slate-200 shadow-inner">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <span>Zero App Downloads — 100% In-Browser WebRTC Platform</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight">
              Turn Your Mobile Phone into a <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">Pro Virtual Camera</span> for OBS
            </h1>
            <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed">
              Ultra low latency WebRTC video streaming directly from your iPhone or Android camera to OBS Studio, vMix, or PC. Full remote control of flashlight, lenses, optical zoom, and bitrate.
            </p>
          </div>

          {/* Room Creation & Join Box with Frosted Glass styling */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto w-full">
            {/* Create Studio Room */}
            <form onSubmit={handleCreateRoom} className="rounded-3xl border border-white/10 bg-black/20 p-6 shadow-2xl backdrop-blur-xl flex flex-col justify-between hover:border-white/20 transition-all">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 mb-3 border border-white/10">
                  <Monitor className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg text-white mb-1">Launch Studio Director</h3>
                <p className="text-xs text-slate-400 mb-4">Create a new streaming studio room with OBS Browser Source links & QR code phone pairing.</p>
                <input
                  type="text"
                  placeholder="Studio Title (optional)"
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-slate-200 focus:border-blue-500/60 focus:outline-none mb-4 placeholder:text-slate-500 backdrop-blur-md"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98]"
              >
                <span>Create New Studio Room</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Join Existing Room */}
            <form onSubmit={handleJoinRoom} className="rounded-3xl border border-white/10 bg-black/20 p-6 shadow-2xl backdrop-blur-xl flex flex-col justify-between hover:border-white/20 transition-all">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 mb-3 border border-white/10">
                  <Smartphone className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg text-white mb-1">Join Camera Session</h3>
                <p className="text-xs text-slate-400 mb-4">Enter an existing room ID to stream your phone camera or join as a director.</p>
                <input
                  type="text"
                  placeholder="e.g. sl-a1b2c3"
                  value={joinRoomInput}
                  onChange={(e) => setJoinRoomInput(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-slate-200 focus:border-purple-500/60 focus:outline-none mb-4 placeholder:text-slate-500 backdrop-blur-md"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-3 text-xs font-semibold text-white transition-all backdrop-blur-md active:scale-[0.98]"
              >
                <span>Connect to Room</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Feature Highlights Grid */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 space-y-1.5 shadow-lg">
              <Zap className="h-5 w-5 text-amber-400 mb-2" />
              <strong className="text-slate-100 block font-bold">Sub-100ms Latency</strong>
              <p className="text-slate-400 leading-relaxed">Direct WebRTC peer connections with hardware AV1/H.264 video acceleration.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 space-y-1.5 shadow-lg">
              <Camera className="h-5 w-5 text-blue-400 mb-2" />
              <strong className="text-slate-100 block font-bold">Remote Hardware Control</strong>
              <p className="text-slate-400 leading-relaxed">Control phone torch, optical zoom, exposure, and lens switching from PC studio.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 space-y-1.5 shadow-lg">
              <Tv className="h-5 w-5 text-indigo-400 mb-2" />
              <strong className="text-slate-100 block font-bold">OBS Browser Sources & Docks</strong>
              <p className="text-slate-400 leading-relaxed">Transparent green-screen overlays and custom docks ready to paste in OBS Studio.</p>
            </div>
          </div>
        </main>

        <footer className="border-t border-white/10 bg-black/40 backdrop-blur-xl py-4 text-center text-xs text-slate-500 z-10 relative">
          StreamLink Pro — Enterprise Mobile-to-PC WebRTC Camera Platform
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // IN-ROOM VIEW BASED ON ROLE
  // -------------------------------------------------------------

  // 1. Mobile Camera Sender Mode
  if (role === 'camera_sender') {
    return (
      <MobileCameraSender
        roomId={roomId}
        onStreamCreated={(s) => {
          localStreamRef.current = s;
          peerConnections.current.forEach((pc) => {
            s.getTracks().forEach((track) => {
              const senders = pc.getSenders();
              const hasTrack = senders.some((snd) => snd.track === track);
              if (!hasTrack) {
                pc.addTrack(track, s);
              }
            });
          });
        }}
        onSettingsChange={(st) => {
          if (socketRef.current) {
            socketRef.current.emit('device-status-update', { settings: st });
          }
        }}
        remoteCommand={remoteCommand}
        bitrateKbps={3800}
        fps={30}
      />
    );
  }

  // 2. OBS Browser Source Overlay View
  if (role === 'obs_source') {
    const primaryStream = Array.from(remoteStreams.values())[0] || null;
    return (
      <OBSBrowserSourceView
        roomId={roomId}
        remoteStream={primaryStream}
        transparentBg={transparentBg}
        chromaKey={chromaKey as any}
        nameplateText={nameplateText}
        showNameplate={showNameplate}
      />
    );
  }

  // 3. OBS Custom Browser Dock View
  if (role === 'obs_dock') {
    return (
      <OBSDockView
        roomId={roomId}
        peers={peers}
        onSendRemoteCommand={handleSendRemoteCommand}
        onLayoutChange={handleLayoutChange}
        activeLayout={activeLayout}
        activeSoloPeerId={activeSoloPeerId}
      />
    );
  }

  // 4. Remote Guest View
  if (role === 'guest') {
    return (
      <RemoteGuestView
        roomId={roomId}
        onStreamCreated={(s) => {
          localStreamRef.current = s;
        }}
        chatMessages={chatMessages}
        onSendChat={handleSendChat}
      />
    );
  }

  // 5. Director Studio View (Default PC View)
  return (
    <div className="min-h-screen w-full bg-[#050508] text-slate-100 flex flex-col relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/15 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[10%] right-[-5%] w-[35%] h-[35%] bg-purple-600/15 blur-[120px] rounded-full"></div>
      </div>

      <Navbar
        roomId={roomId}
        role={role}
        activePeersCount={peers.length}
        onOpenQRPair={() => setIsQROpen(true)}
        onOpenOBSModal={() => setIsOBSOpen(true)}
        onOpenAIModal={() => setIsAIOpen(true)}
      />

      <div className="relative z-10 flex-1">
        <DirectorStudio
          roomId={roomId}
          socket={socketRef.current}
          peers={peers}
          remoteStreams={remoteStreams}
          onSendRemoteCommand={handleSendRemoteCommand}
          onLayoutChange={handleLayoutChange}
          activeLayout={activeLayout}
          activeSoloPeerId={activeSoloPeerId}
          chatMessages={chatMessages}
          onSendChat={handleSendChat}
          onOpenQRPair={() => setIsQROpen(true)}
          onOpenOBSModal={() => setIsOBSOpen(true)}
          onOpenAIModal={() => setIsAIOpen(true)}
        />
      </div>

      {/* Popups & Drawers */}
      <QRPairModal isOpen={isQROpen} onClose={() => setIsQROpen(false)} roomId={roomId} />
      <OBSIntegrationModal isOpen={isOBSOpen} onClose={() => setIsOBSOpen(false)} roomId={roomId} />
      <AIAssistantModal
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        activeVideoStream={Array.from(remoteStreams.values())[0] || null}
      />
    </div>
  );
}
