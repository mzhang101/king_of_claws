// ============================================================
// Debug Routes - Connection Testing
// ============================================================

import type { Express } from 'express';
import { getGeminiDiagnostics } from '../ai/gemini-client.js';
import { getAiControllerSummary } from '../game/bot.js';
import type { RoomManager } from '../room/manager.js';

let serverStartTime = Date.now();
let serverInstanceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function registerDebugRoutes(app: Express, roomManager: RoomManager): void {

  // Debug endpoint - check server status
  app.get('/debug/status', (_req, res) => {
    const rooms = roomManager.listRooms();
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    res.json({
      status: 'ok',
      instanceId: serverInstanceId,
      uptime: `${uptime}s`,
      timestamp: new Date().toISOString(),
      publicUrl: process.env.PUBLIC_URL || 'not set',
      port: process.env.PORT || 3001,
      host: process.env.HOST || '0.0.0.0',
      rooms: rooms.map(r => ({
        id: r.id,
        name: r.name,
        status: r.status,
        players: r.playerCount,
      })),
    });
  });

  // Debug endpoint - test room existence
  app.get('/debug/room/:roomId', (req, res) => {
    const roomId = req.params.roomId;
    const room = roomManager.getRoom(roomId);

    if (!room) {
      res.json({
        exists: false,
        roomId,
        message: 'Room not found',
      });
      return;
    }

    res.json({
      exists: true,
      roomId,
      status: room.getStatus(),
      playerCount: room.getEngine().getPlayerCount(),
      createdAt: room.createdAt,
      finishedAt: room.getFinishedAt(),
    });
  });

  app.get('/debug/ai', (_req, res) => {
    const rooms = roomManager.listRooms();
    const aiControllers = rooms.map(room => ({
      roomId: room.id,
      roomName: room.name,
      status: room.status,
      controllers: getAiControllerSummary(room.id),
    }));

    res.json({
      status: 'ok',
      gemini: getGeminiDiagnostics(),
      aiControllers,
      hints: [
        'If gemini.totalCalls stays 0, no TacticalBrain is invoking Gemini yet.',
        'If brainRegistered is false in get_tactical_status, the player is not attached to TacticalBrain.',
        'If gemini.lastError is set, the API is being reached but failing.',
      ],
    });
  });
}
