// ============================================================
// King of Claws — Lobby MCP Server (fixed URL, no roomId needed)
// ============================================================

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RoomManager } from '../room/manager.js';
import { registerGameTools } from './tools.js';
import { createPlayerAccount } from '../player/account.js';

export interface LobbyJoinedState {
  roomId?: string;
  playerId?: string;
  playerToken?: string;
}

/**
 * Create an MCP server for the lobby.
 * Starts with lobby tools (list_rooms, create_room, join_room).
 * After join_room succeeds, game tools are injected into the same server instance.
 */
export function createLobbyMcpServer(
  roomManager: RoomManager,
  state: LobbyJoinedState,
): McpServer {
  const server = new McpServer(
    {
      name: 'king-of-claws-lobby',
      version: '1.0.0',
    },
    {
      instructions: [
        'Welcome to King of Claws! You are in the lobby.',
        'Use list_rooms to see available games, create_room to make a new one, or join_room to enter a game.',
        'After join_room succeeds, immediately enter a waiting loop: call wait_for_game_start repeatedly until it returns status="playing". Do not go idle and do not wait for user reminders.',
        'Once status is playing, start acting every tick using get_my_status + move/place_bomb.',
        'After joining a room, new game tools (wait_for_game_start, move, place_bomb, get_game_state, etc.) will become available automatically.',
      ].join(' '),
    },
  );

  // ---- Tool: list_rooms ----
  server.tool(
    'list_rooms',
    'List all active game rooms in the lobby. Returns room ID, name, player count, status, and max players for each room. Use this to find a room to join.',
    {},
    async () => {
      const rooms = roomManager.listRooms().filter(r => r.status !== 'finished');
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            rooms: rooms.map(r => ({
              id: r.id,
              name: r.name,
              playerCount: r.playerCount,
              maxPlayers: r.maxPlayers,
              status: r.status,
            })),
            total: rooms.length,
            hint: rooms.length === 0
              ? 'No rooms available. Use create_room to make one.'
              : 'Use join_room with a room ID to enter a game.',
          }, null, 2),
        }],
      };
    },
  );

  // ---- Tool: create_room ----
  server.tool(
    'create_room',
    'Create a new game room. Returns the room ID which you can then join with join_room.',
    {
      name: z.string().min(1).max(30).optional().describe('Room name (default: "Arena")'),
    },
    async ({ name }) => {
      const room = roomManager.createRoom(name ?? 'Arena');
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            roomId: room.id,
            roomName: room.name,
            message: `Room "${room.name}" created! Use join_room("${room.id}") to enter.`,
          }, null, 2),
        }],
      };
    },
  );

  // ---- Tool: join_room ----
  server.tool(
    'join_room',
    'Join an existing game room. After joining, game tools (wait_for_game_start, move, place_bomb, get_game_state, get_my_status, change_name) will be added automatically. IMPORTANT: after join, call wait_for_game_start in a loop until status becomes "playing". You can only join one room per session.',
    {
      roomId: z.string().describe('The room ID to join (from list_rooms or create_room)'),
      playerName: z.string().min(1).max(20).optional().describe('Your display name (default: auto-assigned)'),
    },
    async ({ roomId, playerName }) => {
      // Prevent double-join
      if (state.roomId) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: `Already joined room ${state.roomId}. Use the game tools to play.`,
            }),
          }],
        };
      }

      const room = roomManager.getRoom(roomId);
      if (!room) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, error: 'Room not found' }),
          }],
        };
      }

      if (room.getStatus() === 'finished') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, error: 'Game already finished' }),
          }],
        };
      }

      const engine = room.getEngine();
      if (engine.getPlayerCount() >= 4) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, error: 'Room is full (max 4 players)' }),
          }],
        };
      }

      // Create player
      const playerId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const randomNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
      const assignedName = playerName ?? randomNames[engine.getPlayerCount() % randomNames.length];

      const player = engine.addPlayer(playerId, assignedName);
      if (!player) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, error: 'Failed to add player to game' }),
          }],
        };
      }

      room.onPlayerConnected(playerId, assignedName);

      // Create account
      const account = createPlayerAccount(playerId, roomId);
      const publicUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
      const playerUrl = `${publicUrl}/player/${account.token}`;

      // Update lobby state
      state.roomId = roomId;
      state.playerId = playerId;
      state.playerToken = account.token;

      console.log(`[MCP-Lobby] Player ${playerId} (${assignedName}) joined room ${roomId}`);
      console.log(`[MCP-Lobby] Player URL: ${playerUrl}`);

      // Inject game tools into this same MCP server instance
      registerGameTools(server, playerId, () => room.getEngine());

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            playerId,
            playerName: assignedName,
            roomId,
            roomName: room.name,
            gameStatus: room.getStatus(),
            playerUrl,
            playerToken: account.token,
            nextAction: 'Call wait_for_game_start NOW, and keep calling it until status is "playing". When it returns playing, immediately call get_my_status and then the recommended first move from openingPlan.',
            message: `Joined room "${room.name}" as ${assignedName}! Game tools are now available. IMPORTANT: call wait_for_game_start immediately in a loop until the game starts. As soon as it returns playing, execute the opening sequence right away: get_my_status, then the recommended first move, then continue your normal loop.`,
          }, null, 2),
        }],
      };
    },
  );

  return server;
}
