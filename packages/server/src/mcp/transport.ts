// ============================================================
// King of Claws — MCP SSE Transport Routing
// ============================================================

import type { Express, Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RoomManager } from '../room/manager.js';
import { createPlayerMcpServer } from './server.js';
import { createPlayerAccount } from '../player/account.js';

interface PlayerSession {
  mcpServer: McpServer;
  transport: SSEServerTransport;
  playerToken: string;
}

// Store active sessions: roomId:playerId → session
const sessions = new Map<string, PlayerSession>();

/**
 * Register MCP SSE routes on the Express app.
 *
 * Routes:
 *   GET  /mcp/:roomId/sse              → Establish SSE connection (auto-assigns player)
 *   POST /mcp/:roomId/:playerId/message → Receive MCP messages
 */
export function registerMcpRoutes(app: Express, roomManager: RoomManager): void {

  // SSE connection endpoint - auto-assigns player ID and name
  app.get('/mcp/:roomId/sse', async (req: Request, res: Response) => {
    const roomId = req.params.roomId as string;
    console.log(`[MCP] SSE connection request for room: ${roomId}`);

    const room = roomManager.getRoom(roomId);
    if (!room) {
      console.log(`[MCP] Room not found: ${roomId}`);
      res.status(404).json({
        error: 'Room not found',
        message: 'This room no longer exists. It may have been cleaned up after finishing. Please create a new room from the lobby.'
      });
      return;
    }

    console.log(`[MCP] Room found: ${roomId}, status: ${room.getStatus()}`);

    if (room.getStatus() === 'finished') {
      console.log(`[MCP] Room already finished: ${roomId}`);
      res.status(400).json({
        error: 'Game already finished',
        message: 'This game has ended. Please create a new room from the lobby to start a fresh game.'
      });
      return;
    }

    // Check room capacity
    const engine = room.getEngine();
    if (engine.getPlayerCount() >= 4) {
      res.status(403).json({ error: 'Room is full (max 4 players)' });
      return;
    }

    // Generate unique player ID and random name
    const playerId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const randomNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
    const playerName = randomNames[engine.getPlayerCount() % randomNames.length];
    const sessionKey = `${roomId}:${playerId}`;

    // Add player to game
    const player = engine.addPlayer(playerId, playerName);
    if (!player) {
      console.log(`[MCP] Failed to add player to room ${roomId}`);
      res.status(500).json({ error: 'Failed to add player' });
      return;
    }

    console.log(`[MCP] Player added: ${playerId} (${playerName}) to room ${roomId}`);

    // Notify room of new player
    room.onPlayerConnected(playerId, playerName);

    // Create player account and get token
    const account = createPlayerAccount(playerId, roomId);
    const playerToken = account.token;

    // Create per-player MCP server
    const mcpServer = createPlayerMcpServer(playerId, roomId, () => room.getEngine());

    // Create SSE transport — message endpoint path
    const messageEndpoint = `/mcp/${roomId}/${playerId}/message`;
    const transport = new SSEServerTransport(messageEndpoint, res);

    // Store session with player token
    const publicUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
    const playerUrl = `${publicUrl}/player/${playerToken}`;
    sessions.set(sessionKey, { mcpServer, transport, playerToken });

    console.log(`[MCP] SSE session established: ${sessionKey}`);
    console.log(`[MCP] Player URL: ${playerUrl}`);

    // Handle disconnect
    res.on('close', () => {
      console.log(`[MCP] SSE connection closed: ${sessionKey}`);
      sessions.delete(sessionKey);
      engine.removePlayer(playerId);
      room.onPlayerDisconnected(playerId);
    });

    // Connect MCP server to transport (this calls transport.start())
    await mcpServer.connect(transport);

    // Send periodic keep-alive comments to prevent timeout
    const keepAliveInterval = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch (err) {
        clearInterval(keepAliveInterval);
      }
    }, 15000); // Every 15 seconds

    // Clear interval on disconnect
    res.on('close', () => {
      clearInterval(keepAliveInterval);
    });
  });

  // MCP message endpoint (POST)
  app.post('/mcp/:roomId/:playerId/message', async (req: Request, res: Response) => {
    const roomId = req.params.roomId as string;
    const playerId = req.params.playerId as string;
    const sessionKey = `${roomId}:${playerId}`;

    const session = sessions.get(sessionKey);
    if (!session) {
      res.status(404).json({ error: 'No active MCP session. Connect to SSE endpoint first.' });
      return;
    }

    // Pass req.body as parsedBody since express.json() already consumed the stream
    await session.transport.handlePostMessage(req, res, req.body);
  });
}

/**
 * Get all active MCP sessions for a room.
 */
export function getRoomSessions(roomId: string): Map<string, PlayerSession> {
  const result = new Map<string, PlayerSession>();
  for (const [key, session] of sessions) {
    if (key.startsWith(`${roomId}:`)) {
      result.set(key, session);
    }
  }
  return result;
}

/**
 * Close all MCP sessions for a room.
 */
export async function closeRoomSessions(roomId: string): Promise<void> {
  for (const [key, session] of sessions) {
    if (key.startsWith(`${roomId}:`)) {
      try { await session.mcpServer.close(); } catch {}
      sessions.delete(key);
    }
  }
}
