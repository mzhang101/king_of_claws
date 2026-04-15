// ============================================================
// King of Claws — Server Entry Point
// ============================================================

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { SERVER_PORT, PUBLIC_URL } from '@king-of-claws/shared';
import { RoomManager } from './room/manager.js';
import { registerMcpRoutes } from './mcp/transport.js';
import { setupSpectatorWebSocket } from './ws/spectator.js';
import { spawnBot } from './game/bot.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

// ---- Core Services ----
const roomManager = new RoomManager();

// ---- REST API ----

// Health check (only when not serving frontend)
app.get('/api/health', (_req, res) => {
  res.json({ name: 'King of Claws', version: '1.0.0', status: 'running' });
});

// List rooms
app.get('/api/rooms', (_req, res) => {
  res.json(roomManager.listRooms());
});

// Create room
app.post('/api/rooms', (req, res) => {
  const { name } = req.body;
  const room = roomManager.createRoom(name || 'Unnamed Arena');
  res.json({
    id: room.id,
    name: room.name,
    mcpBaseUrl: `${PUBLIC_URL}/mcp/${room.id}`,
    message: `Room created! Connect your OpenClaw agent to: ${PUBLIC_URL}/mcp/${room.id}/<your-name>/sse`,
  });
});

// Start game in a room
app.post('/api/rooms/:roomId/start', (req, res) => {
  const room = roomManager.getRoom(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const started = room.startGame();
  if (!started) {
    res.status(400).json({ error: 'Cannot start: need 2+ players and game must be in waiting state' });
    return;
  }
  res.json({ success: true, message: 'Game starting...' });
});

// Add built-in bot to room
app.post('/api/rooms/:roomId/add-bot', (req, res) => {
  const room = roomManager.getRoom(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const engine = room.getEngine();
  const botName = spawnBot(room.id, engine);
  if (!botName) {
    res.status(400).json({ error: 'Room is full (max 4 players)' });
    return;
  }
  room.onPlayerConnected(`bot-${botName}`, botName);
  res.json({ success: true, name: botName, message: `Bot "${botName}" added!` });
});

// Room details
app.get('/api/rooms/:roomId', (req, res) => {
  const room = roomManager.getRoom(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const state = room.getEngine().getState();
  res.json({
    ...room.getSummary(),
    players: state.players.map(p => ({ id: p.id, name: p.name, connected: p.connected })),
    mcpBaseUrl: `${PUBLIC_URL}/mcp/${room.id}`,
  });
});

// ---- MCP Routes ----
registerMcpRoutes(app, roomManager);

// ---- Static Files (production) ----
// In production, serve the built React frontend from the same server
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDistPath = join(__dirname, '../../../client/dist');
if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // SPA fallback: serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Skip API, MCP, and WebSocket routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/mcp/')) {
      return next();
    }
    res.sendFile(join(clientDistPath, 'index.html'));
  });
  console.log('[Static] Serving frontend from', clientDistPath);
}

// ---- WebSocket ----
setupSpectatorWebSocket(httpServer, roomManager);

// ---- Periodic Cleanup ----
setInterval(() => {
  roomManager.cleanupFinished();
}, 60_000);

// ---- Start Server ----
const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(SERVER_PORT, HOST, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║          King of Claws  Server               ║
  ╠══════════════════════════════════════════════╣
  ║  HTTP:      http://${HOST}:${SERVER_PORT}            ║
  ║  WebSocket: ws://${HOST}:${SERVER_PORT}/ws            ║
  ║  MCP:       ${PUBLIC_URL}/mcp/...     ║
  ║  Public:    ${PUBLIC_URL}                    ║
  ╚══════════════════════════════════════════════╝
  `);
});
