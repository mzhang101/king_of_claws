// ============================================================
// King of Claws — MCP Transport Routing (SSE + Streamable HTTP)
// ============================================================

import type { Express, Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomUUID } from 'crypto';
import type { RoomManager } from '../room/manager.js';
import { createPlayerMcpServer } from './server.js';
import { createPlayerAccount } from '../player/account.js';

interface PlayerSession {
  mcpServer: McpServer;
  transport: SSEServerTransport;
  playerToken: string;
}

interface StreamableSession {
  mcpServer: McpServer;
  transport: StreamableHTTPServerTransport;
  playerId: string;
  roomId: string;
  playerToken: string;
}

// Store active SSE sessions: roomId:playerId → session
const sessions = new Map<string, PlayerSession>();

// Store active Streamable HTTP sessions: sessionId → session
const streamableSessions = new Map<string, StreamableSession>();

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

  // ================================================================
  // Streamable HTTP Transport (modern MCP standard)
  // Single endpoint: POST /mcp/:roomId handles all MCP messages
  // GET  /mcp/:roomId for SSE server-to-client notifications
  // DELETE /mcp/:roomId to close session
  // ================================================================

  // Handle all methods for Streamable HTTP
  app.all('/mcp/:roomId', async (req: Request, res: Response) => {
    const roomId = req.params.roomId as string;

    // Don't handle paths that look like SSE sub-routes
    if (roomId === 'sse') return;

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // --- Existing session lookup ---
    if (sessionId && streamableSessions.has(sessionId)) {
      const session = streamableSessions.get(sessionId)!;
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    // --- DELETE with unknown session → 404 ---
    if (req.method === 'DELETE') {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // --- GET with no session → 405 (need POST initialize first) ---
    if (req.method === 'GET') {
      res.status(405).json({
        error: 'Method not allowed. Send POST with initialize message first.',
      });
      return;
    }

    // --- POST: could be new session (initialize) ---
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // If sessionId is provided but not found → stale session
    if (sessionId) {
      res.status(404).json({
        error: 'Session expired or invalid. Reconnect without Mcp-Session-Id to start a new session.',
      });
      return;
    }

    // Validate room
    const room = roomManager.getRoom(roomId);
    if (!room) {
      console.log(`[MCP-HTTP] Room not found: ${roomId}`);
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (room.getStatus() === 'finished') {
      res.status(400).json({ error: 'Game already finished' });
      return;
    }

    const engine = room.getEngine();
    if (engine.getPlayerCount() >= 4) {
      res.status(403).json({ error: 'Room is full (max 4 players)' });
      return;
    }

    // Create new player
    const playerId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const randomNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
    const playerName = randomNames[engine.getPlayerCount() % randomNames.length];

    const player = engine.addPlayer(playerId, playerName);
    if (!player) {
      res.status(500).json({ error: 'Failed to add player' });
      return;
    }

    console.log(`[MCP-HTTP] Player added: ${playerId} (${playerName}) to room ${roomId}`);
    room.onPlayerConnected(playerId, playerName);

    // Create account + MCP server
    const account = createPlayerAccount(playerId, roomId);
    const mcpServer = createPlayerMcpServer(playerId, roomId, () => room.getEngine());

    // Create Streamable HTTP transport (stateful, with session ID)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    // Connect MCP server to transport
    await mcpServer.connect(transport);

    // Handle the initial request (the initialize message) — this generates the sessionId
    await transport.handleRequest(req, res, req.body);

    const newSessionId = transport.sessionId;
    if (!newSessionId) {
      console.log(`[MCP-HTTP] Failed to establish session for room ${roomId}`);
      // Player was already added, clean up
      engine.removePlayer(playerId);
      room.onPlayerDisconnected(playerId);
      return;
    }

    console.log(`[MCP-HTTP] Session established: ${newSessionId} (player: ${playerId}, room: ${roomId})`);

    const publicUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
    console.log(`[MCP-HTTP] Player URL: ${publicUrl}/player/${account.token}`);

    streamableSessions.set(newSessionId, {
      mcpServer,
      transport,
      playerId,
      roomId,
      playerToken: account.token,
    });

    // Handle transport close → cleanup
    transport.onclose = () => {
      console.log(`[MCP-HTTP] Session closed: ${newSessionId}`);
      streamableSessions.delete(newSessionId);
      engine.removePlayer(playerId);
      room.onPlayerDisconnected(playerId);
    };
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
  // Close SSE sessions
  for (const [key, session] of sessions) {
    if (key.startsWith(`${roomId}:`)) {
      try { await session.mcpServer.close(); } catch {}
      sessions.delete(key);
    }
  }
  // Close Streamable HTTP sessions
  for (const [sid, session] of streamableSessions) {
    if (session.roomId === roomId) {
      try { await session.mcpServer.close(); } catch {}
      streamableSessions.delete(sid);
    }
  }
}
