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
import {
  getAccountByToken,
  updateLogin,
  deductCredits,
  updateLastAirdropTick,
  getAccountByAgentId,
} from './player/account.js';
import { CREDITS } from './player/credits.js';
import { createAirdrop, isAirdropOnCooldown, getAirdropCooldownSeconds } from './game/airdrop.js';

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
    mcpBaseUrl: `${PUBLIC_URL}/mcp/${room.id}/sse`,
    message: `Room created! Connect your OpenClaw agent to: ${PUBLIC_URL}/mcp/${room.id}/sse`,
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
    mcpBaseUrl: `${PUBLIC_URL}/mcp/${room.id}/sse`,
  });
});

// ---- MCP Routes ----
registerMcpRoutes(app, roomManager);

// ---- Player Account API ----

// Get player account info
app.get('/api/player/:token', (req, res) => {
  const { token } = req.params;
  const account = getAccountByToken(token);

  if (!account) {
    res.status(404).json({ error: 'Player account not found' });
    return;
  }

  // Update login and give daily bonus
  updateLogin(token);

  // Get current room and agent status
  const room = roomManager.getRoom(account.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const engine = room.getEngine();
  const agent = engine.getPlayer(account.agentId);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found in game' });
    return;
  }

  // Calculate airdrop cooldown
  const currentTick = engine.getCurrentTick();
  const onCooldown = isAirdropOnCooldown(account.lastAirdropTick, currentTick);
  const cooldownSeconds = onCooldown ? getAirdropCooldownSeconds(account.lastAirdropTick, currentTick) : 0;

  res.json({
    playerId: account.id,
    credits: account.credits,
    agent: {
      id: agent.id,
      name: agent.name,
      alive: agent.alive,
      health: agent.health,
      x: agent.x,
      y: agent.y,
    },
    room: {
      id: room.id,
      name: room.name,
      status: room.getStatus(),
    },
    airdrop: {
      cost: CREDITS.AIRDROP_COST,
      onCooldown,
      cooldownSeconds,
    },
  });
});

// Request airdrop
app.post('/api/player/:token/airdrop', (req, res) => {
  const { token } = req.params;
  const account = getAccountByToken(token);

  if (!account) {
    res.status(404).json({ error: 'Player account not found' });
    return;
  }

  const room = roomManager.getRoom(account.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const engine = room.getEngine();
  const agent = engine.getPlayer(account.agentId);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found in game' });
    return;
  }

  // Validate game state
  if (engine.getStatus() !== 'playing') {
    res.status(400).json({ error: 'Game is not active' });
    return;
  }

  if (!agent.alive) {
    res.status(400).json({ error: 'Agent is not alive' });
    return;
  }

  // Check credits
  if (account.credits < CREDITS.AIRDROP_COST) {
    res.status(400).json({ error: 'Insufficient credits', required: CREDITS.AIRDROP_COST, current: account.credits });
    return;
  }

  // Check cooldown
  const currentTick = engine.getCurrentTick();
  if (isAirdropOnCooldown(account.lastAirdropTick, currentTick)) {
    const cooldownSeconds = getAirdropCooldownSeconds(account.lastAirdropTick, currentTick);
    res.status(400).json({ error: 'Airdrop on cooldown', cooldownSeconds });
    return;
  }

  // Deduct credits
  if (!deductCredits(token, CREDITS.AIRDROP_COST)) {
    res.status(500).json({ error: 'Failed to deduct credits' });
    return;
  }

  // Create airdrop
  const airdrop = createAirdrop(account.id, agent);
  engine.addAirdrop(airdrop);

  // Update last airdrop tick
  updateLastAirdropTick(token, currentTick);

  res.json({
    success: true,
    message: 'Airdrop called! Landing in 3 ticks...',
    airdrop: {
      targetX: airdrop.targetX,
      targetY: airdrop.targetY,
      ticksRemaining: airdrop.ticksRemaining,
      powerUpType: airdrop.powerUpType,
    },
    creditsRemaining: account.credits - CREDITS.AIRDROP_COST,
  });
});

// ---- Static Files (production) ----
// In production, serve the built React frontend from the same server
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDistPath = join(__dirname, '../../client/dist');
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
} else {
  console.log('[Static] Client dist not found at', clientDistPath);
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
