// ============================================================
// King of Claws — WebSocket Spectator Handler
// ============================================================

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import type { RoomManager } from '../room/manager.js';
import type { ClientMessage, ServerMessage } from '@king-of-claws/shared';

/**
 * Set up WebSocket server for spectator connections.
 */
export function setupSpectatorWebSocket(
  httpServer: HTTPServer,
  roomManager: RoomManager,
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let currentRoomId: string | null = null;

    ws.on('message', (data: Buffer) => {
      try {
        const msg: ClientMessage = JSON.parse(data.toString());
        handleMessage(ws, msg, roomManager, currentRoomId, (newRoomId) => {
          currentRoomId = newRoomId;
        });
      } catch (err) {
        sendToClient(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      if (currentRoomId) {
        const room = roomManager.getRoom(currentRoomId);
        room?.removeSpectator(ws);
      }
    });
  });

  return wss;
}

function handleMessage(
  ws: WebSocket,
  msg: ClientMessage,
  roomManager: RoomManager,
  currentRoomId: string | null,
  setRoomId: (id: string | null) => void,
): void {
  switch (msg.type) {
    case 'list_rooms': {
      sendToClient(ws, {
        type: 'room_list',
        rooms: roomManager.listRooms(),
      });
      break;
    }

    case 'create_room': {
      const room = roomManager.createRoom(msg.name || 'Unnamed Arena');
      sendToClient(ws, {
        type: 'room_created',
        roomId: room.id,
        name: room.name,
      });
      break;
    }

    case 'join_room': {
      // Leave current room if any
      if (currentRoomId) {
        const oldRoom = roomManager.getRoom(currentRoomId);
        oldRoom?.removeSpectator(ws);
      }

      const room = roomManager.getRoom(msg.roomId);
      if (!room) {
        sendToClient(ws, { type: 'error', message: 'Room not found' });
        return;
      }

      room.addSpectator(ws);
      setRoomId(msg.roomId);
      break;
    }

    case 'leave_room': {
      if (currentRoomId) {
        const room = roomManager.getRoom(currentRoomId);
        room?.removeSpectator(ws);
        setRoomId(null);
      }
      break;
    }

    case 'start_game': {
      const room = roomManager.getRoom(msg.roomId);
      if (!room) {
        sendToClient(ws, { type: 'error', message: 'Room not found' });
        return;
      }
      const started = room.startGame();
      if (!started) {
        sendToClient(ws, { type: 'error', message: 'Cannot start: need at least 2 players, and game must be in waiting state.' });
      }
      break;
    }

    default:
      sendToClient(ws, { type: 'error', message: `Unknown message type` });
  }
}

function sendToClient(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
