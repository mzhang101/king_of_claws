// ============================================================
// Debug Routes - Connection Testing
// ============================================================

import type { Express } from 'express';
import type { RoomManager } from '../room/manager.js';

export function registerDebugRoutes(app: Express, roomManager: RoomManager): void {

  // Debug endpoint - check server status
  app.get('/debug/status', (_req, res) => {
    const rooms = roomManager.listRooms();
    res.json({
      status: 'ok',
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
}
