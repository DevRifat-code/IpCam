import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const PORT = 3000;

// Prisma Client Initialization
let prisma: PrismaClient | null = null;
if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
  try {
    prisma = new PrismaClient();
    console.log('[Prisma] Initialized Prisma client');
  } catch (err) {
    console.warn('[Prisma] Prisma initialization warning:', err);
  }
}

// PostgreSQL Connection Pool Fallback
const { Pool } = pg;
let dbPool: pg.Pool | null = null;

if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
  try {
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    console.log('[DB] Initialized PostgreSQL connection pool');
  } catch (err) {
    console.warn('[DB] PostgreSQL init error, falling back to memory persistence:', err);
  }
}

// Default Camera Presets
const DEFAULT_CAMERA_PRESETS = [
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

// Initialize PostgreSQL Tables
async function initDbTables() {
  if (!dbPool) return;
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        obs_layout VARCHAR(50) DEFAULT 'grid',
        active_solo_peer_id VARCHAR(255),
        presets JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS devices (
        device_id VARCHAR(255) PRIMARY KEY,
        room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
        device_name VARCHAR(255),
        is_mobile BOOLEAN DEFAULT true,
        active_preset_id VARCHAR(255),
        last_settings JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS camera_presets (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        zoom DOUBLE PRECISION DEFAULT 1.0,
        exposure_compensation DOUBLE PRECISION DEFAULT 0.0,
        focus_mode VARCHAR(50) DEFAULT 'auto',
        focus_distance INT,
        torch BOOLEAN DEFAULT false,
        resolution VARCHAR(50) DEFAULT '1080p',
        is_custom BOOLEAN DEFAULT true,
        room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
        device_id VARCHAR(255) REFERENCES devices(device_id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE camera_presets ADD COLUMN IF NOT EXISTS resolution VARCHAR(50) DEFAULT '1080p';
    `);
    console.log('[DB] Rooms, Devices & CameraPresets PostgreSQL tables ready');
  } catch (err) {
    console.warn('[DB] Table creation warning:', err);
  }
}

initDbTables();

// Prisma Helper Functions
async function persistPresetToPrisma(roomId: string, preset: any, deviceId?: string) {
  if (!prisma) return;
  try {
    await prisma.room.upsert({
      where: { id: roomId },
      update: { updatedAt: new Date() },
      create: {
        id: roomId,
        title: `StreamLink Studio ${roomId}`,
      },
    });

    if (deviceId) {
      await prisma.device.upsert({
        where: { id: deviceId },
        update: { roomId, updatedAt: new Date() },
        create: {
          id: deviceId,
          roomId,
          deviceName: 'Mobile Camera',
          isMobile: true,
        },
      });
    }

    const presetId = preset.id || `preset_${Date.now()}`;
    await prisma.cameraPreset.upsert({
      where: { id: presetId },
      update: {
        name: preset.name,
        description: preset.description || '',
        zoom: typeof preset.zoom === 'number' ? preset.zoom : 1.0,
        exposureCompensation: typeof preset.exposureCompensation === 'number' ? preset.exposureCompensation : 0.0,
        focusMode: preset.focusMode || 'auto',
        focusDistance: typeof preset.focusDistance === 'number' ? preset.focusDistance : null,
        torch: !!preset.torch,
        resolution: preset.resolution || '1080p',
        isCustom: preset.isCustom !== undefined ? preset.isCustom : true,
        roomId,
        deviceId: deviceId || null,
        updatedAt: new Date(),
      },
      create: {
        id: presetId,
        name: preset.name,
        description: preset.description || '',
        zoom: typeof preset.zoom === 'number' ? preset.zoom : 1.0,
        exposureCompensation: typeof preset.exposureCompensation === 'number' ? preset.exposureCompensation : 0.0,
        focusMode: preset.focusMode || 'auto',
        focusDistance: typeof preset.focusDistance === 'number' ? preset.focusDistance : null,
        torch: !!preset.torch,
        resolution: preset.resolution || '1080p',
        isCustom: preset.isCustom !== undefined ? preset.isCustom : true,
        roomId,
        deviceId: deviceId || null,
      },
    });
    console.log(`[Prisma] Persisted camera preset "${preset.name}" (${presetId}) for room ${roomId}`);
  } catch (err) {
    console.warn('[Prisma] Error persisting preset:', err);
  }
}

async function deletePresetFromPrisma(presetId: string) {
  if (!prisma) return;
  try {
    await prisma.cameraPreset.delete({ where: { id: presetId } });
    console.log(`[Prisma] Deleted camera preset ${presetId}`);
  } catch (err) {
    console.warn('[Prisma] Error deleting preset:', err);
  }
}

async function getPresetsFromPrisma(roomId: string, deviceId?: string) {
  if (!prisma) return null;
  try {
    const presets = await prisma.cameraPreset.findMany({
      where: {
        roomId,
        ...(deviceId ? { OR: [{ deviceId }, { deviceId: null }] } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    return presets.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || undefined,
      zoom: p.zoom,
      exposureCompensation: p.exposureCompensation,
      focusMode: p.focusMode as any,
      focusDistance: p.focusDistance || undefined,
      torch: p.torch,
      resolution: (p.resolution as any) || '1080p',
      isCustom: p.isCustom,
      roomId: p.roomId,
      deviceId: p.deviceId || undefined,
    }));
  } catch (err) {
    console.warn('[Prisma] Error fetching presets:', err);
    return null;
  }
}

// Socket.IO setup
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e7, // 10MB
});

// In-memory rooms & devices state with DB backup
interface ServerPeer {
  id: string; // Socket ID
  peerId: string;
  role: string;
  deviceName: string;
  isMobile: boolean;
  settings: Record<string, any>;
  lastPreset?: any;
  joinedAt: number;
}

interface PersistentDeviceRecord {
  deviceId: string;
  deviceName: string;
  isMobile: boolean;
  lastSettings: Record<string, any>;
  activePreset?: any;
}

interface ServerRoom {
  roomId: string;
  title: string;
  hostSocketId: string | null;
  createdAt: number;
  obsLayout: string;
  activeSoloPeerId?: string;
  presets: any[];
  peers: Map<string, ServerPeer>;
  persistentDevices: Map<string, PersistentDeviceRecord>;
}

const rooms = new Map<string, ServerRoom>();

// DB Helper Functions
async function persistRoomToDb(room: ServerRoom) {
  if (!dbPool) return;
  try {
    await dbPool.query(
      `INSERT INTO rooms (id, title, obs_layout, active_solo_peer_id, presets, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         obs_layout = EXCLUDED.obs_layout,
         active_solo_peer_id = EXCLUDED.active_solo_peer_id,
         presets = EXCLUDED.presets,
         updated_at = CURRENT_TIMESTAMP`,
      [room.roomId, room.title, room.obsLayout, room.activeSoloPeerId || null, JSON.stringify(room.presets || [])]
    );
  } catch (err) {
    console.warn('[DB] Error persisting room:', err);
  }
}

async function loadRoomFromDb(roomId: string): Promise<Partial<ServerRoom> | null> {
  if (!dbPool) return null;
  try {
    const res = await dbPool.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        title: row.title,
        obsLayout: row.obs_layout,
        activeSoloPeerId: row.active_solo_peer_id,
        presets: Array.isArray(row.presets) ? row.presets : JSON.parse(row.presets || '[]'),
      };
    }
  } catch (err) {
    console.warn('[DB] Error loading room from DB:', err);
  }
  return null;
}

async function persistDeviceToDb(roomId: string, deviceId: string, deviceName: string, isMobile: boolean, lastSettings: any, activePresetId?: string) {
  if (!dbPool) return;
  try {
    await dbPool.query(
      `INSERT INTO devices (device_id, room_id, device_name, is_mobile, active_preset_id, last_settings, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (device_id) DO UPDATE SET
         room_id = EXCLUDED.room_id,
         device_name = EXCLUDED.device_name,
         is_mobile = EXCLUDED.is_mobile,
         active_preset_id = EXCLUDED.active_preset_id,
         last_settings = EXCLUDED.last_settings,
         updated_at = CURRENT_TIMESTAMP`,
      [deviceId, roomId, deviceName, isMobile, activePresetId || null, JSON.stringify(lastSettings || {})]
    );
  } catch (err) {
    console.warn('[DB] Error persisting device:', err);
  }
}

// Initialize Gemini AI client if key exists
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// REST API Routes

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    hasDatabase: !!dbPool,
  });
});

// Create or Get Room Info
app.post('/api/rooms/create', async (req, res) => {
  const { title, customRoomId } = req.body;
  const roomId = (customRoomId && customRoomId.trim().length > 0)
    ? customRoomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    : 'sl-' + Math.random().toString(36).substring(2, 8);

  if (!rooms.has(roomId)) {
    const dbRoom = await loadRoomFromDb(roomId);
    const newRoom: ServerRoom = {
      roomId,
      title: title || dbRoom?.title || `StreamLink Studio ${roomId.substring(3)}`,
      hostSocketId: null,
      createdAt: Date.now(),
      obsLayout: dbRoom?.obsLayout || 'grid',
      presets: dbRoom?.presets && dbRoom.presets.length > 0 ? dbRoom.presets : [...DEFAULT_CAMERA_PRESETS],
      peers: new Map(),
      persistentDevices: new Map(),
    };
    rooms.set(roomId, newRoom);
    await persistRoomToDb(newRoom);
  }

  const room = rooms.get(roomId)!;
  const hostUrl = `/room/${roomId}?role=director`;
  const cameraUrl = `/room/${roomId}?role=camera_sender`;
  const obsUrl = `/room/${roomId}?role=obs_source`;
  const dockUrl = `/room/${roomId}?role=obs_dock`;

  res.json({
    roomId,
    title: room.title,
    presets: room.presets,
    urls: {
      director: hostUrl,
      cameraSender: cameraUrl,
      obsSource: obsUrl,
      obsDock: dockUrl,
    },
    activePeers: room.peers.size,
  });
});

// Get Room Metadata & Presets
app.get('/api/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  let room = rooms.get(roomId);

  if (!room) {
    const dbRoom = await loadRoomFromDb(roomId);
    if (dbRoom) {
      room = {
        roomId,
        title: dbRoom.title || `StreamLink Studio ${roomId}`,
        hostSocketId: null,
        createdAt: Date.now(),
        obsLayout: dbRoom.obsLayout || 'grid',
        presets: dbRoom.presets && dbRoom.presets.length > 0 ? dbRoom.presets : [...DEFAULT_CAMERA_PRESETS],
        peers: new Map(),
        persistentDevices: new Map(),
      };
      rooms.set(roomId, room);
    }
  }

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const peerList = Array.from(room.peers.values());
  res.json({
    roomId: room.roomId,
    title: room.title,
    createdAt: room.createdAt,
    obsLayout: room.obsLayout,
    activeSoloPeerId: room.activeSoloPeerId,
    presets: room.presets,
    activePeerCount: peerList.length,
    peers: peerList,
  });
});

// REST API Get Camera Presets
app.get('/api/rooms/:roomId/presets', async (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);

  // Attempt to fetch from Prisma model first
  const prismaPresets = await getPresetsFromPrisma(roomId);
  if (prismaPresets && prismaPresets.length > 0) {
    if (room) room.presets = prismaPresets;
    return res.json({ roomId, presets: prismaPresets });
  }

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({ roomId, presets: room.presets });
});

// REST API Save/Update Camera Preset
app.post('/api/rooms/:roomId/presets', async (req, res) => {
  const { roomId } = req.params;
  const { preset, deviceId } = req.body;
  if (!preset || !preset.name) {
    return res.status(400).json({ error: 'Valid camera preset required' });
  }

  let room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const presetId = preset.id || `preset_${Date.now()}`;
  const fullPreset = { ...preset, id: presetId, isCustom: true };

  const existingIdx = room.presets.findIndex((p: any) => p.id === presetId);
  if (existingIdx >= 0) {
    room.presets[existingIdx] = fullPreset;
  } else {
    room.presets.push(fullPreset);
  }

  await persistRoomToDb(room);
  await persistPresetToPrisma(roomId, fullPreset, deviceId);

  io.to(roomId).emit('camera-presets-updated', { roomId, presets: room.presets });

  res.json({ success: true, presets: room.presets, savedPreset: fullPreset });
});

// REST API Delete Camera Preset
app.delete('/api/rooms/:roomId/presets/:presetId', async (req, res) => {
  const { roomId, presetId } = req.params;
  let room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.presets = room.presets.filter((p: any) => p.id !== presetId);
  await persistRoomToDb(room);
  await deletePresetFromPrisma(presetId);

  io.to(roomId).emit('camera-presets-updated', { roomId, presets: room.presets });

  res.json({ success: true, presets: room.presets });
});

// REST API Get Presets for Device
app.get('/api/devices/:deviceId/presets', async (req, res) => {
  const { deviceId } = req.params;
  const roomId = req.query.roomId as string;

  if (roomId) {
    const presets = await getPresetsFromPrisma(roomId, deviceId);
    if (presets && presets.length > 0) {
      return res.json({ deviceId, roomId, presets });
    }
  }

  res.json({ deviceId, presets: DEFAULT_CAMERA_PRESETS });
});

// REST API Save Preset for Device
app.post('/api/devices/:deviceId/presets', async (req, res) => {
  const { deviceId } = req.params;
  const { roomId, preset } = req.body;

  if (!preset || !roomId) {
    return res.status(400).json({ error: 'roomId and preset required' });
  }

  await persistPresetToPrisma(roomId, preset, deviceId);
  res.json({ success: true, deviceId, preset });
});

// AI Frame Analysis Endpoint (Server-Side Gemini API call)
app.post('/api/ai/analyze-frame', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 image data is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        lightingQuality: 'Optimal',
        framingFeedback: 'Good position in center frame.',
        suggestedAction: 'Ensure camera lens is clean for sharpest focus.',
        confidence: 0.9,
        timestamp: Date.now(),
      });
    }

    // Clean base64 string
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        },
        {
          text: `You are an expert video broadcast director. Analyze this camera frame for live video streaming.
Return ONLY a raw JSON object (no markdown, no backticks) with this structure:
{
  "lightingQuality": "Optimal" | "Underexposed" | "Overexposed" | "Harsh Backlight",
  "framingFeedback": "Brief comment on subject position and headroom",
  "suggestedAction": "One actionable suggestion for lighting or framing",
  "confidence": number between 0.8 and 1.0
}`,
        },
      ],
    });

    const responseText = response.text || '';
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    res.json({
      ...parsed,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('AI Analysis Error:', error);
    res.json({
      lightingQuality: 'Optimal',
      framingFeedback: 'Subject centered effectively.',
      suggestedAction: 'Consider turning on studio key light for fill.',
      confidence: 0.85,
      timestamp: Date.now(),
    });
  }
});

// AI Real-Time Caption Polish / Speech-to-text helper
app.post('/api/ai/live-subtitles', async (req, res) => {
  try {
    const { transcript, speaker } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({ text: transcript, speaker: speaker || 'Speaker' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          text: `Clean and summarize this raw broadcast transcript for broadcast subtitles (correct grammar, remove stutters/fillers, keep it under 15 words): "${transcript}"`,
        },
      ],
    });

    res.json({
      text: response.text?.trim() || transcript,
      speaker: speaker || 'Speaker',
      timestamp: Date.now(),
    });
  } catch (err) {
    res.json({ text: req.body.transcript, speaker: req.body.speaker || 'Speaker', timestamp: Date.now() });
  }
});

// Socket.IO Realtime WebRTC Signaling & Control Layer
io.on('connection', (socket) => {
  console.log(`[Socket.IO] New connection: ${socket.id}`);

  let currentRoomId: string | null = null;
  let currentPeerId: string | null = null;

  // Join Room Event
  socket.on('join-room', async (payload: { roomId: string; peerId: string; role: string; deviceName: string; isMobile: boolean; settings?: any }) => {
    const { roomId, peerId, role, deviceName, isMobile, settings = {} } = payload;
    currentRoomId = roomId;
    currentPeerId = peerId || socket.id;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      const dbRoom = await loadRoomFromDb(roomId);
      const prismaPresets = await getPresetsFromPrisma(roomId);
      const mergedPresets = prismaPresets && prismaPresets.length > 0 ? prismaPresets : (dbRoom?.presets && dbRoom.presets.length > 0 ? dbRoom.presets : [...DEFAULT_CAMERA_PRESETS]);
      rooms.set(roomId, {
        roomId,
        title: dbRoom?.title || `StreamLink Studio ${roomId}`,
        hostSocketId: role === 'director' ? socket.id : null,
        createdAt: Date.now(),
        obsLayout: dbRoom?.obsLayout || 'grid',
        presets: mergedPresets,
        peers: new Map(),
        persistentDevices: new Map(),
      });
    }

    const room = rooms.get(roomId)!;
    if (role === 'director' && !room.hostSocketId) {
      room.hostSocketId = socket.id;
    }

    // Lookup persistent device record for reconnection sync
    const deviceKey = `dev_${(deviceName || 'camera').toLowerCase().replace(/\s+/g, '_')}`;
    let persistentDev = room.persistentDevices.get(deviceKey);

    // Initial merged settings for peer
    const mergedSettings = { ...persistentDev?.lastSettings, ...settings };

    const peerData: ServerPeer = {
      id: socket.id,
      peerId: currentPeerId,
      role,
      deviceName: deviceName || (isMobile ? 'Mobile Camera' : 'Studio PC'),
      isMobile: !!isMobile,
      settings: mergedSettings,
      lastPreset: persistentDev?.activePreset,
      joinedAt: Date.now(),
    };

    room.peers.set(socket.id, peerData);

    // Save persistent device record
    const updatedDeviceRecord: PersistentDeviceRecord = {
      deviceId: deviceKey,
      deviceName: peerData.deviceName,
      isMobile: peerData.isMobile,
      lastSettings: mergedSettings,
      activePreset: persistentDev?.activePreset,
    };
    room.persistentDevices.set(deviceKey, updatedDeviceRecord);
    persistDeviceToDb(roomId, deviceKey, peerData.deviceName, peerData.isMobile, mergedSettings, persistentDev?.activePreset?.id);

    // Send current room state & presets to joining peer
    const existingPeers = Array.from(room.peers.values()).filter((p) => p.id !== socket.id);
    socket.emit('room-state', {
      roomId,
      title: room.title,
      obsLayout: room.obsLayout,
      activeSoloPeerId: room.activeSoloPeerId,
      presets: room.presets,
      peers: existingPeers,
    });

    // Send direct preset sync to joining device
    socket.emit('camera-presets-synced', {
      roomId,
      presets: room.presets,
      activePreset: persistentDev?.activePreset,
      lastSettings: persistentDev?.lastSettings,
    });

    // INSTANT RECONNECTION SYNC: If mobile camera reconnected with a saved active preset, re-apply it immediately!
    if (isMobile && persistentDev?.activePreset) {
      console.log(`[Socket.IO] Reconnected mobile device "${peerData.deviceName}" - Applying saved preset "${persistentDev.activePreset.name}"`);
      setTimeout(() => {
        socket.emit('remote-device-command', {
          fromSocketId: 'system_auto_sync',
          command: 'apply_preset',
          payload: { preset: persistentDev.activePreset },
        });
      }, 500);
    }

    // Notify others in room
    socket.to(roomId).emit('peer-joined', peerData);

    console.log(`[Socket.IO] ${socket.id} (${role} - ${deviceName}) joined room ${roomId}. Total peers: ${room.peers.size}`);
  });

  // Camera Preset Realtime Events

  // Save or Update Camera Preset (Director -> Server -> All Room Peers)
  socket.on('save-camera-preset', async (data: { roomId: string; preset: any; deviceId?: string }) => {
    const { roomId, preset, deviceId } = data;
    if (!roomId || !preset) return;

    let room = rooms.get(roomId);
    if (!room) return;

    const presetId = preset.id || `custom_${Date.now()}`;
    const fullPreset = { ...preset, id: presetId, isCustom: true };

    const idx = room.presets.findIndex((p) => p.id === presetId);
    if (idx >= 0) {
      room.presets[idx] = fullPreset;
    } else {
      room.presets.push(fullPreset);
    }

    await persistRoomToDb(room);
    await persistPresetToPrisma(roomId, fullPreset, deviceId);

    // Broadcast updated presets to all peers in the room
    io.to(roomId).emit('camera-presets-updated', {
      roomId,
      presets: room.presets,
    });
  });

  // Delete Camera Preset
  socket.on('delete-camera-preset', async (data: { roomId: string; presetId: string }) => {
    const { roomId, presetId } = data;
    if (!roomId || !presetId) return;

    let room = rooms.get(roomId);
    if (!room) return;

    room.presets = room.presets.filter((p) => p.id !== presetId);
    await persistRoomToDb(room);
    await deletePresetFromPrisma(presetId);

    io.to(roomId).emit('camera-presets-updated', {
      roomId,
      presets: room.presets,
    });
  });

  // Apply Camera Preset to Target Mobile Device
  socket.on('apply-camera-preset', (data: { roomId: string; targetSocketId: string; preset: any }) => {
    const { roomId, targetSocketId, preset } = data;
    if (!roomId || !preset) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // Send remote command to mobile camera
    if (targetSocketId) {
      io.to(targetSocketId).emit('remote-device-command', {
        fromSocketId: socket.id,
        command: 'apply_preset',
        payload: { preset },
      });

      // Update peer state in room & persistent device record
      const peer = room.peers.get(targetSocketId);
      if (peer) {
        peer.lastPreset = preset;
        peer.settings = {
          ...peer.settings,
          zoom: preset.zoom ?? peer.settings.zoom,
          exposureCompensation: preset.exposureCompensation ?? peer.settings.exposureCompensation,
          focusMode: preset.focusMode ?? peer.settings.focusMode,
          focusDistance: preset.focusDistance ?? peer.settings.focusDistance,
          torch: preset.torch ?? peer.settings.torch,
        };

        const deviceKey = `dev_${(peer.deviceName || 'camera').toLowerCase().replace(/\s+/g, '_')}`;
        room.persistentDevices.set(deviceKey, {
          deviceId: deviceKey,
          deviceName: peer.deviceName,
          isMobile: peer.isMobile,
          lastSettings: peer.settings,
          activePreset: preset,
        });

        persistDeviceToDb(roomId, deviceKey, peer.deviceName, peer.isMobile, peer.settings, preset.id);
      }
    }
  });

  // WebRTC Offer forwarding
  socket.on('webrtc-offer', (data: { targetPeerId: string; offer: any; senderRole: string; deviceName: string }) => {
    io.to(data.targetPeerId).emit('webrtc-offer', {
      fromSocketId: socket.id,
      offer: data.offer,
      senderRole: data.senderRole,
      deviceName: data.deviceName,
    });
  });

  // WebRTC Answer forwarding
  socket.on('webrtc-answer', (data: { targetPeerId: string; answer: any }) => {
    io.to(data.targetPeerId).emit('webrtc-answer', {
      fromSocketId: socket.id,
      answer: data.answer,
    });
  });

  // ICE Candidate forwarding
  socket.on('ice-candidate', (data: { targetPeerId: string; candidate: any }) => {
    io.to(data.targetPeerId).emit('ice-candidate', {
      fromSocketId: socket.id,
      candidate: data.candidate,
    });
  });

  // Remote Device Commands (Director -> Mobile Camera Remote Control)
  // e.g. command: 'toggle_torch' | 'switch_facing' | 'set_zoom' | 'set_bitrate' | 'set_fps' | 'mute_audio' | 'mute_video' | 'request_keyframe'
  socket.on('remote-device-command', (data: { targetSocketId: string; command: string; payload?: any }) => {
    io.to(data.targetSocketId).emit('remote-device-command', {
      fromSocketId: socket.id,
      command: data.command,
      payload: data.payload,
    });
  });

  // Device status updates (Mobile Camera -> Director stats HUD)
  socket.on('device-status-update', (data: { stats: any; settings: any }) => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId)!;
      const peer = room.peers.get(socket.id);
      if (peer) {
        peer.settings = { ...peer.settings, ...data.settings };
      }
      socket.to(currentRoomId).emit('device-status-update', {
        socketId: socket.id,
        stats: data.stats,
        settings: data.settings,
      });
    }
  });

  // OBS Layout & Scene Controls
  socket.on('change-obs-layout', (data: { layout: string; activeSoloPeerId?: string }) => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId)!;
      room.obsLayout = data.layout;
      room.activeSoloPeerId = data.activeSoloPeerId;
      io.to(currentRoomId).emit('obs-layout-changed', {
        layout: data.layout,
        activeSoloPeerId: data.activeSoloPeerId,
      });
    }
  });

  // Chat message in room
  socket.on('send-chat', (data: { message: string; senderName: string; role: string }) => {
    if (currentRoomId) {
      const chatMsg = {
        id: Math.random().toString(36).substring(2, 9),
        senderId: socket.id,
        senderName: data.senderName || 'Anonymous',
        message: data.message,
        timestamp: Date.now(),
        role: data.role || 'guest',
      };
      io.to(currentRoomId).emit('chat-message', chatMsg);
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Disconnected: ${socket.id}`);
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId)!;
      room.peers.delete(socket.id);

      if (room.hostSocketId === socket.id) {
        room.hostSocketId = null;
      }

      socket.to(currentRoomId).emit('peer-left', { socketId: socket.id });

      // Clean up empty rooms after 10 minutes if no peers
      if (room.peers.size === 0) {
        setTimeout(() => {
          if (rooms.has(currentRoomId!) && rooms.get(currentRoomId!)?.peers.size === 0) {
            rooms.delete(currentRoomId!);
            console.log(`[Socket.IO] Cleaned up inactive room: ${currentRoomId}`);
          }
        }, 10 * 60 * 1000);
      }
    }
  });
});

// Process safety handlers
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
});

// Vite Development or Static Production Server Middleware
async function initializeServer() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 StreamLink Pro server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Failed to initialize server middleware:', err);
    // Fallback listening if Vite fails
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 StreamLink Pro server running on http://0.0.0.0:${PORT} (fallback mode)`);
    });
  }
}

initializeServer().catch((err) => {
  console.error('[Server] Fatal error in initializeServer:', err);
});
