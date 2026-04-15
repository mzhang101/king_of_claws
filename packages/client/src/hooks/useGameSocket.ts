// ============================================================
// King of Claws — WebSocket Connection Hook
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import type { GameState, RoomSummary } from '@king-of-claws/shared';
import type { ClientMessage, ServerMessage, GameEvent } from '@king-of-claws/shared';

// Auto-detect protocol and host — works with Vite proxy (dev) and Nginx reverse proxy (prod)
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export interface UseGameSocketReturn {
  connected: boolean;
  gameState: GameState | null;
  rooms: RoomSummary[];
  events: GameEvent[];
  lastEvent: GameEvent | null;
  send: (msg: ClientMessage) => void;
  createRoom: (name: string) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  startGame: (roomId: string) => void;
  listRooms: () => void;
}

export function useGameSocket(): UseGameSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2s
      setTimeout(() => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }, 2000);
    };

    ws.onmessage = (ev) => {
      try {
        const msg: ServerMessage = JSON.parse(ev.data);
        handleMessage(msg);
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'room_list':
        setRooms(msg.rooms);
        break;
      case 'game_state':
        setGameState(msg.state);
        break;
      case 'game_event':
        setLastEvent(msg.event);
        setEvents(prev => [...prev.slice(-50), msg.event]); // Keep last 50 events
        break;
      case 'player_joined':
      case 'player_left':
        // Room state will be updated via game_state messages
        break;
      case 'game_over':
        // Handled by game_state (status = 'finished')
        break;
      case 'room_created':
        // Will be handled by the component
        break;
      case 'error':
        console.warn('[KoC] Server error:', msg.message);
        break;
    }
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const createRoom = useCallback((name: string) => send({ type: 'create_room', name }), [send]);
  const joinRoom = useCallback((roomId: string) => send({ type: 'join_room', roomId }), [send]);
  const leaveRoom = useCallback(() => send({ type: 'leave_room' }), [send]);
  const startGame = useCallback((roomId: string) => send({ type: 'start_game', roomId }), [send]);
  const listRooms = useCallback(() => send({ type: 'list_rooms' }), [send]);

  return {
    connected,
    gameState,
    rooms,
    events,
    lastEvent,
    send,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    listRooms,
  };
}
